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

export interface RconLogEntry {
  id: string;
  command: string;
  response?: string;
  error?: string;
  timestamp: number;
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
