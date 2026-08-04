import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { readJsonFile, writeJsonFile } from './jsonStore';
import { env } from '../config/env';
import { PublicUser, StoredUser, UserRole } from '../types';

const FILE = 'users.json';
// Matches scripts/hashPassword.ts, so a hand-generated USERS hash and one
// created through the admin UI are indistinguishable.
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

function toPublic(user: StoredUser): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

/**
 * Admin-managed panel accounts (add/remove/change role/reset password from
 * the Users tab), persisted in DATA_DIR/users.json - once this file has at
 * least one user, it's the sole source of truth for login.
 *
 * USERS in .env is only a one-time bootstrap seed (see seedIfEmpty()): it's
 * consulted exactly once, on the very first startup after this feature
 * shipped (or any fresh install), to create the first admin(s) so there's
 * a way to log in before the Users tab has anyone in it. After that,
 * USERS is never read again, even if it's still set.
 */
class UsersService {
  private users: StoredUser[] = [];
  private loaded: Promise<void> | null = null;

  private ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      this.loaded = readJsonFile<StoredUser[]>(FILE, []).then((users) => {
        this.users = users;
      });
    }
    return this.loaded;
  }

  /**
   * Called once at backend startup, after ensureLoaded() would run anyway.
   * A no-op once users.json has anyone in it - USERS is not "extra" admins
   * layered on top, it's strictly a first-run fallback.
   */
  async seedIfEmpty(): Promise<void> {
    await this.ensureLoaded();
    if (this.users.length > 0) return;

    if (env.users.length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        [
          '',
          'No users exist yet and USERS is not set in backend/.env - nobody can log in.',
          'Generate a bcrypt hash with "npm run hash -- <password>", set',
          'USERS=username:hash in backend/.env, and restart to bootstrap the first admin.',
          '',
        ].join('\n'),
      );
      return;
    }

    this.users = env.users.map((u) => ({
      id: randomUUID(),
      username: u.username,
      passwordHash: u.passwordHash,
      role: 'admin' as UserRole,
      createdAt: Date.now(),
    }));
    await this.persist();
    // eslint-disable-next-line no-console
    console.log(
      `Bootstrapped ${this.users.length} admin user(s) from USERS. Manage users from the Users tab from now on - USERS in .env will be ignored on future startups.`,
    );
  }

  async findByUsername(username: string): Promise<StoredUser | undefined> {
    await this.ensureLoaded();
    return this.users.find((u) => u.username === username);
  }

  async list(): Promise<PublicUser[]> {
    await this.ensureLoaded();
    return [...this.users].sort((a, b) => a.createdAt - b.createdAt).map(toPublic);
  }

  private adminCount(): number {
    return this.users.filter((u) => u.role === 'admin').length;
  }

  private validatePassword(password: unknown): asserts password is string {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
  }

  async create(username: string, password: string, role: UserRole): Promise<PublicUser> {
    await this.ensureLoaded();
    const name = username.trim();
    if (!name) throw new Error('Username is required');
    this.validatePassword(password);
    if (this.users.some((u) => u.username === name)) {
      throw new Error(`A user named "${name}" already exists`);
    }

    const user: StoredUser = {
      id: randomUUID(),
      username: name,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role,
      createdAt: Date.now(),
    };
    this.users.push(user);
    await this.persist();
    return toPublic(user);
  }

  /** `requestedByUsername` is the caller's own username, to block self-removal. */
  async remove(id: string, requestedByUsername: string): Promise<void> {
    await this.ensureLoaded();
    const target = this.users.find((u) => u.id === id);
    if (!target) throw new Error('User not found');
    if (target.username === requestedByUsername) {
      throw new Error("You can't remove your own account");
    }
    if (target.role === 'admin' && this.adminCount() <= 1) {
      throw new Error('Cannot remove the last remaining admin');
    }
    this.users = this.users.filter((u) => u.id !== id);
    await this.persist();
  }

  async setRole(id: string, role: UserRole): Promise<PublicUser> {
    await this.ensureLoaded();
    const target = this.users.find((u) => u.id === id);
    if (!target) throw new Error('User not found');
    if (target.role === 'admin' && role === 'user' && this.adminCount() <= 1) {
      throw new Error('Cannot demote the last remaining admin');
    }
    target.role = role;
    await this.persist();
    return toPublic(target);
  }

  async resetPassword(id: string, password: string): Promise<PublicUser> {
    await this.ensureLoaded();
    const target = this.users.find((u) => u.id === id);
    if (!target) throw new Error('User not found');
    this.validatePassword(password);
    target.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.persist();
    return toPublic(target);
  }

  /** Constant-shape credential check - always runs a bcrypt compare, even for an unknown username, so response time doesn't leak whether the account exists. */
  async verifyCredentials(username: string, password: string): Promise<StoredUser | null> {
    await this.ensureLoaded();
    const user = this.users.find((u) => u.username === username);
    if (!user) {
      await bcrypt.compare(password, '$2b$10$0000000000000000000000000000000000000000000000');
      return null;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
  }

  private async persist(): Promise<void> {
    await writeJsonFile(FILE, this.users);
  }
}

export const usersService = new UsersService();
