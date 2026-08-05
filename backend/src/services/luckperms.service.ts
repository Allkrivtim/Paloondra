import { env } from '../config/env';
import {
  LuckPermsContext,
  LuckPermsGroup,
  LuckPermsGroupSearchResult,
  LuckPermsNewNode,
  LuckPermsNode,
  LuckPermsPermissionCheckResult,
  LuckPermsSearchParams,
  LuckPermsTrack,
  LuckPermsUser,
  LuckPermsUserSearchResult,
} from '../types';

export class LuckPermsApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

// Node's fetch has no connect timeout by default - a host that's firewalled
// (SYN silently dropped) or just wrong can hang for a minute or more on the
// underlying OS TCP timeout before fetch() ever rejects. That reads to a
// user as "it's stuck", not "it failed" - capping it here means a bad
// LUCKPERMS_API_URL fails fast with a message that actually points at the
// right thing to check, instead of a long silent wait.
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Thin HTTP client for the (separately-deployed, opt-in) LuckPerms REST API
 * extension - https://github.com/LuckPerms/rest-api. NOT part of LuckPerms
 * out of the box, and NOT reached over the shared SSH connection like every
 * other integration in this app - it's a plain HTTP call to whatever host/
 * port the extension is listening on, same trust model as RCON_HOST/PORT
 * (assumed reachable from wherever this backend runs). See README's
 * LuckPerms section for what has to be deployed before this works.
 */
