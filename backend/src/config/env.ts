import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

export interface AppUserConfig {
  username: string;
  passwordHash: string;
}

function parseUsers(raw: string): AppUserConfig[] {
  const users = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf(':');
      if (idx === -1) {
        throw new Error(`Invalid USERS entry (expected username:bcrypt_hash): "${entry}"`);
      }
      const username = entry.slice(0, idx).trim();
      const passwordHash = entry.slice(idx + 1).trim();
      if (!username || !passwordHash) {
        throw new Error(`Invalid USERS entry (expected username:bcrypt_hash): "${entry}"`);
      }
      return { username, passwordHash };
    });

  if (users.length === 0) {
    throw new Error('USERS must contain at least one username:bcrypt_hash pair');
  }
  return users;
}

export const env = {
  port: parseInt(optional('PORT', '4000'), 10),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:5173'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: optional('JWT_EXPIRES_IN', '12h'),
  users: parseUsers(required('USERS')),

  scripts: {
    start: path.resolve(required('START_SCRIPT')),
    stop: path.resolve(required('STOP_SCRIPT')),
    restart: path.resolve(required('RESTART_SCRIPT')),
  },

  rcon: {
    host: required('RCON_HOST'),
    port: parseInt(optional('RCON_PORT', '25575'), 10),
    password: required('RCON_PASSWORD'),
  },

  ssh: {
    host: required('SSH_HOST'),
    port: parseInt(optional('SSH_PORT', '22'), 10),
    user: required('SSH_USER'),
    password: process.env.SSH_PASSWORD || undefined,
    privateKeyPath: process.env.SSH_KEY_PATH || undefined,
    passphrase: process.env.SSH_KEY_PASSPHRASE || undefined,
  },

  metrics: {
    intervalMs: parseInt(optional('METRICS_INTERVAL_MS', '5000'), 10),
    historySize: parseInt(optional('METRICS_HISTORY_SIZE', '120'), 10),
  },

  editor: {
    maxFileSize: parseInt(optional('EDITOR_MAX_FILE_SIZE', '2097152'), 10),
  },
};

if (!env.ssh.password && !env.ssh.privateKeyPath) {
  throw new Error('Either SSH_PASSWORD or SSH_KEY_PATH must be set');
}
