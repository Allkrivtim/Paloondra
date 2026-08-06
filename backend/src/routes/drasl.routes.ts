import { Router } from 'express';
import { AuthedRequest, requireAuth, requirePermission } from '../auth/middleware';
import { draslService, DraslApiError } from '../services/drasl.service';
import { auditLogService } from '../services/auditLog.service';
import { env } from '../config/env';
import { sendError } from './routeUtils';
import { DraslCreateUserRequest, DraslUpdateUserRequest } from '../types';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('drasl'));

/**
 * DraslApiError carries a real HTTP status from Drasl's own API - pass it
 * through. Every non-DraslApiError thrown inside these routes' try blocks
 * comes from this file's own request parsing, which only ever throws for
 * bad client input - not a 500-worthy server fault, so it's 400.
 */
function handleError(res: Parameters<typeof sendError>[0], err: unknown, fallback: string): void {
  sendError(res, err, fallback, err instanceof DraslApiError ? (err.status ?? 502) : 400);
}

function parseCreateUser(body: unknown): DraslCreateUserRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.username !== 'string' || !b.username.trim()) {
    throw new Error('username is required');
  }
  const req: DraslCreateUserRequest = {
    username: b.username.trim(),
    isAdmin: b.isAdmin === true,
    isLocked: b.isLocked === true,
  };
  if (typeof b.password === 'string' && b.password) req.password = b.password;
  if (typeof b.maxPlayerCount === 'number' && Number.isFinite(b.maxPlayerCount)) req.maxPlayerCount = b.maxPlayerCount;
  return req;
}

function parseUpdateUser(body: unknown): DraslUpdateUserRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const req: DraslUpdateUserRequest = {};
  if (typeof b.password === 'string' && b.password) req.password = b.password;
  if (typeof b.isAdmin === 'boolean') req.isAdmin = b.isAdmin;
  if (typeof b.isLocked === 'boolean') req.isLocked = b.isLocked;
  if (typeof b.maxPlayerCount === 'number' && Number.isFinite(b.maxPlayerCount)) req.maxPlayerCount = b.maxPlayerCount;
  if (b.resetApiToken === true) req.resetApiToken = true;
  return req;
}

router.get('/health', async (_req, res) => {
  // Unlike LuckPerms (where the key is genuinely optional), Drasl's token
  // is mandatory the moment a URL is set - every call needs it, so
  // "configured" means both are present, not just the URL.
  const configured = !!(env.drasl.apiUrl && env.drasl.apiToken);
  const ok = configured ? await draslService.health() : false;
  res.json({ configured, ok });
});

router.get('/users', async (_req, res) => {
  try {
    res.json({ users: await draslService.listUsers() });
  } catch (err) {
    handleError(res, err, 'Failed to list users');
  }
});

router.get('/users/:uuid', async (req, res) => {
  try {
    res.json(await draslService.getUser(req.params.uuid));
  } catch (err) {
    handleError(res, err, 'Failed to load user');
  }
});

router.post('/users', async (req: AuthedRequest, res) => {
  try {
    const body = parseCreateUser(req.body);
    const user = await draslService.createUser(body);
    await auditLogService.record(req.user!.username, 'Created Drasl user', `${user.username} (${user.uuid})`);
    res.json(user);
  } catch (err) {
    handleError(res, err, 'Failed to create user');
  }
});

router.patch('/users/:uuid', async (req: AuthedRequest, res) => {
  try {
    const body = parseUpdateUser(req.body);
    const user = await draslService.updateUser(req.params.uuid, body);
    const changed = Object.keys(body).join(', ') || 'no changes';
    await auditLogService.record(req.user!.username, 'Updated Drasl user', `${user.username} (${changed})`);
    res.json(user);
  } catch (err) {
    handleError(res, err, 'Failed to update user');
  }
});

router.delete('/users/:uuid', async (req: AuthedRequest, res) => {
  try {
    // Grab the username up front for a readable audit entry - once
    // deleteUser() succeeds, this UUID no longer resolves to anything.
    let label = req.params.uuid;
    try {
      label = (await draslService.getUser(req.params.uuid)).username;
    } catch {
      // Fine to proceed with just the UUID if the lookup itself fails.
    }
    await draslService.deleteUser(req.params.uuid);
    await auditLogService.record(req.user!.username, 'Deleted Drasl user', `${label} (${req.params.uuid})`);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'Failed to delete user');
  }
});

router.get('/invites', async (_req, res) => {
  try {
    res.json({ invites: await draslService.listInvites() });
  } catch (err) {
    handleError(res, err, 'Failed to list invites');
  }
});

router.post('/invites', async (req: AuthedRequest, res) => {
  try {
    const invite = await draslService.createInvite();
    await auditLogService.record(req.user!.username, 'Created Drasl invite', invite.code);
    res.json(invite);
  } catch (err) {
    handleError(res, err, 'Failed to create invite');
  }
});

router.delete('/invites/:code', async (req: AuthedRequest, res) => {
  try {
    await draslService.deleteInvite(req.params.code);
    await auditLogService.record(req.user!.username, 'Revoked Drasl invite', req.params.code);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'Failed to revoke invite');
  }
});

export default router;