async function lpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.luckperms.apiUrl) {
    throw new LuckPermsApiError('LUCKPERMS_API_URL is not configured - set it in backend/.env to use the LuckPerms tab');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> | undefined) };
  if (env.luckperms.apiKey) {
    headers.Authorization = `Bearer ${env.luckperms.apiKey}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${env.luckperms.apiUrl}${path}`, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new LuckPermsApiError(
        `Timed out after ${REQUEST_TIMEOUT_MS / 1000}s waiting for the LuckPerms REST API at ${env.luckperms.apiUrl}. ` +
          `A timeout (rather than an immediate connection error) usually means the host/port is unreachable - firewalled, ` +
          `wrong IP/host, or nothing routes there - not that the extension is just slow. Confirm LUCKPERMS_API_URL is correct ` +
          `and reachable from this backend, e.g. "curl ${env.luckperms.apiUrl}/health" run ON THE BACKEND HOST.`,
      );
    }
    throw new LuckPermsApiError(
      `Could not reach the LuckPerms REST API at ${env.luckperms.apiUrl}: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new LuckPermsApiError('The LuckPerms REST API rejected the request - check LUCKPERMS_API_KEY matches one of its configured keys.', response.status);
  }
  if (response.status === 404) {
    throw new LuckPermsApiError('Not found.', 404);
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = await response.text();
    } catch {
      // ignore - fall through to the generic message below
    }
    throw new LuckPermsApiError(`LuckPerms REST API returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`, response.status);
  }

  // Some endpoints (node mutations, deletes) respond 200/202/204 with no
  // body, or an empty body - JSON-parsing that would throw, so only parse
  // when there's actually something to parse.
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new LuckPermsApiError('LuckPerms REST API returned an unexpected (non-JSON) response.');
  }
}

function qs(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value);
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

class LuckPermsService {
  async health(): Promise<boolean> {
    try {
      await lpFetch('/health');
      return true;
    } catch {
      return false;
    }
  }

  // --- Users ---------------------------------------------------------------

  /** Resolves a username/UUID to the account LuckPerms already knows (i.e. has joined before, or been referenced via /lp). Returns null rather than throwing on a genuine "not found", since that's an expected outcome for a search box, not an exceptional failure. */
  async lookupUser(params: { username?: string; uniqueId?: string }): Promise<{ uniqueId: string; username: string } | null> {
    try {
      return await lpFetch(`/user/lookup${qs(params)}`);
    } catch (err) {
      if (err instanceof LuckPermsApiError && err.status === 404) return null;
      throw err;
    }
  }

  async getUser(uniqueId: string): Promise<LuckPermsUser> {
    return lpFetch(`/user/${encodeURIComponent(uniqueId)}`);
  }

  /** "Who has this permission/parent/prefix/...?" across every known user - the REST API's own search, not a client-side scan. */
  async searchUsers(params: LuckPermsSearchParams): Promise<LuckPermsUserSearchResult[]> {
    return lpFetch(`/user/search${qs({ ...params })}`);
  }

  async getUserNodes(uniqueId: string): Promise<LuckPermsNode[]> {
    return lpFetch(`/user/${encodeURIComponent(uniqueId)}/nodes`);
  }

  async addUserNode(uniqueId: string, node: LuckPermsNewNode): Promise<void> {
    await lpFetch(`/user/${encodeURIComponent(uniqueId)}/nodes`, { method: 'POST', body: JSON.stringify(node) });
  }

  /** `nodes` must be non-empty - the REST API treats an empty body as "delete everything". */
  async deleteUserNodes(uniqueId: string, nodes: LuckPermsNewNode[]): Promise<void> {
    if (nodes.length === 0) throw new LuckPermsApiError('Refusing to delete with an empty node list (the API would delete everything).');
    await lpFetch(`/user/${encodeURIComponent(uniqueId)}/nodes`, { method: 'DELETE', body: JSON.stringify(nodes) });
  }

  async promoteUser(uniqueId: string, track: string, context?: LuckPermsContext[]): Promise<void> {
    await lpFetch(`/user/${encodeURIComponent(uniqueId)}/promote`, { method: 'POST', body: JSON.stringify({ track, context }) });
  }

  async demoteUser(uniqueId: string, track: string, context?: LuckPermsContext[]): Promise<void> {
    await lpFetch(`/user/${encodeURIComponent(uniqueId)}/demote`, { method: 'POST', body: JSON.stringify({ track, context }) });
  }

  async checkUserPermission(uniqueId: string, key: string, context?: LuckPermsContext[]): Promise<LuckPermsPermissionCheckResult> {
    return lpFetch(`/user/${encodeURIComponent(uniqueId)}/permission-check`, { method: 'POST', body: JSON.stringify({ key, context }) });
  }

  // --- Groups ----------------------------------------------------------------

  async listGroups(): Promise<string[]> {
    return lpFetch('/group');
  }

  /** Same idea as searchUsers(), across groups instead. */
  async searchGroups(params: LuckPermsSearchParams): Promise<LuckPermsGroupSearchResult[]> {
    return lpFetch(`/group/search${qs({ ...params })}`);
  }

  async getGroup(name: string): Promise<LuckPermsGroup> {
    return lpFetch(`/group/${encodeURIComponent(name)}`);
  }

  async createGroup(name: string): Promise<void> {
    await lpFetch('/group', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async deleteGroup(name: string): Promise<void> {
    await lpFetch(`/group/${encodeURIComponent(name)}`, { method: 'DELETE' });
  }

  async getGroupNodes(name: string): Promise<LuckPermsNode[]> {
    return lpFetch(`/group/${encodeURIComponent(name)}/nodes`);
  }

  async addGroupNode(name: string, node: LuckPermsNewNode): Promise<void> {
    await lpFetch(`/group/${encodeURIComponent(name)}/nodes`, { method: 'POST', body: JSON.stringify(node) });
  }

  async deleteGroupNodes(name: string, nodes: LuckPermsNewNode[]): Promise<void> {
    if (nodes.length === 0) throw new LuckPermsApiError('Refusing to delete with an empty node list (the API would delete everything).');
    await lpFetch(`/group/${encodeURIComponent(name)}/nodes`, { method: 'DELETE', body: JSON.stringify(nodes) });
  }

  async checkGroupPermission(name: string, key: string, context?: LuckPermsContext[]): Promise<LuckPermsPermissionCheckResult> {
    return lpFetch(`/group/${encodeURIComponent(name)}/permission-check`, { method: 'POST', body: JSON.stringify({ key, context }) });
  }

  // --- Tracks ------------------------------------------------------------

  async listTracks(): Promise<string[]> {
    return lpFetch('/track');
  }

  async getTrack(name: string): Promise<LuckPermsTrack> {
    return lpFetch(`/track/${encodeURIComponent(name)}`);
  }

  async createTrack(name: string): Promise<void> {
    await lpFetch('/track', { method: 'POST', body: JSON.stringify({ name }) });
  }

  async deleteTrack(name: string): Promise<void> {
    await lpFetch(`/track/${encodeURIComponent(name)}`, { method: 'DELETE' });
  }

  /** Sends the full ordered group list - this is how reordering, adding, and removing groups on a track all happen (there's no separate insert/reorder endpoint). */
  async setTrackGroups(name: string, groups: string[]): Promise<void> {
    await lpFetch(`/track/${encodeURIComponent(name)}`, { method: 'PATCH', body: JSON.stringify({ groups }) });
  }
}

export const luckPermsService = new LuckPermsService();
