import { Router } from 'express';
import { AuthedRequest, requireAuth, requireAdmin } from '../auth/middleware';
import { usersService } from '../services/users.service';
import { auditLogService } from '../services/auditLog.service';
import { sendError } from './routeUtils';
import { UserRole } from '../types';

const router = Router();

// Only admins manage other accounts - everyone else doesn't even know this
// tab exists (hidden from nav), but the real enforcement is here, not the
// frontend hiding the tab.
router.use(requireAuth);
router.use(requireAdmin);

function isValidRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'user';
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
    const user = await usersService.create(username, password, role);
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
