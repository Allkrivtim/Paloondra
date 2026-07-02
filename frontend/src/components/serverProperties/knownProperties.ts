export type PropType = 'text' | 'number' | 'boolean' | 'select';

export interface PropMeta {
  key: string;
  label: string;
  type: PropType;
  options?: string[];
}

// A friendly-form covers the most commonly tweaked keys. Anything else in
// the file (or anything you add) falls into the "Other properties" section
// below, so nothing in an existing server.properties is ever hidden or lost
// - rcon.* keys are deliberately excluded from this list so editing them
// here doesn't create the false impression it also updates Paloondra's own
// RCON_HOST/RCON_PORT/RCON_PASSWORD in .env (it doesn't - those are separate).
export const KNOWN_PROPERTIES: PropMeta[] = [
  { key: 'motd', label: 'MOTD', type: 'text' },
  { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
  { key: 'gamemode', label: 'Default gamemode', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
  { key: 'max-players', label: 'Max players', type: 'number' },
  { key: 'online-mode', label: 'Online mode (auth)', type: 'boolean' },
  { key: 'white-list', label: 'Whitelist enabled', type: 'boolean' },
  { key: 'pvp', label: 'PvP', type: 'boolean' },
  { key: 'hardcore', label: 'Hardcore', type: 'boolean' },
  { key: 'spawn-protection', label: 'Spawn protection radius', type: 'number' },
  { key: 'view-distance', label: 'View distance', type: 'number' },
  { key: 'simulation-distance', label: 'Simulation distance', type: 'number' },
  { key: 'level-seed', label: 'Level seed', type: 'text' },
  { key: 'level-name', label: 'Level name', type: 'text' },
  {
    key: 'level-type',
    label: 'Level type',
    type: 'select',
    options: ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified'],
  },
  { key: 'allow-nether', label: 'Allow Nether', type: 'boolean' },
  { key: 'allow-flight', label: 'Allow flight', type: 'boolean' },
  { key: 'enable-command-block', label: 'Enable command blocks', type: 'boolean' },
  { key: 'force-gamemode', label: 'Force gamemode on join', type: 'boolean' },
  { key: 'spawn-monsters', label: 'Spawn monsters', type: 'boolean' },
  { key: 'spawn-animals', label: 'Spawn animals', type: 'boolean' },
  { key: 'spawn-npcs', label: 'Spawn NPCs (villagers)', type: 'boolean' },
  { key: 'generate-structures', label: 'Generate structures', type: 'boolean' },
  { key: 'server-port', label: 'Server port', type: 'number' },
];

export const KNOWN_KEYS = new Set(KNOWN_PROPERTIES.map((p) => p.key));
