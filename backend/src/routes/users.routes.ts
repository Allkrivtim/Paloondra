import { Router } from 'express';
import { AuthedRequest, requireAuth, requireAdmin } from '../auth/middleware';
import { usersService } from '../services/users.service';
import { auditLogService } from '../services/auditLog.service';
import { sendError } from './routeUtils';
import { isValidPermissionKey, PermissionKey, UserRole } from '../types';

const router = Router();

// Only admins manage other accounts - everyone else doesn't even know this
// tab exists (hidden from nav), but the real enforcement is here, not the
// frontend hiding the tab.
router.use(requireAuth);
router.use(requireAdmin);

function isValidRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'user';
}

/** Returns undefined (meaning "use the default") for anything that isn't an array of valid keys, rather than partially trusting a malformed body. */
function parsePermissions(value: unknown): PermissionKey[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((v) => typeof v === 'string' && isValidPermissionKey(v))) {
    throw new Error('permissions must be an array of valid permission keys');
  }
  return value as PermissionKey[];
}

/**
 * Loosely validated here (must be a string, null, or absent) - the real
 * shape validation (absolute path, etc.) happens once in
 * usersService.normalizeSftpRootPath, so both the create and dedicated
 * set-root routes get identical rules for free.
 */
function parseSftpRootPath(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('sftpRootPath must be a string or null');
  return value;
}

router.get('/', async (_req, res) => {
  try {
    res.json(await usersService.list());
  } catch (err) {
    sendError(res, err, 'Failed to load users');
  }
});

router.post('/', async (req: AuthedRequest, res) => {
  try {
    const { username, password, role } = req.body ?? {};
    if (typeof username !== 'string' || !username.trim()) {
      res.status(400).json({ error: 'username is required' });
      return;
    }
    if (!isValidRole(role)) {
      res.status(400).json({ error: 'role must be "admin" or "user"' });
      return;
    }
    const permissions = parsePermissions(req.body?.permissions);
    const sftpRootPath = parseSftpRootPath(req.body?.sftpRootPath);
    const user = await usersService.create(username, password, role, permissions, sftpRootPath);
    await auditLogService.record(req.user!.username, `Created user "${user.username}"`, role);
    res.json(user);
  } catch (err) {
    sendError(res, err, 'Failed to create user', 400);
  }
});

router.put('/:id/role', async (req: AuthedRequest, res) => {
  try {
    const { role } = req.body ?? {};
    if (!isValidRole(role)) {
      res.status(400).json({ error: 'role must be "admin" or "user"' });
      return;
    }
    const user = await usersService.setRole(req.params.id, role);
    await auditLogService.record(req.user!.username, `Changed role of "${user.username}"`, role);
    res.json(user);
  } catch (err) {
    sendError(res, err, 'Failed to change role', 400);
  }
});

router.put('/:id/permissions', async (req: AuthedRequest, res) => {
  try {
    const permissions = parsePermissions(req.body?.permissions);
    if (!permissions) {
      res.status(400).json({ error: 'permissions must be an array of valid permission keys' });
      return;
    }
    const user = await usersService.setPermissions(req.params.id, permissions);
    await auditLogService.record(req.user!.username, `Changed permissions for "${user.username}"`, permissions.join(', '));
    res.json(user);
  } catch (err) {
    sendError(res, err, 'Failed to change permissions', 400);
  }
});

router.put('/:id/sftp-root', async (req: AuthedRequest, res) => {
  try {
    const sftpRootPath = parseSftpRootPath(req.body?.sftpRootPath);
    if (sftpRootPath === undefined) {
      res.status(400).json({ error: 'sftpRootPath must be a string or null' });
      return;
    }
    const user = await usersService.setSftpRootPath(req.params.id, sftpRootPath);
    await auditLogService.record(
      req.user!.username,
      `Changed File Manager root for "${user.username}"`,
      user.sftpRootPath ?? '(unrestricted)',
    );
    res.json(user);
  } catch (err) {
    sendError(res, err, 'Failed to change File Manager root', 400);
  }
});

router.put('/:id/password', async (req: AuthedRequest, res) => {
  try {
    const { password } = req.body ?? {};
    const user = await usersService.resetPassword(req.params.id, password);
    // Deliberately no password/hash in the audit details.
    await auditLogService.record(req.user!.username, `Reset password for "${user.username}"`);
    res.json(user);
  } catch (err) {
    sendError(res, err, 'Failed to reset password', 400);
  }
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  try {
    // Look the user up first purely so the audit log/response can name them
    // - usersService.remove() re-validates everything itself regardless.
    const target = (await usersService.list()).find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    await usersService.remove(req.params.id, req.user!.username);
    await auditLogService.record(req.user!.username, `Removed user "${target.username}"`);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to remove user', 400);
  }
});

export default router;
