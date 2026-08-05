import { LuckPermsNode } from '../../types';

// LuckPerms encodes group inheritance, prefixes/suffixes, custom meta,
// weight, and display name as structured strings inside a Node's `key` -
// see the LuckPermsNode doc comment in types/index.ts. These helpers are
// the single place that string format is built/parsed, so the rest of the
// LuckPerms UI never has to think about it directly.

export function buildInheritanceKey(groupName: string): string {
  return `group.${groupName}`;
}

export function parseInheritanceKey(key: string): string | null {
  const m = /^group\.(.+)$/s.exec(key);
  return m ? m[1] : null;
}

export function buildPrefixSuffixKey(kind: 'prefix' | 'suffix', priority: number, text: string): string {
  return `${kind}.${priority}.${text}`;
}

/** Not .trim()'d anywhere in this parse - leading/trailing spaces in `text` are meaningful (they separate the prefix/suffix from the player's name in chat). */
export function parsePrefixSuffixKey(key: string): { priority: number; text: string } | null {
  const m = /^(?:prefix|suffix)\.(-?\d+)\.(.*)$/s.exec(key);
  if (!m) return null;
  return { priority: parseInt(m[1], 10), text: m[2] };
}

export function buildMetaKey(metaKey: string, metaValue: string): string {
  return `meta.${metaKey}.${metaValue}`;
}

/** Assumes the meta key itself has no dots (standard LuckPerms convention) - everything after the second dot is the value, dots included. */
export function parseMetaKey(key: string): { metaKey: string; metaValue: string } | null {
  const m = /^meta\.([^.]+)\.(.*)$/s.exec(key);
  if (!m) return null;
  return { metaKey: m[1], metaValue: m[2] };
}

export function buildWeightKey(weight: number): string {
  return `weight.${weight}`;
}

export function parseWeightKey(key: string): number | null {
  const m = /^weight\.(-?\d+)$/.exec(key);
  return m ? parseInt(m[1], 10) : null;
}

export function buildDisplayNameKey(name: string): string {
  return `displayname.${name}`;
}

export function parseDisplayNameKey(key: string): string | null {
  const m = /^displayname\.(.+)$/s.exec(key);
  return m ? m[1] : null;
}

// --- Node categorization, for splitting one Node[] into the editor's tabs ---

export function isPermissionNode(n: LuckPermsNode): boolean {
  return n.type === 'permission' || n.type === 'regex_permission';
}

export function isParentNode(n: LuckPermsNode): boolean {
  return n.type === 'inheritance';
}

export function isChatMetaNode(n: LuckPermsNode): boolean {
  return n.type === 'prefix' || n.type === 'suffix';
}

export function isMetaNode(n: LuckPermsNode): boolean {
  return n.type === 'meta';
}

// --- Expiry: stored as unix seconds, edited as a <input type="datetime-local"> value ---

export function expiryToDatetimeLocal(expiry: number | undefined): string {
  if (!expiry) return '';
  const d = new Date(expiry * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function datetimeLocalToExpiry(value: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

export function formatExpiry(expiry: number | undefined): string | null {
  if (!expiry) return null;
  return new Date(expiry * 1000).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function isExpired(expiry: number | undefined): boolean {
  return !!expiry && expiry * 1000 < Date.now();
}

/** Human-readable label for any node, regardless of type - used by the search results view, where nodes from every category can appear side by side. Mirrors how each individual panel (Permissions/Parents/ChatMeta/Meta) already labels its own rows. */
export function describeNode(node: LuckPermsNode): string {
  switch (node.type) {
    case 'inheritance':
      return parseInheritanceKey(node.key) ?? node.key;
    case 'prefix':
    case 'suffix': {
      const parsed = parsePrefixSuffixKey(node.key);
      return parsed ? `[${node.type} ${parsed.priority}] ${parsed.text}` : node.key;
    }
    case 'meta': {
      const parsed = parseMetaKey(node.key);
      return parsed ? `${parsed.metaKey} = ${parsed.metaValue}` : node.key;
    }
    default:
      return node.key;
  }
}
