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
  /** Streams a file's contents without buffering it fully in memory (used for downloads). */
  createReadStream(filePath: string): Promise<NodeJS.ReadableStream>;
  /** Resolves the SSH login user's home directory - used as the SFTP fallback default path. */
  resolveHome(): Promise<string>;
}
