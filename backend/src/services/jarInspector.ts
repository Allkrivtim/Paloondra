import AdmZip from 'adm-zip';
import YAML from 'yaml';

export interface JarPluginMeta {
  name: string | null;
  version: string | null;
  author: string | null;
  description: string | null;
}

// Bukkit/Spigot plugins use plugin.yml; modern Paper "plugin bootstrap" jars
// use paper-plugin.yml with a near-identical schema. Try both.
const CANDIDATE_ENTRIES = ['plugin.yml', 'paper-plugin.yml'];

/**
 * Reads plugin.yml (or paper-plugin.yml) out of a plugin jar's zip
 * structure to get its real name/version/author/description. Returns null
 * if the jar isn't a valid zip, neither file is present, or neither
 * parses into something usable - callers should fall back to the filename.
 */
export function readPluginMeta(jarBuffer: Buffer): JarPluginMeta | null {
  let zip: AdmZip;
  try {
    zip = new AdmZip(jarBuffer);
  } catch {
    return null;
  }

  for (const entryName of CANDIDATE_ENTRIES) {
    let raw: Buffer | null;
    try {
      raw = zip.readFile(entryName);
    } catch {
      raw = null;
    }
    if (!raw) continue;

    try {
      const parsed: unknown = YAML.parse(raw.toString('utf8'));
      if (!parsed || typeof parsed !== 'object') continue;
      const p = parsed as Record<string, unknown>;

      const authorField = p.author ?? (Array.isArray(p.authors) ? p.authors.join(', ') : p.authors);

      return {
        name: typeof p.name === 'string' ? p.name : null,
        version: typeof p.version === 'string' ? p.version : null,
        author: typeof authorField === 'string' ? authorField : null,
        description: typeof p.description === 'string' ? p.description : null,
      };
    } catch {
      // Malformed YAML in this candidate - try the next one, if any.
      continue;
    }
  }

  return null;
}
