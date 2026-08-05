import { Router } from 'express';
import { AuthedRequest, requireAuth, requirePermission } from '../auth/middleware';
import { luckPermsService, LuckPermsApiError } from '../services/luckperms.service';
import { auditLogService } from '../services/auditLog.service';
import { env } from '../config/env';
import { sendError } from './routeUtils';
import { LuckPermsContext, LuckPermsNewNode, LuckPermsSearchParams, LuckPermsSearchNodeType } from '../types';

const SEARCH_NODE_TYPES: LuckPermsSearchNodeType[] = ['regex_permission', 'inheritance', 'prefix', 'suffix', 'meta', 'weight', 'display_name'];

const router = Router();

router.use(requireAuth);
router.use(requirePermission('luckperms'));

/**
 * LuckPermsApiError carries a real HTTP status from the upstream API
 * (401/403/404/etc.) - pass it through. Every non-LuckPermsApiError thrown
 * inside these routes' try blocks comes from this file's own request
 * parsing (parseNode/parseContext/parseNodeArray/parseSearchParams), which
 * only ever throw for bad client input - not a 500-worthy server fault, so
 * it's reported as 400.
 */
function handleError(res: Parameters<typeof sendError>[0], err: unknown, fallback: string): void {
  sendError(res, err, fallback, err instanceof LuckPermsApiError ? (err.status ?? 502) : 400);
}

function parseContext(value: unknown): LuckPermsContext[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error('context must be an array of {key, value} pairs');
  return value.map((c) => {
    if (!c || typeof c.key !== 'string' || typeof c.value !== 'string' || !c.key || !c.value) {
      throw new Error('Each context entry needs a non-empty key and value');
    }
    return { key: c.key, value: c.value };
  });
}

function parseNode(body: unknown): LuckPermsNewNode {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.key !== 'string' || !b.key.trim()) {
    throw new Error('key is required');
  }
  // NOT .trim()'d - prefix/suffix/meta nodes encode their actual text
  // inside this string (e.g. "prefix.100.[VIP] "), where trailing/leading
  // whitespace is meaningful (it separates the prefix from the player's
  // name in chat). Only the emptiness check above needs a trimmed view.
  const node: LuckPermsNewNode = { key: b.key };
  if (typeof b.value === 'boolean') node.value = b.value;
  const context = parseContext(b.context);
  if (context) node.context = context;
  if (typeof b.expiry === 'number' && b.expiry > 0) node.expiry = b.expiry;
  return node;
}

function parseNodeArray(body: unknown): LuckPermsNewNode[] {
  if (!Array.isArray(body) || body.length === 0) {
    throw new Error('A non-empty array of nodes is required');
  }
  return body.map(parseNode);
}

/** Shared by GET /users/search and GET /groups/search - the REST API itself requires exactly one of key/keyStartsWith. */
function parseSearchParams(query: Record<string, unknown>): LuckPermsSearchParams {
  const key = typeof query.key === 'string' ? query.key : undefined;
  const keyStartsWith = typeof query.keyStartsWith === 'string' ? query.keyStartsWith : undefined;
  if (!key && !keyStartsWith) {
    throw new Error('key or keyStartsWith is required');
  }
  const type = typeof query.type === 'string' && (SEARCH_NODE_TYPES as string[]).includes(query.type) ? (query.type as LuckPermsSearchNodeType) : undefined;
  const metaKey = typeof query.metaKey === 'string' ? query.metaKey : undefined;
  return { key, keyStartsWith, type, metaKey };
}

// Lets the frontend distinguish "not configured" (show a clear setup
// message, like the Console/Plugins tabs do) from "configured but the
// extension is unreachable/unhealthy" (a real connection problem).
router.get('/health', async (_req, res) => {
  const configured = !!env.luckperms.apiUrl;
  res.json({ configured, ok: configured ? await luckPermsService.health() : false });
});

// --- Users -------------------------------------------------------------

router.get('/users', async (_req, res) => {
  try {
    res.json({ users: await luckPermsService.listUsers() });
  } catch (err) {
    handleError(res, err, 'Failed to list users');
  }
});

