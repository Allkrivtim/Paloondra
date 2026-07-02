import { Rcon } from 'rcon-client';
import { EventEmitter } from 'events';
import { env } from '../config/env';
import { ServerStatus } from '../types';

const MIN_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

export interface RconResult {
  command: string;
  response: string;
  timestamp: number;
}

class RconService extends EventEmitter {
  private client: Rcon | null = null;
  private connected = false;
  private connecting = false;
  private backoff = MIN_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;

  getStatus(): ServerStatus {
    return {
      online: this.connected,
      rconConnected: this.connected,
      lastChecked: Date.now(),
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  start(): void {
    void this.connect();
  }

  private async connect(): Promise<void> {
    if (this.connecting || this.connected) return;
    this.connecting = true;
    try {
      const client = new Rcon({
        host: env.rcon.host,
        port: env.rcon.port,
        password: env.rcon.password,
        timeout: 5000,
      });

      client.on('end', () => this.handleDisconnect());
      client.on('error', () => this.handleDisconnect());

      await client.connect();

      this.client = client;
      this.connected = true;
      this.connecting = false;
      this.backoff = MIN_BACKOFF_MS;
      this.emit('status', this.getStatus());
    } catch {
      this.connecting = false;
      this.client = null;
      this.connected = false;
      this.emit('status', this.getStatus());
      this.scheduleReconnect();
    }
  }

  private handleDisconnect(): void {
    if (!this.connected && !this.connecting) return;
    this.connected = false;
    this.client = null;
    this.emit('status', this.getStatus());
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoff = Math.min(this.backoff * 1.5, MAX_BACKOFF_MS);
      void this.connect();
    }, this.backoff);
  }

  async execute(command: string): Promise<RconResult> {
    if (!this.client || !this.connected) {
      throw new Error('RCON is not connected');
    }
    const response = await this.client.send(command);
    return { command, response, timestamp: Date.now() };
  }

  /** Parses vanilla/most plugin "list" output into online/max/names. */
  async getPlayers(): Promise<{ online: number; max: number | null; names: string[] } | null> {
    try {
      const { response } = await this.execute('list');
      const match = response.match(/There are (\d+) of a max(?:imum)? of (\d+) players online/i);
      const namesPart = response.split(':').slice(1).join(':').trim();
      const names = namesPart
        ? namesPart.split(',').map((n) => n.trim()).filter(Boolean)
        : [];
      if (match) {
        return { online: parseInt(match[1], 10), max: parseInt(match[2], 10), names };
      }
      return { online: names.length, max: null, names };
    } catch {
      return null;
    }
  }
}

export const rconService = new RconService();
