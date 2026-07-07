import path from 'path';
import { parseDocument } from 'yaml';
import { env } from '../config/env';
import { requireServerRootDir, looksLikeRconFailure } from '../routes/routeUtils';
import { rconService } from './rcon.service';

// BetterMOTD's config.yml is a nested/dynamic structure - profile names and
// preset arrays are entirely up to the user - so unlike bukkit.yml/
// spigot.yml's flat dotted-path allowlist, only these top-level keys are
// known here. A structured save replaces one whole top-level subtree at a
// time (via Document#setIn, same as serverYamlFields.ts), so comments and
// ordering on every OTHER top-level key are preserved untouched - only
// `motdFrames` isn't part of the plugin's real config today but some forks/
// older versions ship it, so it's included defensively and only ever
// surfaced in the form if the file actually has it.
const KNOWN_TOP_LEVEL_KEYS = [
  'colorFormat',
  'activeProfile',
  'placeholders',
  'placeholderAPI',
  'maintenance',
  'debug',
  'profiles',
  'motdFrames',
];

export function motdConfigPath(): string {
  return env.betterMotd.configPath ?? path.posix.join(requireServerRootDir(), 'plugins/BetterMOTD/config.yml');
}

/** Picks the known top-level keys out of a parsed document as plain JSON, ready for res.json(). */
export function extractMotdValues(raw: string): Record<string, unknown> {
  const doc = parseDocument(raw);
  const plain = (doc.toJS() ?? {}) as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const key of KNOWN_TOP_LEVEL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(plain, key)) {
      values[key] = plain[key];
    }
  }
  return values;
}

/**
 * Replaces only the top-level keys present in `updates`, leaving every
 * other key - and all comments/ordering outside the replaced subtrees -
 * exactly as they were. Never a parse-into-plain-object-then-reserialize
 * of the whole file.
 */
export function applyMotdUpdate(raw: string, updates: Record<string, unknown>): string {
  const allowed = new Set(KNOWN_TOP_LEVEL_KEYS);
  for (const key of Object.keys(updates)) {
    if (!allowed.has(key)) {
      throw new Error(`Unknown field "${key}" for this file`);
    }
  }
  const doc = parseDocument(raw);
  for (const [key, value] of Object.entries(updates)) {
    doc.setIn([key], value);
  }
  return doc.toString();
}

/** Runs BetterMOTD's own live-reload RCON command, throwing with the server's response text if it looks like a failure. */
export async function reloadBetterMotd(): Promise<string> {
  const { response } = await rconService.execute('bettermotd reload');
  if (looksLikeRconFailure(response)) {
    throw new Error(response || '"bettermotd reload" failed');
  }
  return response;
}
