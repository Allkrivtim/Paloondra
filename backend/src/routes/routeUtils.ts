import path from 'path';
import { Response } from 'express';

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
