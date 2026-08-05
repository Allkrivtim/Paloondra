export type ScriptName = 'start' | 'stop' | 'restart' | 'backup';

export interface ConsoleLine {
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
  timestamp: number;
}

export interface MetricsSample {
  timestamp: number;
  players: {
    online: number;
    max: number | null;
    names: string[];
  } | null;
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

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size: number;
  permissions: string;
  modifiedAt: number;
}

/**
 * Implemented by both the plain-SFTP service and the sudo-exec fallback
 * service, so routes never need to know which transport is in use.
 */
export interface FileManagerService {
  isConnected(): boolean;
  start(): void;
  list(dirPath: string): Promise<FileEntry[]>;
  stat(targetPath: string): Promise<FileEntry>;
  mkdir(dirPath: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  delete(targetPath: string): Promise<void>;
  readTextFile(filePath: string, maxSize: number): Promise<string>;
  writeTextFile(filePath: string, content: string): Promise<void>;
  writeBuffer(filePath: string, data: Buffer): Promise<void>;
  /** Reads a whole file into memory as raw bytes (jars, other binaries) - unlike readTextFile, never rejects binary content. */
  readBuffer(filePath: string, maxSize?: number): Promise<Buffer>;
  /** Streams a file's contents without buffering it fully in memory (used for downloads). */
  createReadStream(filePath: string): Promise<NodeJS.ReadableStream>;
  /** Resolves the SSH login user's home directory - used as the SFTP fallback default path. */
  resolveHome(): Promise<string>;
}

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

export interface PluginInfo {
  /** Filename on disk, including .disabled suffix if present. */
  filename: string;
  path: string;
  size: number;
  modifiedAt: number;
  enabled: boolean;
  /** Parsed from plugin.yml inside the jar; null if unreadable/missing. */
  name: string | null;
  version: string | null;
  author: string | null;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Scheduled tasks
// ---------------------------------------------------------------------------

export type ScheduledTaskType = 'restart' | 'rcon';

export interface ScheduledTask {
  id: string;
  name: string;
  /** Standard 5-field cron expression, evaluated in the backend's local timezone. */
  schedule: string;
  type: ScheduledTaskType;
  /** Required when type is 'rcon'; ignored for 'restart'. */
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
// Users (admin-managed panel accounts - not Minecraft players/ops)
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'user';

/**
 * Granular per-feature access, checked only for role: 'user' accounts -
 * admins always bypass this (see requireAdmin/requirePermission). Each key
 * roughly maps to one nav tab, except `serverControl`, which has no tab of
 * its own: it gates the start/stop/restart buttons on the Dashboard plus
 * the RCON-backed quick actions (kick/ban/op/whitelist-add/broadcast)
 * embedded in it.
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
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const ALL_PERMISSIONS: PermissionKey[] = [...PERMISSION_KEYS];

export function isValidPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Persisted shape, including the bcrypt hash - never sent to the frontend as-is, see PublicUser. */
export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  /**
   * Always fully populated, even for admins (who get ALL_PERMISSIONS but
   * have the check bypassed entirely) - this way demoting an admin to
   * 'user' naturally preserves full access instead of silently locking
   * them out, with no special-case migration needed.
   */
  permissions: PermissionKey[];
  /**
   * Optional further restriction of the `sftp` permission (File Manager)
   * to one directory subtree, e.g. "/home/minecraft/server/plugins" - null
   * means unrestricted (the historical behavior: anywhere SSH_USER/sudo
   * can reach). Always null for admins, same rationale as `permissions`.
   * Irrelevant if `permissions` doesn't include `sftp` at all.
   */
  sftpRootPath: string | null;
  createdAt: number;
}

/** What GET/POST/etc. on /api/users actually return - the hash is stripped. */
export type PublicUser = Omit<StoredUser, 'passwordHash'>;

// ---------------------------------------------------------------------------
// LuckPerms (optional - talks to the separately-deployed LuckPerms REST API
// extension, NOT part of LuckPerms itself - see luckperms.service.ts and
// README's LuckPerms section). Mirrors https://github.com/LuckPerms/rest-api's
// OpenAPI schema, verified directly against its spec rather than guessed.
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
 * LuckPerms encodes everything - permissions, group inheritance, prefixes/
 * suffixes, custom meta, weight, display name - as one unified Node system.
 * `type` is inferred server-side from `key`'s format, not sent by clients:
 *   - permission:    key = the raw permission string, e.g. "minecraft.command.ban"
 *   - inheritance:   key = "group.<name>"
 *   - prefix/suffix: key = "prefix.<priority>.<text>" / "suffix.<priority>.<text>"
 *   - meta:          key = "meta.<metaKey>.<metaValue>"
 *   - weight:        key = "weight.<number>"
 *   - display_name:  key = "displayname.<name>"
 * `value` is the standard enabled/disabled flag (true for nearly every node
 * that isn't a permission explicitly being negated).
 */
export interface LuckPermsNode {
  key: string;
  type: LuckPermsNodeType;
  value: boolean;
  context: LuckPermsContext[];
  /** Unix seconds; absent/0 means permanent. */
  expiry?: number;
}

/** Body for adding/deleting nodes - same shape as LuckPermsNode minus the server-derived `type`. */
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

/** `result` is a string enum, not a boolean, per the REST API's own schema. */
export interface LuckPermsPermissionCheckResult {
  result: 'true' | 'false' | 'undefined';
  node?: LuckPermsNode;
}
