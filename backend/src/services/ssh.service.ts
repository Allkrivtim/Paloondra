import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { EventEmitter } from 'events';
import fs from 'fs';
import { env } from '../config/env';

const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

export function buildSshConnectConfig(): ConnectConfig {
  const base: ConnectConfig = {
    host: env.ssh.host,
    port: env.ssh.port,
    username: env.ssh.user,
    readyTimeout: 10000,
    keepaliveInterval: 15000,
  };

  if (env.ssh.privateKeyPath) {
    return {
      ...base,
      privateKey: fs.readFileSync(env.ssh.privateKeyPath),
      passphrase: env.ssh.passphrase,
    };
  }

  return { ...base, password: env.ssh.password };
}

/**
 * Long-lived SSH connection used for one-off command execution: host
 * metrics (top/free/df) and, when SFTP_USE_SUDO is on, every file manager
 * operation. The interactive terminal tab opens its own short-lived
 * connection per session instead of sharing this one.
 */
class SshService extends EventEmitter {
  private client: Client | null = null;
  private connected = false;
  private backoff = MIN_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectPromise: Promise<Client> | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    this.ensureConnected().catch(() => undefined);
  }

  /**
   * Resolves once connected, reusing any connection attempt already in
   * flight. Callers that hit this while a reconnect is scheduled (rather
   * than already running) trigger it immediately instead of waiting out
   * the backoff - there's no reason to make an on-demand SFTP/sudo request
   * wait for a timer when a fresh attempt can start right now.
   */
  private ensureConnected(): Promise<Client> {
    if (this.client && this.connected) return Promise.resolve(this.client);
    if (this.connectPromise) return this.connectPromise;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connectPromise = new Promise((resolve, reject) => {
      const client = new Client();

      client.on('ready', () => {
        this.client = client;
        this.connected = true;
        this.backoff = MIN_BACKOFF_MS;
        this.connectPromise = null;
        this.emit('status', { connected: true });
        resolve(client);
      });

      client.on('error', (err) => {
        this.connectPromise = null;
        this.handleDisconnect();
        reject(err);
      });

      client.on('close', () => this.handleDisconnect());

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

  async exec(command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    const client = await this.ensureConnected();

    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) return reject(err);
        let stdout = '';
        let stderr = '';
        stream.on('data', (data: Buffer) => (stdout += data.toString('utf8')));
        stream.stderr.on('data', (data: Buffer) => (stderr += data.toString('utf8')));
        stream.on('close', (code: number | null) => resolve({ stdout, stderr, code }));
        stream.on('error', reject);
      });
    });
  }

  /**
   * Raw exec channel for callers that need to stream stdin/stdout directly
   * (the sudo-mode file service) instead of buffering the whole command
   * output in memory.
   */
  async execChannel(command: string): Promise<ClientChannel> {
    const client = await this.ensureConnected();
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => (err ? reject(err) : resolve(stream)));
    });
  }
}

export const sshService = new SshService();
