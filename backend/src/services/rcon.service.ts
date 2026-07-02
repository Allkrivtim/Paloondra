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
  private backoff = MIN_BACKOFF_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectPromise: Promise<Rcon> | null = null;

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
    this.ensureConnected().catch(() => undefined);
  }

  /**
   * Resolves once connected, reusing any attempt already in flight. Issuing
   * a command while disconnected triggers an immediate attempt instead of
   * waiting out the backoff timer - a user typing a command is explicit
   * intent that deserves an eager retry.
   */
  private ensureConnected(): Promise<Rcon> {
    if (this.client && this.connected) return Promise.resolve(this.client);
    if (this.connectPromise) return this.connectPromise;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connectPromise = (async () => {
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
        this.backoff = MIN_BACKOFF_MS;
        this.connectPromise = null;
        this.emit('status', this.getStatus());
        return client;
      } catch (err) {
        this.connectPromise = null;
        this.client = null;
        this.connected = false;
        this.emit('status', this.getStatus());
        this.scheduleReconnect();
        throw err;
      }
    })();

    return this.connectPromise;
  }

  private handleDisconnect(): void {
    const wasConnected = this.connected;
    this.client = null;
    this.connected = false;
    if (wasConnected) this.emit('status', this.getStatus());
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

  async execute(command: string): Promise<RconResult> {
    const client = await this.ensureConnected();
    const response = await client.send(command);
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