// Must come before /users/:uniqueId - Express matches routes in
// registration order, and :uniqueId would otherwise swallow "search" as
// if it were an id.
router.get('/users/search', async (req, res) => {
  try {
    const params = parseSearchParams(req.query as Record<string, unknown>);
    res.json({ results: await luckPermsService.searchUsers(params) });
  } catch (err) {
    handleError(res, err, 'Search failed');
  }
});

router.get('/users/lookup', async (req, res) => {
  try {
    const username = typeof req.query.username === 'string' ? req.query.username : undefined;
    const uniqueId = typeof req.query.uniqueId === 'string' ? req.query.uniqueId : undefined;
    if (!username && !uniqueId) {
      res.status(400).json({ error: 'username or uniqueId is required' });
      return;
    }
    const user = await luckPermsService.lookupUser({ username, uniqueId });
    res.json({ user });
  } catch (err) {
    handleError(res, err, 'Failed to look up user');
  }
});

router.get('/users/:uniqueId', async (req, res) => {
  try {
    res.json(await luckPermsService.getUser(req.params.uniqueId));
  } catch (err) {
    handleError(res, err, 'Failed to load user');
  }
});

router.post('/users/:uniqueId/nodes', async (req: AuthedRequest, res) => {
  try {
    const node = parseNode(req.body);
    await luckPermsService.addUserNode(req.params.uniqueId, node);
    await auditLogService.record(req.user!.username, 'Added LuckPerms node to user', `${req.params.uniqueId}: ${node.key}`);
    res.json(await luckPermsService.getUser(req.params.uniqueId));
  } catch (err) {
    handleError(res, err, 'Failed to add node');
  }
});

router.delete('/users/:uniqueId/nodes', async (req: AuthedRequest, res) => {
  try {
    const nodes = parseNodeArray(req.body);
    await luckPermsService.deleteUserNodes(req.params.uniqueId, nodes);
    await auditLogService.record(
      req.user!.username,
      'Removed LuckPerms node(s) from user',
      `${req.params.uniqueId}: ${nodes.map((n) => n.key).join(', ')}`,
    );
    res.json(await luckPermsService.getUser(req.params.uniqueId));
  } catch (err) {
    handleError(res, err, 'Failed to remove node');
  }
});

router.post('/users/:uniqueId/promote', async (req: AuthedRequest, res) => {
  try {
    const { track } = req.body ?? {};
    if (typeof track !== 'string' || !track.trim()) {
      res.status(400).json({ error: 'track is required' });
      return;
    }
    const context = parseContext(req.body?.context);
    await luckPermsService.promoteUser(req.params.uniqueId, track, context);
    await auditLogService.record(req.user!.username, 'Promoted LuckPerms user on track', `${req.params.uniqueId} (${track})`);
    res.json(await luckPermsService.getUser(req.params.uniqueId));
  } catch (err) {
    handleError(res, err, 'Failed to promote user');
  }
});

router.post('/users/:uniqueId/demote', async (req: AuthedRequest, res) => {
  try {
    const { track } = req.body ?? {};
    if (typeof track !== 'string' || !track.trim()) {
      res.status(400).json({ error: 'track is required' });
      return;
    }
    const context = parseContext(req.body?.context);
    await luckPermsService.demoteUser(req.params.uniqueId, track, context);
    await auditLogService.record(req.user!.username, 'Demoted LuckPerms user on track', `${req.params.uniqueId} (${track})`);
    res.json(await luckPermsService.getUser(req.params.uniqueId));
  } catch (err) {
    handleError(res, err, 'Failed to demote user');
  }
});

router.post('/users/:uniqueId/permission-check', async (req, res) => {
  try {
    const { key } = req.body ?? {};
    if (typeof key !== 'string' || !key.trim()) {
      res.status(400).json({ error: 'key is required' });
      return;
    }
    const context = parseContext(req.body?.context);
    res.json(await luckPermsService.checkUserPermission(req.params.uniqueId, key.trim(), context));
  } catch (err) {
    handleError(res, err, 'Permission check failed');
  }
});

// --- Groups --------------------------------------------------------------

router.get('/groups', async (_req, res) => {
  try {
    res.json({ groups: await luckPermsService.listGroups() });
  } catch (err) {
    handleError(res, err, 'Failed to list groups');
  }
});

