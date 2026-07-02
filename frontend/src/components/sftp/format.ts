export function joinPath(...parts: string[]): string {
  const joined = parts.join('/').replace(/\/+/g, '/');
  const normalized = joined.startsWith('/') ? joined : `/${joined}`;
  return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
}

export function basename(p: string): string {
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

export function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'yml', 'yaml', 'json', 'properties', 'cfg', 'conf', 'toml', 'ini',
  'log', 'md', 'sh', 'bash', 'xml', 'js', 'ts', 'mcfunction', 'env', 'gitignore',
]);

export function looksLikeTextFile(name: string): boolean {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (!ext) return true; // extensionless config files (README, LICENSE, ...)
  return TEXT_EXTENSIONS.has(ext);
}

export function monacoLanguageFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'xml':
      return 'xml';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'properties':
    case 'cfg':
    case 'conf':
    case 'ini':
    case 'toml':
      return 'ini';
    case 'md':
      return 'markdown';
    default:
      return 'plaintext';
  }
}
