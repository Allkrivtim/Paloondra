import { randomUUID } from 'crypto';
import { readJsonFile, writeJsonFile } from './jsonStore';
import { AuditLogEntry } from '../types';

const FILE = 'audit-log.json';
const MAX_ENTRIES = 1000;

/**
 * Append-only log of mutating admin actions (script runs, plugin installs/
 * deletes/toggles, backup deletes, scheduled task changes, server.properties
 * saves, quick RCON actions). Not a substitute for the RCON console's own
 * live output - this is a short, browsable history of "who did what".
 */
class AuditLogService {
  private entries: AuditLogEntry[] = [];
  private loaded: Promise<void> | null = null;

  private ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      this.loaded = readJsonFile<AuditLogEntry[]>(FILE, []).then((entries) => {
        this.entries = entries;
      });
    }
    return this.loaded;
  }

  async record(username: string, action: string, details?: string | null): Promise<void> {
    await this.ensureLoaded();
    const entry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: Date.now(),
      username,
      action,
      details: details ?? null,
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
    try {
      await writeJsonFile(FILE, this.entries);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to persist audit log', err);
    }
  }

  async list(limit = 100): Promise<AuditLogEntry[]> {
    await this.ensureLoaded();
    return this.entries.slice(-limit).reverse();
  }
}

export const auditLogService = new AuditLogService();
