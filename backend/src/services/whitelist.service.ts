import path from 'path';
import { env } from '../config/env';
import { fileManagerService } from './fileManager.service';
import { parseProperties } from './propertiesFile';
import { requireServerRootDir, looksLikeRconFailure } from '../routes/routeUtils';
import { rconService } from './rcon.service';
import { WhitelistDocument, WhitelistEntry } from '../types';

const MAX_SIZE = 1024 * 1024; // whitelist.json is a small array of {uuid, name}; 1 MiB is generous

function whitelistJsonPath(): string {
  return path.posix.join(requireServerRootDir(), 'whitelist.json');
}

// server.properties' white-list flag lives at the explicitly configured
// SERVER_PROPERTIES_PATH if set, otherwise it's assumed to sit next to
// whitelist.json in the same server root directory.
function serverPropertiesPath(): string {
  return env.serverProperties.path ?? path.posix.join(requireServerRootDir(), 'server.properties');
}

async function readEntries(): Promise<WhitelistEntry[]> {
  let raw: string;
  try {
    raw = await fileManagerService.readTextFile(whitelistJsonPath(), MAX_SIZE);
  } catch {
    return []; // whitelist.json doesn't exist until the server has whitelisted at least once
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e): e is WhitelistEntry => e && typeof e === 'object' && typeof e.uuid === 'string' && typeof e.name === 'string')
    .map((e) => ({ uuid: e.uuid, name: e.name }));
}

async function readEnabled(): Promise<boolean> {
  const raw = await fileManagerService.readTextFile(serverPropertiesPath(), MAX_SIZE);
  return parseProperties(raw)['white-list'] === 'true';
}

class WhitelistService {
  async get(): Promise<WhitelistDocument> {
    const [entries, enabled] = await Promise.all([readEntries(), readEnabled()]);
    return { entries, enabled };
  }

  /** Runs an RCON whitelist command, throwing with the server's own response text if it looks like a failure. */
  private async runCommand(command: string): Promise<string> {
    const { response } = await rconService.execute(command);
    if (looksLikeRconFailure(response)) {
      throw new Error(response || `"${command}" failed`);
    }
    return response;
  }

  async add(name: string): Promise<{ message: string; document: WhitelistDocument }> {
    const message = await this.runCommand(`whitelist add ${name}`);
    return { message, document: await this.get() };
  }

  async remove(name: string): Promise<{ message: string; document: WhitelistDocument }> {
    const message = await this.runCommand(`whitelist remove ${name}`);
    return { message, document: await this.get() };
  }

  async reload(): Promise<{ message: string; document: WhitelistDocument }> {
    const message = await this.runCommand('whitelist reload');
    return { message, document: await this.get() };
  }

  async setEnabled(enabled: boolean): Promise<{ message: string; document: WhitelistDocument }> {
    const message = await this.runCommand(enabled ? 'whitelist on' : 'whitelist off');
    return { message, document: await this.get() };
  }
}

export const whitelistService = new WhitelistService();
