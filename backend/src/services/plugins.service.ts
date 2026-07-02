import path from 'path';
import { env } from '../config/env';
import { fileManagerService } from './fileManager.service';
import { readPluginMeta, JarPluginMeta } from './jarInspector';
import { PluginInfo } from '../types';

// A ZIP local-file-header signature ("PK\x03\x04") - every .jar starts with
// this since a jar is just a zip. Cheap sanity check before we bother
// uploading something that was renamed to .jar but isn't actually one.
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

function requireDir(): string {
  if (!env.plugins.dir) {
    throw new Error('PLUGINS_DIR is not configured - set it in backend/.env to use the Plugins tab');
  }
  return env.plugins.dir;
}

/**
 * Every filename that reaches path.posix.join(PLUGINS_DIR, filename) below
 * MUST go through this first - a filename like "../../etc/passwd" would
 * otherwise escape PLUGINS_DIR entirely. Filenames only ever come from
 * client-supplied request bodies/uploads, never trust them as-is.
 */
function sanitizeFilename(filename: string): string {
  const name = filename.trim();
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    throw new Error(`Invalid filename: "${filename}"`);
  }
  return name;
}

function isJar(filename: string): boolean {
  return filename.toLowerCase().endsWith('.jar');
}

function isDisabledJar(filename: string): boolean {
  return filename.toLowerCase().endsWith('.jar.disabled');
}

function toEnabledName(filename: string): string {
  return filename.replace(/\.disabled$/i, '');
}

function toDisabledName(filename: string): string {
  return isDisabledJar(filename) ? filename : `${filename}.disabled`;
}

interface CacheEntry {
  size: number;
  modifiedAt: number;
  meta: JarPluginMeta | null;
}

/** Parsed plugin.yml is cached per path+size+mtime so unchanged jars aren't re-parsed on every list refresh. */
const metaCache = new Map<string, CacheEntry>();

class PluginsService {
  async list(): Promise<PluginInfo[]> {
    const dir = requireDir();
    const entries = await fileManagerService.list(dir);
    const jars = entries.filter((e) => e.type === 'file' && (isJar(e.name) || isDisabledJar(e.name)));

    return Promise.all(
      jars.map(async (entry): Promise<PluginInfo> => {
        const cached = metaCache.get(entry.path);
        let meta: JarPluginMeta | null;
        if (cached && cached.size === entry.size && cached.modifiedAt === entry.modifiedAt) {
          meta = cached.meta;
        } else {
          meta = await this.tryReadMeta(entry.path, entry.size);
          metaCache.set(entry.path, { size: entry.size, modifiedAt: entry.modifiedAt, meta });
        }

        return {
          filename: entry.name,
          path: entry.path,
          size: entry.size,
          modifiedAt: entry.modifiedAt,
          enabled: !isDisabledJar(entry.name),
          name: meta?.name ?? null,
          version: meta?.version ?? null,
          author: meta?.author ?? null,
          description: meta?.description ?? null,
        };
      }),
    );
  }

  private async tryReadMeta(filePath: string, size: number): Promise<JarPluginMeta | null> {
    if (size > env.plugins.maxJarSize) return null;
    try {
      const buffer = await fileManagerService.readBuffer(filePath);
      return readPluginMeta(buffer);
    } catch {
      return null;
    }
  }

  async toggle(filename: string, enable: boolean): Promise<void> {
    const dir = requireDir();
    const safeName = sanitizeFilename(filename);
    const from = path.posix.join(dir, safeName);
    const to = path.posix.join(dir, enable ? toEnabledName(safeName) : toDisabledName(safeName));
    if (from === to) return;
    await fileManagerService.rename(from, to);
    metaCache.delete(from);
  }

  async delete(filename: string): Promise<void> {
    const dir = requireDir();
    const filePath = path.posix.join(dir, sanitizeFilename(filename));
    await fileManagerService.delete(filePath);
    metaCache.delete(filePath);
  }

  private validateJarBuffer(filename: string, buffer: Buffer): void {
    if (!filename.toLowerCase().endsWith('.jar')) {
      throw new Error('Only .jar files can be installed as plugins');
    }
    if (buffer.length < 4 || !buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
      throw new Error(`"${filename}" doesn't look like a valid .jar file`);
    }
    if (buffer.length > env.plugins.maxJarSize) {
      throw new Error(
        `"${filename}" is too large (${buffer.length} bytes, limit ${env.plugins.maxJarSize})`,
      );
    }
  }

  async installFromBuffer(filename: string, buffer: Buffer): Promise<PluginInfo> {
    const dir = requireDir();
    const safeName = sanitizeFilename(filename);
    this.validateJarBuffer(safeName, buffer);
    const destPath = path.posix.join(dir, safeName);
    await fileManagerService.writeBuffer(destPath, buffer);

    const meta = readPluginMeta(buffer);
    const stat = await fileManagerService.stat(destPath);
    metaCache.set(destPath, { size: stat.size, modifiedAt: stat.modifiedAt, meta });

    return {
      filename: safeName,
      path: destPath,
      size: stat.size,
      modifiedAt: stat.modifiedAt,
      enabled: true,
      name: meta?.name ?? null,
      version: meta?.version ?? null,
      author: meta?.author ?? null,
      description: meta?.description ?? null,
    };
  }

  async installFromUrl(url: string): Promise<PluginInfo> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Not a valid URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Only http(s) URLs are supported');
    }

    const filename = decodeURIComponent(path.posix.basename(parsed.pathname));
    if (!filename.toLowerCase().endsWith('.jar')) {
      throw new Error('The URL must point directly to a .jar file');
    }

    let response: Response;
    try {
      response = await fetch(parsed, { redirect: 'follow' });
    } catch (err) {
      throw new Error(`Failed to download: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!response.ok) {
      throw new Error(`Failed to download: HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > env.plugins.maxJarSize) {
      throw new Error(`File is too large (${contentLength} bytes, limit ${env.plugins.maxJarSize})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return this.installFromBuffer(filename, buffer);
  }
}

export const pluginsService = new PluginsService();
