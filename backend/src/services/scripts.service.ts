import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { env } from '../config/env';
import { ConsoleLine, ScriptName } from '../types';

const SCRIPT_PATHS: Record<ScriptName, string> = {
  start: env.scripts.start,
  stop: env.scripts.stop,
  restart: env.scripts.restart,
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
   * Runs one of the configured .sh scripts via child_process. This is the
   * only way the panel ever affects the Minecraft process - it never talks
   * to the server directly.
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

    const scriptPath = SCRIPT_PATHS[name];
    this.running = name;
    this.push({ stream: 'system', line: `$ ${scriptPath}`, timestamp: Date.now() });

    const child = spawn('/bin/sh', [scriptPath], {
      cwd: undefined,
      env: process.env,
    });

    child.stdout.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/).filter(Boolean)) {
        this.push({ stream: 'stdout', line, timestamp: Date.now() });
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString('utf8').split(/\r?\n/).filter(Boolean)) {
        this.push({ stream: 'stderr', line, timestamp: Date.now() });
      }
    });

    child.on('error', (err) => {
      this.push({ stream: 'system', line: `Failed to launch script: ${err.message}`, timestamp: Date.now() });
      this.running = null;
    });

    child.on('close', (code) => {
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
