import { ServerFileKey } from '../../types';

export type ServerFieldType = 'boolean' | 'number' | 'string' | 'enum';

export interface ServerFieldMeta {
  /** Dotted path into the YAML tree, e.g. "world-settings.default.merge-radius.exp". */
  path: string;
  type: ServerFieldType;
  options?: string[];
  default: string | number | boolean;
}

export interface ServerFieldSection {
  /** Used to build both the section heading i18n key and, combined with each field's path, its label/description keys. */
  id: string;
  fields: ServerFieldMeta[];
}

// Field paths and types are kept in sync by hand with backend/src/services/
// serverYamlFields.ts's KNOWN_FIELDS - that's the allowlist actually used to
// read/write the file; this file adds i18n labels/descriptions/defaults the
// backend doesn't need. Labels/descriptions live in i18n under
// serverConfig.fields.<bukkit|spigot>.<path with '.' replaced by '__'>.
export const BUKKIT_SECTIONS: ServerFieldSection[] = [
  {
    id: 'settings',
    fields: [
      { path: 'settings.allow-end', type: 'boolean', default: true },
      { path: 'settings.warn-on-overload', type: 'boolean', default: true },
      { path: 'settings.permissions-file', type: 'string', default: 'permissions.yml' },
      { path: 'settings.update-folder', type: 'string', default: 'update' },
      { path: 'settings.plugin-profiling', type: 'boolean', default: false },
      { path: 'settings.connection-throttle', type: 'number', default: 4000 },
      { path: 'settings.query-plugins', type: 'boolean', default: true },
      { path: 'settings.deprecated-verbose', type: 'enum', options: ['true', 'false', 'default'], default: 'default' },
      { path: 'settings.shutdown-message', type: 'string', default: 'Server closed' },
      { path: 'settings.minimum-api', type: 'string', default: 'none' },
    ],
  },
  {
    id: 'spawn-limits',
    fields: [
      { path: 'spawn-limits.monsters', type: 'number', default: 70 },
      { path: 'spawn-limits.animals', type: 'number', default: 10 },
      { path: 'spawn-limits.water-animals', type: 'number', default: 15 },
      { path: 'spawn-limits.water-ambient', type: 'number', default: 20 },
      { path: 'spawn-limits.water-underground-creature', type: 'number', default: 5 },
      { path: 'spawn-limits.axolotls', type: 'number', default: 5 },
      { path: 'spawn-limits.ambient', type: 'number', default: 15 },
    ],
  },
  {
    id: 'chunk-gc',
    fields: [{ path: 'chunk-gc.period-in-ticks', type: 'number', default: 600 }],
  },
  {
    id: 'ticks-per',
    fields: [
      { path: 'ticks-per.animal-spawns', type: 'number', default: 400 },
      { path: 'ticks-per.monster-spawns', type: 'number', default: 1 },
      { path: 'ticks-per.water-spawns', type: 'number', default: 1 },
      { path: 'ticks-per.water-ambient-spawns', type: 'number', default: 1 },
      { path: 'ticks-per.water-underground-creature-spawns', type: 'number', default: 1 },
      { path: 'ticks-per.ambient-spawns', type: 'number', default: 1 },
      { path: 'ticks-per.autosave', type: 'number', default: 6000 },
    ],
  },
];

export const SPIGOT_SECTIONS: ServerFieldSection[] = [
  {
    id: 'settings',
    fields: [
      { path: 'settings.bungeecord', type: 'boolean', default: false },
      { path: 'settings.restart-on-crash', type: 'boolean', default: true },
      { path: 'settings.restart-script', type: 'string', default: './start.sh' },
      { path: 'settings.netty-threads', type: 'number', default: 4 },
      { path: 'settings.player-shuffle', type: 'number', default: 0 },
      { path: 'settings.user-cache-size', type: 'number', default: 1000 },
      { path: 'settings.sample-count', type: 'number', default: 12 },
    ],
  },
  {
    id: 'messages',
    fields: [
      { path: 'messages.whitelist', type: 'string', default: 'You are not whitelisted on this server!' },
      { path: 'messages.unknown-command', type: 'string', default: 'Unknown command. Type "/help" for help.' },
      { path: 'messages.server-full', type: 'string', default: 'The server is full!' },
      { path: 'messages.outdated-client', type: 'string', default: 'Outdated client! Please use {0}' },
      { path: 'messages.outdated-server', type: 'string', default: "Outdated server! I'm still on {0}" },
      { path: 'messages.restart', type: 'string', default: 'Server is restarting' },
    ],
  },
  {
    id: 'world-settings',
    fields: [
      // Real spigot.yml ships these as the literal string "default" (meaning
      // "use server.properties' value"), not just an integer or -1 - a
      // number input can't display "default" at all, so these stay text.
      { path: 'world-settings.default.view-distance', type: 'string', default: 10 },
      { path: 'world-settings.default.simulation-distance', type: 'string', default: 10 },
      { path: 'world-settings.default.mob-spawn-range', type: 'number', default: 6 },
      { path: 'world-settings.default.chunks-per-tick', type: 'number', default: 650 },
      { path: 'world-settings.default.item-despawn-rate', type: 'number', default: 6000 },
      { path: 'world-settings.default.arrow-despawn-rate', type: 'number', default: 1200 },
      { path: 'world-settings.default.nerf-spawner-mobs', type: 'boolean', default: false },
      { path: 'world-settings.default.merge-radius.exp', type: 'number', default: 3.0 },
      { path: 'world-settings.default.merge-radius.item', type: 'number', default: 2.5 },
      { path: 'world-settings.default.entity-activation-range.animals', type: 'number', default: 32 },
      { path: 'world-settings.default.entity-activation-range.monsters', type: 'number', default: 32 },
      { path: 'world-settings.default.entity-activation-range.raiders', type: 'number', default: 48 },
      { path: 'world-settings.default.entity-activation-range.misc', type: 'number', default: 16 },
      { path: 'world-settings.default.entity-activation-range.water', type: 'number', default: 16 },
      { path: 'world-settings.default.entity-activation-range.villagers', type: 'number', default: 32 },
      { path: 'world-settings.default.entity-tracking-range.players', type: 'number', default: 128 },
      { path: 'world-settings.default.entity-tracking-range.animals', type: 'number', default: 96 },
      { path: 'world-settings.default.entity-tracking-range.monsters', type: 'number', default: 96 },
      { path: 'world-settings.default.entity-tracking-range.misc', type: 'number', default: 96 },
      { path: 'world-settings.default.entity-tracking-range.other', type: 'number', default: 64 },
    ],
  },
];

export const SERVER_FILE_SECTIONS: Record<ServerFileKey, ServerFieldSection[]> = {
  bukkit: BUKKIT_SECTIONS,
  spigot: SPIGOT_SECTIONS,
};

/** Turns a dotted field path into a flat i18n key segment - avoids the path's own dots being read as i18next key nesting. */
export function fieldKeySegment(path: string): string {
  return path.replace(/\./g, '__');
}
