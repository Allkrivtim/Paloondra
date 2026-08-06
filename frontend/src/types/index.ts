export type ScriptName = 'start' | 'stop' | 'restart';

export interface ConsoleLine {
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
  timestamp: number;
}

export interface PlayersInfo {
  online: number;
  max: number | null;
  names: string[];
}

export interface MetricsSample {
  timestamp: number;
  players: PlayersInfo | null;
  tps: number | null;
  cpuLoadPct: number | null;
  memUsedMB: number | null;
  memTotalMB: number | null;
  diskUsedPct: number | null;
}

export interface ServerStatus {
  online: boolean;
  rconConnected: boolean;
  lastChecked: number;
}

export interface SftpEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  permissions: string;
  modifiedAt: number;
}

export interface GameConsoleStatus {
  configured: boolean;
  following: boolean;
  lastError: string | null;
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

export interface PluginInfo {
  filename: string;
  path: string;
  size: number;
  modifiedAt: number;
  enabled: boolean;
  name: string | null;
  version: string | null;
  author: string | null;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Modrinth
// ---------------------------------------------------------------------------

export interface ModrinthSearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  categories: string[];
  versions: string[];
  downloads: number;
  icon_url: string | null;
  latest_version: string;
}

export interface ModrinthSearchResponse {
  hits: ModrinthSearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

export interface ModrinthVersionFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

export interface ModrinthVersionDependency {
  project_id: string | null;
  version_id: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  changelog: string | null;
  game_versions: string[];
  loaders: string[];
  version_type: 'release' | 'beta' | 'alpha';
  dependencies: ModrinthVersionDependency[];
  files: ModrinthVersionFile[];
  date_published: string;
}

export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  categories: string[];
  game_versions: string[];
  loaders: string[];
  downloads: number;
  followers: number;
  icon_url: string | null;
  source_url: string | null;
  issues_url: string | null;
  wiki_url: string | null;
  license?: { id: string; name: string } | null;
}

// ---------------------------------------------------------------------------
// Scheduled tasks
// ---------------------------------------------------------------------------

export type ScheduledTaskType = 'restart' | 'rcon';

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  type: ScheduledTaskType;
  command: string | null;
  enabled: boolean;
  createdAt: number;
  lastRunAt: number | null;
  lastRunResult: string | null;
}

export type ScheduledTaskInput = Pick<ScheduledTask, 'name' | 'schedule' | 'type' | 'command' | 'enabled'>;

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  username: string;
  action: string;
  details: string | null;
}

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  modifiedAt: number;
}

// ---------------------------------------------------------------------------
// Server Config: bukkit.yml / spigot.yml
// ---------------------------------------------------------------------------

export type ServerFileKey = 'bukkit' | 'spigot';

// ---------------------------------------------------------------------------
// Whitelist
// ---------------------------------------------------------------------------

export interface WhitelistEntry {
  uuid: string;
  name: string;
}

