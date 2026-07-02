/**
 * Minimal Java .properties reader/writer for server.properties. Deliberately
 * simple (no unicode \\uXXXX escape handling, no line continuations) since
 * Minecraft's own server.properties never uses those - just `key=value`
 * lines and `#comment` lines.
 */

export function parseProperties(raw: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    values[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return values;
}

/**
 * Rewrites `raw`, replacing the value of every key present in `updates` in
 * place (preserving comments/ordering/untouched keys) and appending any
 * keys from `updates` that don't already exist in `raw`.
 */
export function applyProperties(raw: string, updates: Record<string, string>): string {
  const remaining = new Map(Object.entries(updates));
  const lines = raw.split(/\r?\n/);

  const outLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) return line;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return line;
    const key = trimmed.slice(0, idx).trim();
    if (!remaining.has(key)) return line;
    const value = remaining.get(key)!;
    remaining.delete(key);
    return `${key}=${value}`;
  });

  for (const [key, value] of remaining) {
    outLines.push(`${key}=${value}`);
  }

  return outLines.join('\n');
}
