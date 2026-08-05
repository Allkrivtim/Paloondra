import { LuckPermsNode } from '../../types';
import { isMetaNode, isPermissionNode, parseMetaKey } from './nodeFormat';

/**
 * A best-effort "clue" for the Permissions/Meta add-forms, standing in for
 * what the official LuckPerms web editor gets from LuckPerms' own live
 * in-memory permission registry - which the REST API doesn't expose (see
 * README's LuckPerms section), so there's no way to offer the real thing.
 * Instead, this is a module-scoped, in-memory set of every key this
 * session has actually observed - every group/user loaded, every search
 * result - seeded proactively from all groups when the tab opens (see
 * LuckPerms.tsx) so there's something useful even before browsing
 * anything. Resets on page reload; not persisted, not a registry.
 */
const permissionKeys = new Set<string>();
const metaKeys = new Set<string>();

export function recordNodes(nodes: LuckPermsNode[]): void {
  for (const node of nodes) {
    if (isPermissionNode(node)) {
      permissionKeys.add(node.key);
    } else if (isMetaNode(node)) {
      const parsed = parseMetaKey(node.key);
      if (parsed) metaKeys.add(parsed.metaKey);
    }
  }
}

export function getKnownPermissionKeys(): string[] {
  return [...permissionKeys].sort();
}

export function getKnownMetaKeys(): string[] {
  return [...metaKeys].sort();
}
