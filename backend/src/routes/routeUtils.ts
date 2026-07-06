import path from 'path';
import { Response } from 'express';
import { env } from '../config/env';

/** Logs the real error server-side and sends a safe message to the client. */
export function sendError(res: Response, err: unknown, fallback: string, status = 500): void {
  // eslint-disable-next-line no-console
  console.error(fallback, err);
  const message = err instanceof Error ? err.message : fallback;
  res.status(status).json({ error: message });
}

/**
 * Validates that `filename` is a bare filename (no path separators, no
 * "." / ".."), then joins it under `dir`. Every route that takes a
 * client-supplied filename for a fixed server-side directory (plugins,
 * backups) MUST go through this instead of a raw path.posix.join - a
 * filename like "../../etc/passwd" would otherwise escape the intended
 * directory entirely.
 */
export function safeJoinFilename(dir: string, filename: unknown): string {
  if (typeof filename !== 'string' || !filename.trim()) {
    throw new Error('A filename is required');
  }
  const name = filename.trim();
  if (name === '.' || name === '..' || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    throw new Error('Invalid filename');
  }
  return path.posix.join(dir, name);
}

/**
 * The Server Config (bukkit.yml/spigot.yml) and Whitelist/Ops tabs all read
 * files that live next to server.properties on the target server - derived
 * from SERVER_PROPERTIES_PATH's directory. This is "not configured" like
 * PLUGINS_DIR/BACKUPS_DIR - unset means the tab shows a clear message
 * instead of the backend refusing to start.
 */
export function requireServerRootDir(): string {
  if (!env.serverFiles.rootDir) {
    throw new Error('SERVER_PROPERTIES_PATH is not configured - set it in backend/.env to use this feature');
  }
  return env.serverFiles.rootDir;
}

/** Minecraft usernames are 1-16 chars of [A-Za-z0-9_] - reject anything else before it reaches an RCON command string. */
export function isValidMinecraftUsername(name: string): boolean {
  return /^[A-Za-z0-9_]{1,16}$/.test(name);
}

// RCON has no structured success/failure signal - every vanilla/Bukkit/Paper
// command just returns a plain-text line meant for a player's chat window.
// This is a best-effort match against common failure phrasings so the
// Whitelist/Ops tabs can show a real error instead of a misleadingly
// cheerful toast; a false negative here still shows the server's own
// response text to the user, it's just labeled as a success.
const RCON_FAILURE_PATTERNS = [
  /no such player/i,
  /does(?:n't| not) exist/i,
  /unknown player/i,
  /cannot find/i,
  /can't find/i,
  /unknown command/i,
  /incorrect argument/i,
  /couldn'?t/i,
];

export function looksLikeRconFailure(response: string): boolean {
  return RCON_FAILURE_PATTERNS.some((re) => re.test(response));
}
