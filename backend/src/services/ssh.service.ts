import { Client, ConnectConfig } from 'ssh2';
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
 * Long-lived SSH connection used for one-off command execution (host
 * metrics: top/free/df). The interactive terminal tab opens its own
 * short-lived connection per session instead of sharing this one.
 */
class SshService extends EventEmitter {
  private client: Client | null = null;
  private connected = false;
  private connecting = false;
  private backoff = MIN_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    this.connect();
  }

  private connect(): void {
    if (this.connecting || this.connected) return;
    this.connecting = true;

    const client = new Client();

    client.on('ready', () => {
      this.client = client;
      this.connected = true;
      this.connecting = false;
      this.backoff = MIN_BACKOFF_MS;
      this.emit('status', { connected: true });
    });

    client.on('error', () => this.handleDisconnect());
    client.on('close', () => this.handleDisconnect());

    try {
      client.connect(buildSshConnectConfig());
    } catch {
      this.handleDisconnect();
    }
  }

  private handleDisconnect(): void {
    if (this.client) {
      this.client.removeAllListeners();
    }
    const wasConnected = this.connected || this.connecting;
    this.client = null;
    this.connected = false;
    this.connecting = false;
    if (wasConnected) this.emit('status', { connected: false });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * 1.5, MAX_BACKOFF_MS);
      this.connect();
    }, this.backoff);
  }

  async exec(command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    if (!this.client || !this.connected) {
      throw new Error('SSH is not connected');
    }
    const client = this.client;

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
}

export const sshService = new SshService();
