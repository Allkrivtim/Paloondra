import { api } from './client';
import {
  LuckPermsContext,
  LuckPermsGroup,
  LuckPermsGroupSearchResult,
  LuckPermsNewNode,
  LuckPermsPermissionCheckResult,
  LuckPermsSearchParams,
  LuckPermsTrack,
  LuckPermsUser,
  LuckPermsUserSearchResult,
} from '../types';

export async function getHealth(): Promise<{ configured: boolean; ok: boolean }> {
  const res = await api.get('/luckperms/health');
  return res.data;
}

// --- Users -----------------------------------------------------------------

/** Every user LuckPerms has a record for - bare UUIDs only, no usernames. See UsersBrowserPanel for how these get resolved to something browsable. */
export async function listUsers(): Promise<string[]> {
  const res = await api.get('/luckperms/users');
  return res.data.users;
}

export async function lookupUser(params: { username?: string; uniqueId?: string }): Promise<{ uniqueId: string; username: string } | null> {
  const res = await api.get('/luckperms/users/lookup', { params });
  return res.data.user;
}

/** "Who has this permission/parent/prefix/...?" across every known user - the REST API's own search, not a client-side scan. */
export async function searchUsers(params: LuckPermsSearchParams): Promise<LuckPermsUserSearchResult[]> {
  const res = await api.get('/luckperms/users/search', { params });
  return res.data.results;
}

export async function getUser(uniqueId: string): Promise<LuckPermsUser> {
  const res = await api.get(`/luckperms/users/${encodeURIComponent(uniqueId)}`);
  return res.data;
}

export async function addUserNode(uniqueId: string, node: LuckPermsNewNode): Promise<LuckPermsUser> {
  const res = await api.post(`/luckperms/users/${encodeURIComponent(uniqueId)}/nodes`, node);
  return res.data;
}

export async function deleteUserNodes(uniqueId: string, nodes: LuckPermsNewNode[]): Promise<LuckPermsUser> {
  const res = await api.delete(`/luckperms/users/${encodeURIComponent(uniqueId)}/nodes`, { data: nodes });
  return res.data;
}

export async function promoteUser(uniqueId: string, track: string, context?: LuckPermsContext[]): Promise<LuckPermsUser> {
  const res = await api.post(`/luckperms/users/${encodeURIComponent(uniqueId)}/promote`, { track, context });
  return res.data;
}

export async function demoteUser(uniqueId: string, track: string, context?: LuckPermsContext[]): Promise<LuckPermsUser> {
  const res = await api.post(`/luckperms/users/${encodeURIComponent(uniqueId)}/demote`, { track, context });
  return res.data;
}

export async function checkUserPermission(uniqueId: string, key: string, context?: LuckPermsContext[]): Promise<LuckPermsPermissionCheckResult> {
  const res = await api.post(`/luckperms/users/${encodeURIComponent(uniqueId)}/permission-check`, { key, context });
  return res.data;
}

// --- Groups ------------------------------------------------------------

export async function listGroups(): Promise<string[]> {
  const res = await api.get('/luckperms/groups');
  return res.data.groups;
}

export async function searchGroups(params: LuckPermsSearchParams): Promise<LuckPermsGroupSearchResult[]> {
  const res = await api.get('/luckperms/groups/search', { params });
  return res.data.results;
}

export async function createGroup(name: string): Promise<LuckPermsGroup> {
  const res = await api.post('/luckperms/groups', { name });
  return res.data;
}

export async function getGroup(name: string): Promise<LuckPermsGroup> {
  const res = await api.get(`/luckperms/groups/${encodeURIComponent(name)}`);
  return res.data;
}

export async function deleteGroup(name: string): Promise<void> {
  await api.delete(`/luckperms/groups/${encodeURIComponent(name)}`);
}

export async function addGroupNode(name: string, node: LuckPermsNewNode): Promise<LuckPermsGroup> {
  const res = await api.post(`/luckperms/groups/${encodeURIComponent(name)}/nodes`, node);
  return res.data;
}

export async function deleteGroupNodes(name: string, nodes: LuckPermsNewNode[]): Promise<LuckPermsGroup> {
  const res = await api.delete(`/luckperms/groups/${encodeURIComponent(name)}/nodes`, { data: nodes });
  return res.data;
}

export async function checkGroupPermission(name: string, key: string, context?: LuckPermsContext[]): Promise<LuckPermsPermissionCheckResult> {
  const res = await api.post(`/luckperms/groups/${encodeURIComponent(name)}/permission-check`, { key, context });
  return res.data;
}

// --- Tracks ------------------------------------------------------------

export async function listTracks(): Promise<string[]> {
  const res = await api.get('/luckperms/tracks');
  return res.data.tracks;
}

export async function createTrack(name: string): Promise<LuckPermsTrack> {
  const res = await api.post('/luckperms/tracks', { name });
  return res.data;
}

export async function getTrack(name: string): Promise<LuckPermsTrack> {
  const res = await api.get(`/luckperms/tracks/${encodeURIComponent(name)}`);
  return res.data;
}

export async function deleteTrack(name: string): Promise<void> {
  await api.delete(`/luckperms/tracks/${encodeURIComponent(name)}`);
}

export async function setTrackGroups(name: string, groups: string[]): Promise<LuckPermsTrack> {
  const res = await api.patch(`/luckperms/tracks/${encodeURIComponent(name)}`, { groups });
  return res.data;
}
