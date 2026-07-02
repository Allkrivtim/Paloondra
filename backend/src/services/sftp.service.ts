import { Client, SFTPWrapper, FileEntry as Ssh2FileEntry } from 'ssh2';
import { EventEmitter } from 'events';
import path from 'path';
import { buildSshConnectConfig } from './ssh.service';
import { modeToPermissions } from './fsUtils';
import { FileEntry, FileManagerService } from '../types';

const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

function modeToType(mode: number): FileEntry['type'] {
  if ((mode & 0o170000) === 0o040000) return 'directory';
  if ((mode & 0o170000) === 0o120000) return 'symlink';
  if ((mode & 0o170000) === 0o100000) return 'file';
  return 'other';
}

function toEntry(dirPath: string, item: Ssh2FileEntry): FileEntry {
  const mode = item.attrs.mode ?? 0;
  return {
    name: item.filename,
    path: path.posix.join(dirPath, item.filename),
    type: modeToType(mode),
    size: item.attrs.size ?? 0,
    permissions: modeToPermissions(mode),
    modifiedAt: (item.attrs.mtime ?? 0) * 1000,
  };
}

/** Talks to the target server over the raw SFTP subsystem (ssh2). */
class SftpService extends EventEmitter implements FileManagerService {
  private client: Client | null = null;
  private sftp: SFTPWrapper | null = null;
  private connected = false;
  private backoff = MIN_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectPromise: Promise<SFTPWrapper> | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    this.ensureConnected().catch(() => undefined);
  }

  private ensureConnected(): Promise<SFTPWrapper> {
    if (this.sftp && this.connected) return Promise.resolve(this.sftp);
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise((resolve, reject) => {
      const client = new Client();

      client.on('ready', () => {
        client.sftp((err, sftp) => {
          if (err) {
            this.connectPromise = null;
            this.scheduleReconnect();
            reject(err);
            return;
          }
          this.client = client;
          this.sftp = sftp;
          this.connected = true;
          this.backoff = MIN_BACKOFF_MS;
          this.connectPromise = null;
          this.emit('status', { connected: true });

          sftp.on('close', () => this.handleDisconnect());
          resolve(sftp);
        });
      });

      client.on('error', (err) => {
        this.connectPromise = null;
        this.handleDisconnect();
        reject(err);
      });

      try {
        client.connect(buildSshConnectConfig());
      } catch (err) {
        this.connectPromise = null;
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return this.connectPromise;
  }

  private handleDisconnect(): void {
    const wasConnected = this.connected;
    this.client?.removeAllListeners();
    this.client = null;
    this.sftp = null;
    this.connected = false;
    if (wasConnected) this.emit('status', { connected: false });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * 1.5, MAX_BACKOFF_MS);
      this.ensureConnected().catch(() => undefined);
    }, this.backoff);
  }

  async list(dirPath: string): Promise<FileEntry[]> {
    const sftp = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      sftp.readdir(dirPath, (err, list) => {
        if (err) return reject(err);
        resolve(
          list
            .map((item) => toEntry(dirPath, item))
            .sort((a, b) =>
              a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1,
            ),
        );
      });
    });
  }

  async stat(targetPath: string): Promise<FileEntry> {
    const sftp = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      sftp.stat(targetPath, (err, stats) => {
        if (err) return reject(err);
        const mode = stats.mode ?? 0;
        resolve({
          name: path.posix.basename(targetPath),
          path: targetPath,
          type: modeToType(mode),
          size: stats.size ?? 0,
          permissions: modeToPermissions(mode),
          modifiedAt: (stats.mtime ?? 0) * 1000,
        });
      });
    });
  }

  async mkdir(dirPath: string): Promise<void> {
    const sftp = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      sftp.mkdir(dirPath, (err) => (err ? reject(err) : resolve()));
    });
  }

  async rename(from: string, to: string): Promise<void> {
    const sftp = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      sftp.rename(from, to, (err) => (err ? reject(err) : resolve()));
    });
  }

  private async unlinkFile(filePath: string): Promise<void> {
    const sftp = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      sftp.unlink(filePath, (err) => (err ? reject(err) : resolve()));
    });
  }

  private async rmdirEmpty(dirPath: string): Promise<void> {
    const sftp = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      sftp.rmdir(dirPath, (err) => (err ? reject(err) : resolve()));
    });
  }

  /** Recursively deletes a file or directory. */
  async delete(targetPath: string): Promise<void> {
    const info = await this.stat(targetPath);
    if (info.type !== 'directory') {
      await this.unlinkFile(targetPath);
      return;
    }
    const children = await this.list(targetPath);
    for (const child of children) {
      await this.delete(child.path);
    }
    await this.rmdirEmpty(targetPath);
  }

  async readTextFile(filePath: string, maxSize: number): Promise<string> {
    const buf = await this.readBuffer(filePath, maxSize);
    if (buf.includes(0)) {
      throw new Error('File appears to be binary');
    }
    return buf.toString('utf8');
  }

  async writeTextFile(filePath: string, content: string): Promise<void> {
    await this.writeBuffer(filePath, Buffer.from(content, 'utf8'));
  }

  async readBuffer(filePath: string, maxSize?: number): Promise<Buffer> {
    if (maxSize !== undefined) {
      const info = await this.stat(filePath);
      if (info.type !== 'file') {
        throw new Error('Not a regular file');
      }
      if (info.size > maxSize) {
        throw new Error(`File is too large (${info.size} bytes, limit ${maxSize})`);
      }
    }
    const sftp = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = sftp.createReadStream(filePath);
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async writeBuffer(filePath: string, data: Buffer): Promise<void> {
    const sftp = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(filePath);
      stream.on('error', reject);
      stream.on('close', () => resolve());
      stream.end(data);
    });
  }

  async createReadStream(filePath: string): Promise<NodeJS.ReadableStream> {
    const sftp = await this.ensureConnected();
    return sftp.createReadStream(filePath);
  }

  async resolveHome(): Promise<string> {
    const sftp = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      sftp.realpath('.', (err, resolved) => (err ? reject(err) : resolve(resolved)));
    });
  }
}

export const sftpService = new SftpService();
