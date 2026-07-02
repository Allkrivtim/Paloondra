import { EventEmitter } from 'events';
import { ClientChannel } from 'ssh2';
import { env } from '../config/env';
import { sshService } from './ssh.service';
import { shellEscape } from './fsUtils';
import { ConsoleLine, ScriptName } from '../types';

const SCRIPT_FILENAMES: Record<ScriptName, string> = {
  start: env.scripts.start,
  stop: env.scripts.stop,
  restart: env.scripts.restart,
  backup: env.scripts.backup,
};

const HISTORY_SIZE = 500;

class ScriptsService extends EventEmitter {
  private history: ConsoleLine[] = [];
  private running: ScriptName | null = null;

  getHistory(): ConsoleLine[] {
    return this.history;
  }

  isRunning(): ScriptName | null {
    return this.running;
  }

  private push(line: ConsoleLine) {
    this.history.push(line);
    if (this.history.length > HISTORY_SIZE) {
      this.history.shift();
    }
    this.emit('line', line);
  }

  /**
   * Runs one of the configured scripts over the same SSH connection used by
   * the terminal/SFTP/metrics (ssh.service.ts) - `cd <SCRIPTS_DIR> &&
   * ./<filename>` on the target server, so scripts that rely on being run
   * from their own directory (relative paths inside them) keep working.
   * This is the only way the panel ever affects the Minecraft process - it
   * never talks to the server directly.
   */
  run(name: ScriptName): void {
    if (this.running) {
      this.push({
        stream: 'system',
        line: `Ignored "${name}": "${this.running}" is already running.`,
        timestamp: Date.now(),
      });
      return;
    }

    this.running = name;
    void this.execute(name);
  }

  private async execute(name: ScriptName): Promise<void> {
    const filename = SCRIPT_FILENAMES[name];
    const command = `cd ${shellEscape(env.scriptsDir)} && ./${shellEscape(filename)}`;
    this.push({ stream: 'system', line: `$ ${command}`, timestamp: Date.now() });

    let channel: ClientChannel;
    try {
      channel = await sshService.execChannel(command);
    } catch (err) {
      this.push({
        stream: 'system',
        line: `Failed to run "${name}" over SSH: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      });
      this.running = null;
      return;
    }

    channel.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/).filter(Boolean)) {
        this.push({ stream: 'stdout', line, timestamp: Date.now() });
      }
    });

    channel.stderr.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/).filter(Boolean)) {
        this.push({ stream: 'stderr', line, timestamp: Date.now() });
      }
    });

    channel.on('error', (err: Error) => {
      this.push({
        stream: 'system',
        line: `SSH error while running "${name}": ${err.message}`,
        timestamp: Date.now(),
      });
      this.running = null;
    });

    channel.on('close', (code: number | null) => {
      this.push({
        stream: 'system',
        line: `"${name}" exited with code ${code}`,
        timestamp: Date.now(),
      });
      this.running = null;
    });
  }
}

export const scriptsService = new ScriptsService();
