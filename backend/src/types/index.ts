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