export interface WhitelistDocument {
  enabled: boolean;
  entries: WhitelistEntry[];
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

export interface OpEntry {
  uuid: string;
  name: string;
  level: number;
  bypassesPlayerLimit: boolean;
}

// ---------------------------------------------------------------------------
// MOTD (BetterMOTD plugin config.yml)
// ---------------------------------------------------------------------------
// Mirrors backend's motd.service.ts KNOWN_TOP_LEVEL_KEYS. config.yml's own
// shape is nested and dynamic (profile names and preset arrays are up to
// the user), so this is a partial, hand-kept-in-sync shape - not a full
// schema - matching every field this tab's form actually edits.

export interface MotdPresetConditions {
  hostnames?: string[];
  hostnameContains?: string[];
  minProtocol?: number;
  maxProtocol?: number;
  minOnline?: number;
  maxOnline?: number;
}

export interface MotdPreset {
  id: string;
  weight?: number;
  icon?: string;
  icons?: string[];
  conditions?: MotdPresetConditions;
  motd: string[];
}

export interface MotdFakePlayers {
  enabled: boolean;
  mode: 'static' | 'random' | 'percent';
  value: string;
}

export interface MotdJustXMore {
  enabled: boolean;
  x: number;
}

export interface MotdMaxPlayersOverride {
  enabled: boolean;
  value: number;
}

export interface MotdPlayerCount {
  disableHover?: boolean;
  hidePlayerCount?: boolean;
  hoverLines?: string[];
  fakePlayers?: MotdFakePlayers;
  justXMore?: MotdJustXMore;
  maxPlayers?: MotdMaxPlayersOverride;
}

export type MotdSelectionMode = 'RANDOM' | 'STICKY_PER_IP' | 'HASHED_PER_IP' | 'ROTATE';

export interface MotdProfile {
  selectionMode?: MotdSelectionMode;
  stickyTtlSeconds?: number;
  stickyMaxEntriesPerProfile?: number;
  stickyCleanupEveryNPings?: number;
  playerCount?: MotdPlayerCount;
  presets: MotdPreset[];
}

export interface MotdMaintenance {
  enabled: boolean;
  profile?: string;
  bypassPermission?: string;
  kickMessage?: string;
}

export interface MotdValues {
  colorFormat?: string;
  activeProfile?: string;
  placeholders?: { enabled: boolean };
  placeholderAPI?: { enabled: boolean };
  maintenance?: MotdMaintenance;
  debug?: { selfTest: boolean; verbose: boolean };
  profiles?: Record<string, MotdProfile>;
  motdFrames?: string[];
}

export interface MotdReloadOutcome {
  response?: string;
  error?: string;
}

export interface MotdDocument {
  path: string;
  raw: string;
  values: MotdValues;
  reload?: MotdReloadOutcome;
}

// ---------------------------------------------------------------------------
// Users (admin-managed panel accounts - not Minecraft players/ops)
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'user';

/**
 * Mirrors backend/src/types/index.ts's PERMISSION_KEYS exactly - keep in
 * sync by hand. Each key roughly maps to one nav tab, except
 * `serverControl`, which gates the Dashboard's start/stop/restart buttons
 * and its embedded RCON quick actions (kick/ban/op/whitelist-add/
 * broadcast) instead of a tab of its own.
 */
export const PERMISSION_KEYS = [
  'console',
  'ssh',
  'sftp',
  'plugins',
  'backups',
  'scheduler',
  'serverConfig',
  'whitelist',
  'ops',
  'motd',
  'serverControl',
  'luckperms',
  'drasl',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface AppUser {
  id: string;
  username: string;
  role: UserRole;
  permissions: PermissionKey[];
  /** Further restricts the `sftp` permission (File Manager) to one directory subtree - null means unrestricted. Always null for admins. */
  sftpRootPath: string | null;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// LuckPerms (optional - talks to the separately-deployed LuckPerms REST API
// extension via the backend proxy, see backend/src/services/luckperms.service.ts)
// ---------------------------------------------------------------------------

export type LuckPermsNodeType =
  | 'permission'
  | 'regex_permission'
  | 'inheritance'
  | 'prefix'
  | 'suffix'
  | 'meta'
  | 'weight'
  | 'display_name';

export interface LuckPermsContext {
  key: string;
  value: string;
}

/**
 * Everything - permissions, group inheritance, prefixes/suffixes, custom
 * meta, weight, display name - is one unified Node system; `type` is
 * inferred server-side from `key`'s format:
 *   - permission:    key = the raw permission string, e.g. "minecraft.command.ban"
 *   - inheritance:   key = "group.<name>"
 *   - prefix/suffix: key = "prefix.<priority>.<text>" / "suffix.<priority>.<text>"
 *   - meta:          key = "meta.<metaKey>.<metaValue>"
 *   - weight:        key = "weight.<number>"
 *   - display_name:  key = "displayname.<name>"
 * See components/luckperms/nodeFormat.ts for the parse/build helpers.
 */
export interface LuckPermsNode {
  key: string;
  type: LuckPermsNodeType;
  value: boolean;
  context: LuckPermsContext[];
  /** Unix seconds; absent/0 means permanent. */
  expiry?: number;
}

export interface LuckPermsNewNode {
  key: string;
  value?: boolean;
  context?: LuckPermsContext[];
  expiry?: number;
}

export interface LuckPermsMetadata {
  meta: Record<string, string>;
  prefix?: string;
  suffix?: string;
  primaryGroup?: string;
}

export interface LuckPermsUser {
  uniqueId: string;
  username?: string;
  parentGroups: string[];
  nodes: LuckPermsNode[];
  metadata: LuckPermsMetadata;
}

export interface LuckPermsGroup {
  name: string;
  displayName?: string;
  weight?: number;
  nodes: LuckPermsNode[];
  metadata: LuckPermsMetadata;
}

export interface LuckPermsTrack {
  name: string;
  groups: string[];
}

export interface LuckPermsPermissionCheckResult {
  result: 'true' | 'false' | 'undefined';
  node?: LuckPermsNode;
}

/** The `type` filter for search deliberately excludes plain "permission" - that's the REST API's own enum. Search with no `type` still matches permission nodes (and everything else) by key/keyStartsWith. */
export type LuckPermsSearchNodeType = Exclude<LuckPermsNodeType, 'permission'>;

export interface LuckPermsSearchParams {
  /** Exactly one of key/keyStartsWith is required by the REST API. */
  key?: string;
  keyStartsWith?: string;
  metaKey?: string;
  type?: LuckPermsSearchNodeType;
}

export interface LuckPermsUserSearchResult {
  uniqueId: string;
  results: LuckPermsNode[];
}

export interface LuckPermsGroupSearchResult {
  name: string;
  results: LuckPermsNode[];
}

// ---------------------------------------------------------------------------
// Drasl (optional - talks to Drasl's own admin API via the backend proxy,
// see backend/src/services/drasl.service.ts). Scoped to user accounts and
// invites only - see README's Drasl section.
// ---------------------------------------------------------------------------

export interface DraslUser {
  uuid: string;
  username: string;
  isAdmin: boolean;
  isLocked: boolean;
  maxPlayerCount: number;
  preferredLanguage: string;
  players: { uuid: string; name: string }[];
}

export interface DraslCreateUserRequest {
  username: string;
  password?: string;
  isAdmin: boolean;
  isLocked: boolean;
  maxPlayerCount?: number;
}

export interface DraslUpdateUserRequest {
  password?: string;
  isAdmin?: boolean;
  isLocked?: boolean;
  maxPlayerCount?: number;
  resetApiToken?: boolean;
}

export interface DraslInvite {
  code: string;
  url: string;
  createdAt: string;
}
