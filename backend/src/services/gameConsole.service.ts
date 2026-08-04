import { EventEmitter } from 'events';
import { ClientChannel } from 'ssh2';
import { env } from '../config/env';
import { sshService } from './ssh.service';
import { shellEscape } from './fsUtils';
import { ConsoleLine } from '../types';

const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;
const HISTORY_SIZE = 1000;
// How long a freshly-opened `docker logs -f` channel must stay open before
// it's treated as a real success. The SSH exec channel itself opens
// successfully even when the remote `docker` command is about to fail
// (daemon unreachable, no such container) - it just closes again moments
// later with a non-zero exit code. Without this grace period, backoff would
// reset to MIN_BACKOFF_MS on every attempt and never actually grow for a
// container that keeps failing fast.
const CONFIRM_MS = 1500;

export interface GameConsoleStatus {
  configured: boolean;
  following: boolean;
  lastError: string | null;
}

/**
 * Backs the Console tab: a Pterodactyl-style view of the Minecraft server's
 * own Docker console, NOT RCON. Runs `docker logs -f --tail N` over the
 * shared SSH connection (ssh.service.ts) to follow the container's stdout/
 * stderr, and `docker exec <container> mc-send-to-console` to write
 * commands directly into the server's console - RCON is untouched and
 * still used by everything else (dashboard quick actions, whitelist, ops,
 * scheduler, MOTD reload).
 */
class GameConsoleService extends EventEmitter {
  private history: ConsoleLine[] = [];
  private following = false;
  private lastError: string | null = null;
  private backoff = MIN_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private channel: ClientChannel | null = null;

  getHistory(): ConsoleLine[] {
    return this.history;
  }

  getStatus(): GameConsoleStatus {
    return { configured: !!env.docker.containerName, following: this.following, lastError: this.lastError };
  }

  start(): void {
    if (!env.docker.containerName) return;
    void this.follow();
  }

  private push(line: ConsoleLine): void {
    this.history.push(line);
    if (this.history.length > HISTORY_SIZE) {
      this.history.shift();
    }
    this.emit('line', line);
  }

  private async follow(): Promise<void> {
    const container = env.docker.containerName;
    if (!container) return;

    const command = `docker logs -f --tail ${env.docker.consoleTailLines} ${shellEscape(container)}`;

    let channel: ClientChannel;
    try {
      channel = await sshService.execChannel(command);
    } catch (err) {
      this.handleDown(err instanceof Error ? err.message : 'Failed to start docker logs');
      return;
    }

    this.channel = channel;
    let stderrBuf = '';
    let confirmed = false;

    const confirm = () => {
      if (confirmed) return;
      confirmed = true;
      clearTimeout(confirmTimer);
      this.markUp();
    };
    const confirmTimer = setTimeout(confirm, CONFIRM_MS);

    channel.on('data', (chunk: Buffer) => {
      confirm();
      for (const line of chunk.toString('utf8').split(/\r?\n/)) {
        if (line) this.push({ stream: 'stdout', line, timestamp: Date.now() });
      }
    });

    channel.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      stderrBuf += text;
      for (const line of text.split(/\r?\n/)) {
        if (line) this.push({ stream: 'stderr', line, timestamp: Date.now() });
      }
    });

    channel.on('close', (code: number | null) => {
      clearTimeout(confirmTimer);
      this.channel = null;
      const message =
        code && code !== 0 ? stderrBuf.trim() || `docker logs exited with code ${code}` : 'Docker log stream ended';
      this.handleDown(message);
    });

    channel.on('error', (err: Error) => {
      clearTimeout(confirmTimer);
      this.channel = null;
      this.handleDown(err.message);
    });
  }

  /** Called once a `docker logs -f` channel has proven itself genuinely alive (see CONFIRM_MS). */
  private markUp(): void {
    this.backoff = MIN_BACKOFF_MS;
    const wasDown = this.lastError !== null;
    this.following = true;
    this.lastError = null;
    this.emit('status', this.getStatus());
    if (wasDown) {
      this.push({ stream: 'system', line: 'Reconnected to the server console.', timestamp: Date.now() });
    }
  }

  private handleDown(reason: string): void {
    const wasFollowing = this.following;
    this.following = false;
    this.lastError = reason;
    this.emit('status', this.getStatus());
    if (wasFollowing) {
      this.push({
        stream: 'system',
        line: `Lost connection to the server console: ${reason}. Reconnecting...`,
        timestamp: Date.now(),
      });
    }
    this.scheduleReconnect();
  }

  /** Backoff only ever grows here, and only ever resets in markUp() on a confirmed success - never on a merely-opened-then-immediately-failing channel. */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * 1.5, MAX_BACKOFF_MS);
      void this.follow();
    }, this.backoff);
  }

  /**
   * Writes a command straight into the server's own console via itzg/
   * minecraft-server's `mc-send-to-console` helper - never RCON. There is
   * no response to correlate; the server prints whatever it prints to its
   * own console, which shows up naturally in the followed log stream.
   * Failures are pushed into the same shared history/line stream (visible
   * to every connected client) instead of a per-caller error, since this is
   * a single shared console view, not a per-user request/response channel.
   */
  async sendCommand(command: string): Promise<void> {
    const container = env.docker.containerName;
    if (!container) {
      this.push({ stream: 'system', line: 'Cannot send command: MC_CONTAINER is not configured.', timestamp: Date.now() });
      return;
    }

    const cmd = `docker exec ${shellEscape(container)} mc-send-to-console -- ${shellEscape(command)}`;
    try {
      const { stderr, code } = await sshService.exec(cmd);
      if (code !== 0) {
        this.push({
          stream: 'system',
          line: `Failed to send command: ${stderr.trim() || `exited with code ${code}`}`,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      this.push({
        stream: 'system',
        line: `Failed to send command: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      });
    }
  }
}

export const gameConsoleService = new GameConsoleService();
