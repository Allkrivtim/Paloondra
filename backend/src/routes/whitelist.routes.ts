import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { whitelistService } from '../services/whitelist.service';
import { auditLogService } from '../services/auditLog.service';
import { sendError, isValidMinecraftUsername } from './routeUtils';

const router = Router();

router.use(requireAuth);

function requireUsername(body: unknown): string {
  const name = (body as { name?: unknown } | null)?.name;
  if (typeof name !== 'string' || !isValidMinecraftUsername(name)) {
    throw new Error('A valid Minecraft username (1-16 chars, letters/numbers/underscore) is required');
  }
  return name;
}

router.get('/', async (_req, res) => {
  try {
    res.json(await whitelistService.get());
  } catch (err) {
    sendError(res, err, 'Failed to load whitelist');
  }
});

router.post('/add', async (req: AuthedRequest, res) => {
  try {
    const name = requireUsername(req.body);
    const result = await whitelistService.add(name);
    await auditLogService.record(req.user!.username, 'Added to whitelist', name);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to add to whitelist', 400);
  }
});

router.post('/remove', async (req: AuthedRequest, res) => {
  try {
    const name = requireUsername(req.body);
    const result = await whitelistService.remove(name);
    await auditLogService.record(req.user!.username, 'Removed from whitelist', name);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to remove from whitelist', 400);
  }
});

router.post('/reload', async (req: AuthedRequest, res) => {
  try {
    const result = await whitelistService.reload();
    await auditLogService.record(req.user!.username, 'Reloaded whitelist from disk');
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to reload whitelist');
  }
});

router.put('/enabled', async (req: AuthedRequest, res) => {
  try {
    const { enabled } = req.body ?? {};
    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled (boolean) is required' });
      return;
    }
    const result = await whitelistService.setEnabled(enabled);
    await auditLogService.record(req.user!.username, enabled ? 'Enabled whitelist' : 'Disabled whitelist');
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to update whitelist state');
  }
});

export default router;
