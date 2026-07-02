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