router.post('/groups', async (req: AuthedRequest, res) => {
  try {
    const { name } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    await luckPermsService.createGroup(name.trim());
    await auditLogService.record(req.user!.username, 'Created LuckPerms group', name.trim());
    res.json(await luckPermsService.getGroup(name.trim()));
  } catch (err) {
    handleError(res, err, 'Failed to create group');
  }
});

// Must come before /groups/:name, same reason as /users/search above.
router.get('/groups/search', async (req, res) => {
  try {
    const params = parseSearchParams(req.query as Record<string, unknown>);
    res.json({ results: await luckPermsService.searchGroups(params) });
  } catch (err) {
    handleError(res, err, 'Search failed');
  }
});

router.get('/groups/:name', async (req, res) => {
  try {
    res.json(await luckPermsService.getGroup(req.params.name));
  } catch (err) {
    handleError(res, err, 'Failed to load group');
  }
});

router.delete('/groups/:name', async (req: AuthedRequest, res) => {
  try {
    await luckPermsService.deleteGroup(req.params.name);
    await auditLogService.record(req.user!.username, 'Deleted LuckPerms group', req.params.name);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'Failed to delete group');
  }
});

router.post('/groups/:name/nodes', async (req: AuthedRequest, res) => {
  try {
    const node = parseNode(req.body);
    await luckPermsService.addGroupNode(req.params.name, node);
    await auditLogService.record(req.user!.username, 'Added LuckPerms node to group', `${req.params.name}: ${node.key}`);
    res.json(await luckPermsService.getGroup(req.params.name));
  } catch (err) {
    handleError(res, err, 'Failed to add node');
  }
});

router.delete('/groups/:name/nodes', async (req: AuthedRequest, res) => {
  try {
    const nodes = parseNodeArray(req.body);
    await luckPermsService.deleteGroupNodes(req.params.name, nodes);
    await auditLogService.record(
      req.user!.username,
      'Removed LuckPerms node(s) from group',
      `${req.params.name}: ${nodes.map((n) => n.key).join(', ')}`,
    );
    res.json(await luckPermsService.getGroup(req.params.name));
  } catch (err) {
    handleError(res, err, 'Failed to remove node');
  }
});

router.post('/groups/:name/permission-check', async (req, res) => {
  try {
    const { key } = req.body ?? {};
    if (typeof key !== 'string' || !key.trim()) {
      res.status(400).json({ error: 'key is required' });
      return;
    }
    const context = parseContext(req.body?.context);
    res.json(await luckPermsService.checkGroupPermission(req.params.name, key.trim(), context));
  } catch (err) {
    handleError(res, err, 'Permission check failed');
  }
});

// --- Tracks --------------------------------------------------------------

router.get('/tracks', async (_req, res) => {
  try {
    res.json({ tracks: await luckPermsService.listTracks() });
  } catch (err) {
    handleError(res, err, 'Failed to list tracks');
  }
});

router.post('/tracks', async (req: AuthedRequest, res) => {
  try {
    const { name } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    await luckPermsService.createTrack(name.trim());
    await auditLogService.record(req.user!.username, 'Created LuckPerms track', name.trim());
    res.json(await luckPermsService.getTrack(name.trim()));
  } catch (err) {
    handleError(res, err, 'Failed to create track');
  }
});

router.get('/tracks/:name', async (req, res) => {
  try {
    res.json(await luckPermsService.getTrack(req.params.name));
  } catch (err) {
    handleError(res, err, 'Failed to load track');
  }
});

router.delete('/tracks/:name', async (req: AuthedRequest, res) => {
  try {
    await luckPermsService.deleteTrack(req.params.name);
    await auditLogService.record(req.user!.username, 'Deleted LuckPerms track', req.params.name);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'Failed to delete track');
  }
});

router.patch('/tracks/:name', async (req: AuthedRequest, res) => {
  try {
    const { groups } = req.body ?? {};
    if (!Array.isArray(groups) || !groups.every((g) => typeof g === 'string')) {
      res.status(400).json({ error: 'groups must be an array of group names' });
      return;
    }
    await luckPermsService.setTrackGroups(req.params.name, groups);
    await auditLogService.record(req.user!.username, 'Updated LuckPerms track groups', `${req.params.name}: ${groups.join(' -> ')}`);
    res.json(await luckPermsService.getTrack(req.params.name));
  } catch (err) {
    handleError(res, err, 'Failed to update track');
  }
});

export default router;
