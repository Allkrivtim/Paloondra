import { env } from '../config/env';
import { DraslCreateUserRequest, DraslInvite, DraslUpdateUserRequest, DraslUser } from '../types';

export class DraslApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

// Same rationale as luckperms.service.ts's REQUEST_TIMEOUT_MS - fetch() has
// no connect timeout by default, so a firewalled/wrong DRASL_API_URL would
// otherwise hang for the OS TCP timeout instead of failing fast.
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Thin HTTP client for Drasl's own admin API (/drasl/api/v2) -
 * https://github.com/unmojang/drasl. Scoped to what the Drasl tab actually
 * offers: user accounts and invites - see README's Drasl section for what
 * has to be configured before this works (an admin API token, obtained by
 * logging in once as a Drasl admin).
 */
async function dpFetch<T>(path: string, init?: RequestInit, opts?: { expectBody?: boolean }): Promise<T> {
  if (!env.drasl.apiUrl) {
    throw new DraslApiError('DRASL_API_URL is not configured - set it in backend/.env to use the Drasl tab');
  }
  if (!env.drasl.apiToken) {
    throw new DraslApiError('DRASL_API_TOKEN is not configured - set it in backend/.env to use the Drasl tab');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.drasl.apiToken}`,
    ...(init?.headers as Record<string, string> | undefined),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${env.drasl.apiUrl}/drasl/api/v2${path}`, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new DraslApiError(
        `Timed out after ${REQUEST_TIMEOUT_MS / 1000}s waiting for Drasl's API at ${env.drasl.apiUrl}. ` +
          `A timeout (rather than an immediate connection error) usually means the host/port is unreachable - firewalled, ` +
          `wrong host, or nothing routes there - not that Drasl is just slow. Confirm DRASL_API_URL is correct and reachable ` +
          `from this backend, e.g. "curl ${env.drasl.apiUrl}/drasl/api/v2/swagger.json" run ON THE BACKEND HOST.`,
      );
    }
    throw new DraslApiError(`Could not reach Drasl's API at ${env.drasl.apiUrl}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new DraslApiError("Drasl rejected the request - check DRASL_API_TOKEN is still valid (it's invalidated by resetting it from Drasl's own admin UI).", response.status);
  }
  if (response.status === 404) {
    throw new DraslApiError('Not found.', 404);
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // ignore - fall through to the generic message below
    }
    throw new DraslApiError(`Drasl's API returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`, response.status);
  }

  // DELETE endpoints are documented as 204 No Content - callers for those
  // pass expectBody: false so a real-world deviation from that (like the
  // non-JSON body LuckPerms' own DELETE endpoints turned out to send) can't
  // surface as a spurious "unexpected response" error here too.
  if (opts?.expectBody === false) return undefined as T;

  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new DraslApiError("Drasl's API returned an unexpected (non-JSON) response.");
  }
}

class DraslService {
  /**
   * No dedicated health endpoint. Deliberately hits an authenticated route
   * (/users) rather than the public /swagger.json - unlike LuckPerms' key,
   * DRASL_API_TOKEN is mandatory the moment a URL is set, so a health
   * check that only proved reachability (and not "and the token actually
   * works") would report "healthy" right up until the first real click
   * fails with a 401. This costs one admin-scoped list call instead.
   */
  async health(): Promise<boolean> {
    try {
      await dpFetch('/users');
      return true;
    } catch {
      return false;
    }
  }

  async listUsers(): Promise<DraslUser[]> {
    return dpFetch('/users');
  }

  async getUser(uuid: string): Promise<DraslUser> {
    return dpFetch(`/users/${encodeURIComponent(uuid)}`);
  }

  async createUser(req: DraslCreateUserRequest): Promise<DraslUser> {
    const result = await dpFetch<{ user: DraslUser }>('/users', { method: 'POST', body: JSON.stringify(req) });
    return result.user;
  }

  async updateUser(uuid: string, req: DraslUpdateUserRequest): Promise<DraslUser> {
    return dpFetch(`/users/${encodeURIComponent(uuid)}`, { method: 'PATCH', body: JSON.stringify(req) });
  }

  async deleteUser(uuid: string): Promise<void> {
    await dpFetch(`/users/${encodeURIComponent(uuid)}`, { method: 'DELETE' }, { expectBody: false });
  }

  async listInvites(): Promise<DraslInvite[]> {
    return dpFetch('/invites');
  }

  async createInvite(): Promise<DraslInvite> {
    return dpFetch('/invites', { method: 'POST' });
  }

  async deleteInvite(code: string): Promise<void> {
    await dpFetch(`/invites/${encodeURIComponent(code)}`, { method: 'DELETE' }, { expectBody: false });
  }
}

export const draslService = new DraslService();
