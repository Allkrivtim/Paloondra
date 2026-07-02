import { api } from './client';
import { ModrinthProject, ModrinthSearchResponse, ModrinthVersion, PluginInfo } from '../types';

export interface ModrinthSearchParams {
  query?: string;
  gameVersion?: string;
  loader?: string;
  category?: string;
  offset?: number;
  limit?: number;
}

export async function searchModrinth(params: ModrinthSearchParams): Promise<ModrinthSearchResponse> {
  const res = await api.get('/plugins/store/search', { params });
  return res.data;
}

export async function getModrinthProject(idOrSlug: string): Promise<ModrinthProject> {
  const res = await api.get(`/plugins/store/project/${encodeURIComponent(idOrSlug)}`);
  return res.data;
}

export async function getModrinthVersions(idOrSlug: string): Promise<ModrinthVersion[]> {
  const res = await api.get(`/plugins/store/project/${encodeURIComponent(idOrSlug)}/versions`);
  return res.data;
}

export async function installFromModrinth(
  fileUrl: string,
  projectTitle: string,
  versionNumber: string,
): Promise<PluginInfo> {
  const res = await api.post('/plugins/store/install', { fileUrl, projectTitle, versionNumber });
  return res.data.plugin;
}
