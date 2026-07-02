import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';

/**
 * Minimal local JSON-file persistence for the scheduler and audit log.
 * This is deliberately not a database - low write volume (admin actions,
 * cron edits), so a small file is simplest. DATA_DIR is on THIS backend's
 * host, not the target Minecraft server - no SSH/SFTP involved here.
 */

async function ensureDataDir(): Promise<string> {
  const dir = path.resolve(env.dataDir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  const dir = await ensureDataDir();
  try {
    const raw = await fs.readFile(path.join(dir, filename), 'utf8');
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return fallback;
    throw err;
  }
}

/** Writes via a temp file + rename so a crash mid-write can't corrupt the file. */
export async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  const dir = await ensureDataDir();
  const filePath = path.join(dir, filename);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmpPath, filePath);
}
