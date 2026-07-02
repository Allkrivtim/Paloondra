import path from 'path';
import { ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';
import { env } from '../config/env';
import { sshService } from './ssh.service';
import { modeToPermissions, shellEscape } from './fsUtils';
import { FileEntry, FileManagerService } from '../types';

// Absolute paths to the binaries invoked under sudo. sudoers matches
// commands by exact path, so these must match both here and in your
// /etc/sudoers.d/ entry (see README). Run `which find stat cat tee mkdir mv
// rm` on the target host if your distro keeps them somewhere else.
const TOOLS = {
  find: '/usr/bin/find',
  cat: '/usr/bin/cat',
  tee: '/usr/bin/tee',
  mkdir: '/usr/bin/mkdir',
  mv: '/usr/bin/mv',
  rm: '/usr/bin/rm',
};

const FIND_FORMAT = '%f\\t%s\\t%m\\t%T@\\t%y\\n';

function sudo(tool: string, args: string): string {
  return `${shellEscape(env.sftp.sudoPath)} -n ${tool} ${args}`;
}

function typeFromLetter(letter: string): FileEntry['type'] {
  if (letter === 'd') return 'directory';
  if (letter === 'l') return 'symlink';
  if (letter === 'f') return 'file';
  return 'other';
}

function parseFindLine(dirPath: string, line: string): FileEntry {
  const [name, sizeStr, modeStr, mtimeStr, typeLetter] = line.split('\t');
  const type = typeFromLetter(typeLetter);
  return {
    name,
    path: path.posix.join(dirPath, name),
    type,
    size: type === 'file' ? parseInt(sizeStr, 10) || 0 : 0,
    permissions: modeToPermissions(parseInt(modeStr, 8) || 0),
    modifiedAt: Math.round((parseFloat(mtimeStr) || 0) * 1000),
  };
}

/**
 * Fallback file service for when the SSH login user doesn't own the
 * Minecraft server's files. Instead of the raw SFTP subsystem (which is
 * always bound to the login user's permissions), every operation runs as
 * a `sudo`-prefixed shell command over the same persistent SSH connection
 * used for host metrics. Every path here MUST go through shellEscape().
 */
class SudoFsService extends EventEmitter implements FileManagerService {
  isConnected(): boolean {
    return sshService.isConnected();
  }

  start(): void {
    sshService.start();
  }

  private async run(command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const result = await sshService.exec(command);
    return result;
  }

  private async runChannel(command: string): Promise<ClientChannel> {
    return sshService.execChannel(command);
  }

  private async execBuffer(command: string): Promise<{ buffer: Buffer; code: number | null; stderr: string }> {
    const channel = await this.runChannel(command);
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let stderr = '';
      channel.on('data', (chunk: Buffer) => chunks.push(chunk));
      channel.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
      channel.on('close', (code: number | null) => resolve({ buffer: Buffer.concat(chunks), code, stderr }));
      channel.on('error', reject);
    });
  }

  async list(dirPath: string): Promise<FileEntry[]> {
    const cmd = sudo(TOOLS.find, `${shellEscape(dirPath)} -mindepth 1 -maxdepth 1 -printf '${FIND_FORMAT}'`);
    const { stdout, stderr, code } = await this.run(cmd);
    if (code !== 0) throw new Error(stderr.trim() || `Failed to list "${dirPath}"`);
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => parseFindLine(dirPath, line))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1));
  }

  async stat(targetPath: string): Promise<FileEntry> {
    const cmd = sudo(TOOLS.find, `${shellEscape(targetPath)} -maxdepth 0 -printf '${FIND_FORMAT}'`);
    const { stdout, stderr, code } = await this.run(cmd);
    const line = stdout.trim().split('\n')[0];
    if (code !== 0 || !line) throw new Error(stderr.trim() || `No such file or directory: "${targetPath}"`);
    const entry = parseFindLine(path.posix.dirname(targetPath), line);
    return { ...entry, name: path.posix.basename(targetPath), path: targetPath };
  }

  async mkdir(dirPath: string): Promise<void> {
    const cmd = sudo(TOOLS.mkdir, `-p ${shellEscape(dirPath)}`);
    const { stderr, code } = await this.run(cmd);
    if (code !== 0) throw new Error(stderr.trim() || `Failed to create directory "${dirPath}"`);
  }

  async rename(from: string, to: string): Promise<void> {
    const cmd = sudo(TOOLS.mv, `-T ${shellEscape(from)} ${shellEscape(to)}`);
    const { stderr, code } = await this.run(cmd);
    if (code !== 0) throw new Error(stderr.trim() || `Failed to move "${from}" to "${to}"`);
  }

  async delete(targetPath: string): Promise<void> {
    const cmd = sudo(TOOLS.rm, `-rf ${shellEscape(targetPath)}`);
    const { stderr, code } = await this.run(cmd);
    if (code !== 0) throw new Error(stderr.trim() || `Failed to delete "${targetPath}"`);
  }

  async readTextFile(filePath: string, maxSize: number): Promise<string> {
    const info = await this.stat(filePath);
    if (info.type !== 'file') {
      throw new Error('Not a regular file');
    }
    if (info.size > maxSize) {
      throw new Error(`File is too large to edit (${info.size} bytes, limit ${maxSize})`);
    }
    const cmd = sudo(TOOLS.cat, shellEscape(filePath));
    const { buffer, code, stderr } = await this.execBuffer(cmd);
    if (code !== 0) throw new Error(stderr.trim() || `Failed to read "${filePath}"`);
    if (buffer.includes(0)) throw new Error('File appears to be binary');
    return buffer.toString('utf8');
  }

  async writeTextFile(filePath: string, content: string): Promise<void> {
    await this.writeBuffer(filePath, Buffer.from(content, 'utf8'));
  }

  async writeBuffer(filePath: string, data: Buffer): Promise<void> {
    const cmd = `${sudo(TOOLS.tee, shellEscape(filePath))} > /dev/null`;
    const channel = await this.runChannel(cmd);
    return new Promise((resolve, reject) => {
      let stderr = '';
      channel.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
      channel.on('close', (code: number | null) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.trim() || `Failed to write "${filePath}" (exit code ${code})`));
      });
      channel.on('error', reject);
      channel.end(data);
    });
  }

  async createReadStream(filePath: string): Promise<NodeJS.ReadableStream> {
    const cmd = sudo(TOOLS.cat, shellEscape(filePath));
    return this.runChannel(cmd);
  }

  async resolveHome(): Promise<string> {
    // Deliberately NOT run under sudo - this is the SSH login user's own
    // home directory, used only as the last-resort SFTP default path.
    const { stdout, code } = await this.run('echo $HOME');
    if (code !== 0 || !stdout.trim()) {
      throw new Error('Could not resolve the SSH user\'s home directory');
    }
    return stdout.trim();
  }
}

export const sudoFsService = new SudoFsService();
