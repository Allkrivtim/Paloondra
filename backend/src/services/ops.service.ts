import path from 'path';
import { fileManagerService } from './fileManager.service';
import { requireServerRootDir, looksLikeRconFailure } from '../routes/routeUtils';
import { rconService } from './rcon.service';
import { OpEntry } from '../types';

const MAX_SIZE = 1024 * 1024; // ops.json is a small array; 1 MiB is generous

function opsJsonPath(): string {
  return path.posix.join(requireServerRootDir(), 'ops.json');
}

interface RawOpEntry {
  uuid?: unknown;
  name?: unknown;
  level?: unknown;
  bypassesPlayerLimit?: unknown;
}

function normalize(entries: unknown): OpEntry[] {
  if (!Array.isArray(entries)) return [];
  return (entries as RawOpEntry[])
    .filter((e): e is RawOpEntry => !!e && typeof e === 'object' && typeof e.uuid === 'string' && typeof e.name === 'string')
    .map((e) => ({
      uuid: e.uuid as string,
      name: e.name as string,
      level: typeof e.level === 'number' ? e.level : 4,
      bypassesPlayerLimit: e.bypassesPlayerLimit === true,
    }));
}

async function readRaw(): Promise<{ raw: string; entries: OpEntry[] }> {
  let raw: string;
  try {
    raw = await fileManagerService.readTextFile(opsJsonPath(), MAX_SIZE);
  } catch {
    return { raw: '[]', entries: [] }; // ops.json doesn't exist until someone's been opped
  }
  return { raw, entries: normalize(JSON.parse(raw)) };
}

class OpsService {
  async list(): Promise<OpEntry[]> {
    return (await readRaw()).entries;
  }

  /** Runs an RCON op/deop command, throwing with the server's own response text if it looks like a failure. */
  private async runCommand(command: string): Promise<string> {
    const { response } = await rconService.execute(command);
    if (looksLikeRconFailure(response)) {
      throw new Error(response || `"${command}" failed`);
    }
    return response;
  }

  async add(name: string): Promise<{ message: string; entries: OpEntry[] }> {
    const message = await this.runCommand(`op ${name}`);
    return { message, entries: await this.list() };
  }

  async remove(name: string): Promise<{ message: string; entries: OpEntry[] }> {
    const message = await this.runCommand(`deop ${name}`);
    return { message, entries: await this.list() };
  }

  /**
   * Vanilla has no RCON command to set a per-player op level - `/op` always
   * uses the server's op-permission-level. Changing an existing operator's
   * level means editing ops.json directly and restarting; there is no
   * live-reload for this (unlike whitelist.json's `whitelist reload`).
   */
  async setLevel(uuid: string, level: number): Promise<OpEntry[]> {
    const { raw, entries } = await readRaw();
    const target = entries.find((e) => e.uuid === uuid);
    if (!target) {
      throw new Error('That player is not an operator');
    }
    const parsed: RawOpEntry[] = JSON.parse(raw);
    const updated = parsed.map((e) => (e.uuid === uuid ? { ...e, level } : e));
    await fileManagerService.writeTextFile(opsJsonPath(), JSON.stringify(updated, null, 2));
    return normalize(updated);
  }
}

export const opsService = new OpsService();
