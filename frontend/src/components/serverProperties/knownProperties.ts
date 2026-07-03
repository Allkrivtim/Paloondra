export type PropType = 'text' | 'number' | 'boolean' | 'select';

export interface PropMeta {
  key: string;
  type: PropType;
  options?: string[];
}

// A friendly-form covers the most commonly tweaked keys. Anything else in
// the file (or anything you add) falls into the "Other properties" section
// below, so nothing in an existing server.properties is ever hidden or lost
// - rcon.* keys are deliberately excluded from this list so editing them
// here doesn't create the false impression it also updates Paloondra's own
// RCON_HOST/RCON_PORT/RCON_PASSWORD in .env (it doesn't - those are separate).
// Labels live in i18n (propertyKeys.<key>) rather than here, so they're
// translated along with the rest of the UI.
export const KNOWN_PROPERTIES: PropMeta[] = [
  { key: 'motd', type: 'text' },
  { key: 'difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
  { key: 'gamemode', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
  { key: 'max-players', type: 'number' },
  { key: 'online-mode', type: 'boolean' },
  { key: 'white-list', type: 'boolean' },
  { key: 'pvp', type: 'boolean' },
  { key: 'hardcore', type: 'boolean' },
  { key: 'spawn-protection', type: 'number' },
  { key: 'view-distance', type: 'number' },
  { key: 'simulation-distance', type: 'number' },
  { key: 'level-seed', type: 'text' },
  { key: 'level-name', type: 'text' },
  {
    key: 'level-type',
    type: 'select',
    options: ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified'],
  },
  { key: 'allow-nether', type: 'boolean' },
  { key: 'allow-flight', type: 'boolean' },
  { key: 'enable-command-block', type: 'boolean' },
  { key: 'force-gamemode', type: 'boolean' },
  { key: 'spawn-monsters', type: 'boolean' },
  { key: 'spawn-animals', type: 'boolean' },
  { key: 'spawn-npcs', type: 'boolean' },
  { key: 'generate-structures', type: 'boolean' },
  { key: 'server-port', type: 'number' },
];

export const KNOWN_KEYS = new Set(KNOWN_PROPERTIES.map((p) => p.key));
