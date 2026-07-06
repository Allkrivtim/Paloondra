import { Document, parseDocument } from 'yaml';
import { ServerFileKey } from '../types';

/**
 * The known, form-editable fields for each file, as dotted paths into the
 * YAML tree (e.g. "world-settings.default.merge-radius.exp" ->
 * ['world-settings', 'default', 'merge-radius', 'exp']). This is the
 * allowlist for both reading values into the form and validating writes -
 * any path not in this list is left completely untouched by the form,
 * whether or not it's present in the file. Keys not covered here (custom
 * additions, plugin-specific config some forks add to these files) are
 * never read or written by the structured form; edit those via Raw mode.
 *
 * Kept in sync by hand with frontend/src/components/serverProperties/
 * knownServerFileFields.ts, which adds the i18n labels/descriptions/
 * defaults this backend doesn't need to know about.
 */
export const KNOWN_FIELDS: Record<ServerFileKey, string[]> = {
  bukkit: [
    'settings.allow-end',
    'settings.warn-on-overload',
    'settings.permissions-file',
    'settings.update-folder',
    'settings.plugin-profiling',
    'settings.connection-throttle',
    'settings.query-plugins',
    'settings.deprecated-verbose',
    'settings.shutdown-message',
    'settings.minimum-api',
    'spawn-limits.monsters',
    'spawn-limits.animals',
    'spawn-limits.water-animals',
    'spawn-limits.water-ambient',
    'spawn-limits.water-underground-creature',
    'spawn-limits.axolotls',
    'spawn-limits.ambient',
    'chunk-gc.period-in-ticks',
    'ticks-per.animal-spawns',
    'ticks-per.monster-spawns',
    'ticks-per.water-spawns',
    'ticks-per.water-ambient-spawns',
    'ticks-per.water-underground-creature-spawns',
    'ticks-per.ambient-spawns',
    'ticks-per.autosave',
  ],
  spigot: [
    'settings.bungeecord',
    'settings.restart-on-crash',
    'settings.restart-script',
    'settings.netty-threads',
    'settings.player-shuffle',
    'settings.user-cache-size',
    'settings.sample-count',
    'messages.whitelist',
    'messages.unknown-command',
    'messages.server-full',
    'messages.outdated-client',
    'messages.outdated-server',
    'messages.restart',
    'world-settings.default.view-distance',
    'world-settings.default.simulation-distance',
    'world-settings.default.mob-spawn-range',
    'world-settings.default.chunks-per-tick',
    'world-settings.default.item-despawn-rate',
    'world-settings.default.arrow-despawn-rate',
    'world-settings.default.nerf-spawner-mobs',
    'world-settings.default.merge-radius.exp',
    'world-settings.default.merge-radius.item',
    'world-settings.default.entity-activation-range.animals',
    'world-settings.default.entity-activation-range.monsters',
    'world-settings.default.entity-activation-range.raiders',
    'world-settings.default.entity-activation-range.misc',
    'world-settings.default.entity-activation-range.water',
    'world-settings.default.entity-activation-range.villagers',
    'world-settings.default.entity-tracking-range.players',
    'world-settings.default.entity-tracking-range.animals',
    'world-settings.default.entity-tracking-range.monsters',
    'world-settings.default.entity-tracking-range.misc',
    'world-settings.default.entity-tracking-range.other',
  ],
};

function toPathArray(dottedPath: string): string[] {
  return dottedPath.split('.');
}

/** Parses `raw` and returns only the known fields actually present in the file, keyed by dotted path. */
export function extractKnownValues(key: ServerFileKey, raw: string): Record<string, unknown> {
  const doc = parseDocument(raw);
  const values: Record<string, unknown> = {};
  for (const dottedPath of KNOWN_FIELDS[key]) {
    const path = toPathArray(dottedPath);
    if (doc.hasIn(path)) {
      values[dottedPath] = doc.getIn(path);
    }
  }
  return values;
}

/**
 * Applies `updates` (dotted path -> new value) to a parsed Document in
 * place, then returns the re-serialized YAML - comments, key ordering, and
 * every key not named in `updates` are preserved exactly as they were,
 * since this only ever mutates the specific nodes named. Throws if any key
 * in `updates` isn't in this file's known-fields allowlist.
 */
export function applyKnownUpdates(key: ServerFileKey, raw: string, updates: Record<string, unknown>): string {
  const allowed = new Set(KNOWN_FIELDS[key]);
  for (const dottedPath of Object.keys(updates)) {
    if (!allowed.has(dottedPath)) {
      throw new Error(`Unknown field "${dottedPath}" for this file`);
    }
  }

  const doc: Document = parseDocument(raw);
  for (const [dottedPath, value] of Object.entries(updates)) {
    doc.setIn(toPathArray(dottedPath), value);
  }
  return doc.toString();
}
