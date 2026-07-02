import dotenv from 'dotenv';

dotenv.config();

const errors: string[] = [];

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    errors.push(`${name} is required but not set`);
    return '';
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

function optionalInt(name: string, fallback: number, opts?: { min?: number; max?: number }): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  const value = parseInt(raw, 10);
  if (Number.isNaN(value)) {
    errors.push(`${name} must be a number, got "${raw}"`);
    return fallback;
  }
  if (opts?.min !== undefined && value < opts.min) {
    errors.push(`${name} must be >= ${opts.min}, got ${value}`);
    return fallback;
  }
  if (opts?.max !== undefined && value > opts.max) {
    errors.push(`${name} must be <= ${opts.max}, got ${value}`);
    return fallback;
  }
  return value;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw || raw.trim() === '') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  errors.push(`${name} must be a boolean (true/false), got "${raw}"`);
  return fallback;
}

export interface AppUserConfig {
  username: string;
  passwordHash: string;
}

function parseUsers(raw: string): AppUserConfig[] {
  if (!raw) return [];

  const users = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf(':');
      if (idx === -1) {
        errors.push(`Invalid USERS entry (expected username:bcrypt_hash): "${entry}"`);
        return null;
      }
      const username = entry.slice(0, idx).trim();
      const passwordHash = entry.slice(idx + 1).trim();
      if (!username || !passwordHash) {
        errors.push(`Invalid USERS entry (expected username:bcrypt_hash): "${entry}"`);
        return null;
      }
      if (!passwordHash.startsWith('$2a$') && !passwordHash.startsWith('$2b$') && !passwordHash.startsWith('$2y$')) {
        errors.push(
          `USERS entry for "${username}" doesn't look like a bcrypt hash. Generate one with "npm run hash -- <password>".`,
        );
        return null;
      }
      return { username, passwordHash };
    })
    .filter((u): u is AppUserConfig => u !== null);

  if (users.length === 0) {
    errors.push('USERS must contain at least one valid username:bcrypt_hash pair');
  }
  return users;
}

const sshPassword = process.env.SSH_PASSWORD || undefined;
const sshKeyPath = process.env.SSH_KEY_PATH || undefined;

export const env = {
  port: optionalInt('PORT', 4000, { min: 1, max: 65535 }),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:5173'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '12h'),
  users: parseUsers(required('USERS')),

  // Scripts live on the target server (not the machine running this
  // backend) and run over the same SSH connection as the terminal/SFTP,
  // as `cd <scriptsDir> && ./<filename>` - see ssh.service.ts /
  // scripts.service.ts.
  scriptsDir: required('SCRIPTS_DIR'),
  scripts: {
    start: optional('START_SCRIPT', 'start.sh'),
    stop: optional('STOP_SCRIPT', 'stop.sh'),
    restart: optional('RESTART_SCRIPT', 'restart.sh'),
    backup: optional('BACKUP_SCRIPT', 'backup.sh'),
  },

  rcon: {
    host: required('RCON_HOST'),
    port: optionalInt('RCON_PORT', 25575, { min: 1, max: 65535 }),
    password: required('RCON_PASSWORD'),
  },

  ssh: {
    host: required('SSH_HOST'),
    port: optionalInt('SSH_PORT', 22, { min: 1, max: 65535 }),
    user: required('SSH_USER'),
    password: sshPassword,
    privateKeyPath: sshKeyPath,
    passphrase: process.env.SSH_KEY_PASSPHRASE || undefined,
  },

  sftp: {
    // Directory the file manager opens by default. Falls back to the SSH
    // user's home directory if unset or if the path turns out to be invalid.
    defaultPath: process.env.SFTP_DEFAULT_PATH?.trim() || undefined,
    // When the SSH login user doesn't own the Minecraft server's files,
    // file operations can be routed through `sudo` over the SSH exec
    // channel instead of the raw SFTP subsystem. See README for the
    // required /etc/sudoers.d/ entry.
    useSudo: optionalBool('SFTP_USE_SUDO', false),
    sudoPath: optional('SUDO_PATH', '/usr/bin/sudo'),
  },

  metrics: {
    intervalMs: optionalInt('METRICS_INTERVAL_MS', 5000, { min: 1000 }),
    historySize: optionalInt('METRICS_HISTORY_SIZE', 120, { min: 1 }),
  },

  editor: {
    maxFileSize: optionalInt('EDITOR_MAX_FILE_SIZE', 2 * 1024 * 1024, { min: 1 }),
  },
};

if (!sshPassword && !sshKeyPath) {
  errors.push('Either SSH_PASSWORD or SSH_KEY_PATH must be set');
}

if (errors.length > 0) {
  const message = [
    '',
    'Invalid configuration - fix the following in your .env before starting Paloondra:',
    ...errors.map((e) => `  - ${e}`),
    '',
    'See backend/.env.example for a fully documented reference.',
    '',
  ].join('\n');
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(1);
}
