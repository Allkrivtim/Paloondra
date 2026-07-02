import { env } from '../config/env';

// Modrinth asks API consumers to identify themselves - see
// https://docs.modrinth.com/api/#authentication.
const USER_AGENT = 'Paloondra/1.0 (+https://github.com/Allkrivtim/Paloondra)';

export interface ModrinthSearchParams {
  query?: string;
  gameVersion?: string;
  loader?: string;
  category?: string;
  offset?: number;
  limit?: number;
}

export interface ModrinthSearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  categories: string[];
  versions: string[];
  downloads: number;
  icon_url: string | null;
  latest_version: string;
}

export interface ModrinthSearchResponse {
  hits: ModrinthSearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

export interface ModrinthVersionFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
}

export interface ModrinthVersionDependency {
  project_id: string | null;
  version_id: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  changelog: string | null;
  game_versions: string[];
  loaders: string[];
  version_type: 'release' | 'beta' | 'alpha';
  dependencies: ModrinthVersionDependency[];
  files: ModrinthVersionFile[];
  date_published: string;
}

export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  categories: string[];
  game_versions: string[];
  loaders: string[];
  downloads: number;
  followers: number;
  icon_url: string | null;
  source_url: string | null;
  issues_url: string | null;
  wiki_url: string | null;
  license?: { id: string; name: string } | null;
}

export class ModrinthError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function modrinthFetch<T>(pathAndQuery: string): Promise<T> {
  const url = `${env.modrinth.apiUrl}${pathAndQuery}`;
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch (err) {
    throw new ModrinthError(`Could not reach Modrinth: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (response.status === 429) {
    const resetSecs = response.headers.get('x-ratelimit-reset') ?? response.headers.get('retry-after');
    throw new ModrinthError(
      `Modrinth rate limit hit${resetSecs ? ` - try again in ~${resetSecs}s` : ' - try again shortly'}.`,
      429,
    );
  }
  if (response.status === 404) {
    throw new ModrinthError('Not found on Modrinth.', 404);
  }
  if (!response.ok) {
    throw new ModrinthError(`Modrinth returned HTTP ${response.status}.`, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ModrinthError('Modrinth returned an unexpected response.');
  }
}

/**
 * Modrinth's search facets are `[["a"],["b:c"]]` - outer arrays AND'd
 * together, inner arrays OR'd. Plugin platforms (paper/spigot/bukkit/
 * purpur/...) and content categories are both exposed as "categories" in
 * the current API, so both filters use that facet type. This is the part
 * most likely to need adjusting if Modrinth's schema changes - it's kept
 * isolated here for that reason.
 */
function buildFacets(params: ModrinthSearchParams): string {
  const groups: string[][] = [['project_type:plugin']];
  if (params.gameVersion) groups.push([`versions:${params.gameVersion}`]);
  if (params.loader) groups.push([`categories:${params.loader}`]);
  if (params.category) groups.push([`categories:${params.category}`]);
  return JSON.stringify(groups);
}

class ModrinthService {
  async search(params: ModrinthSearchParams): Promise<ModrinthSearchResponse> {
    const qs = new URLSearchParams();
    if (params.query) qs.set('query', params.query);
    qs.set('facets', buildFacets(params));
    qs.set('limit', String(Math.min(Math.max(params.limit ?? 20, 1), 50)));
    qs.set('offset', String(Math.max(params.offset ?? 0, 0)));
    return modrinthFetch<ModrinthSearchResponse>(`/search?${qs.toString()}`);
  }

  async getProject(idOrSlug: string): Promise<ModrinthProject> {
    return modrinthFetch<ModrinthProject>(`/project/${encodeURIComponent(idOrSlug)}`);
  }

  async getVersions(idOrSlug: string): Promise<ModrinthVersion[]> {
    return modrinthFetch<ModrinthVersion[]>(`/project/${encodeURIComponent(idOrSlug)}/version`);
  }
}

export const modrinthService = new ModrinthService();
