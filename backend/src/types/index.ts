export type ScriptName = 'start' | 'stop' | 'restart';

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
