import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { opsService } from '../services/ops.service';
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
    res.json(await opsService.list());
  } catch (err) {
    sendError(res, err, 'Failed to load operators');
  }
});

router.post('/add', async (req: AuthedRequest, res) => {
  try {
    const name = requireUsername(req.body);
    const result = await opsService.add(name);
    await auditLogService.record(req.user!.username, 'Added operator', name);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to add operator', 400);
  }
});

router.post('/remove', async (req: AuthedRequest, res) => {
  try {
    const name = requireUsername(req.body);
    const result = await opsService.remove(name);
    await auditLogService.record(req.user!.username, 'Removed operator', name);
    res.json(result);
  } catch (err) {
    sendError(res, err, 'Failed to remove operator', 400);
  }
});

router.put('/:uuid/level', async (req: AuthedRequest, res) => {
  try {
    const { level } = req.body ?? {};
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > 4) {
      res.status(400).json({ error: 'level must be an integer between 0 and 4' });
      return;
    }
    const entries = await opsService.setLevel(req.params.uuid, level);
    await auditLogService.record(req.user!.username, 'Changed operator level', `${req.params.uuid} -> level ${level}`);
    res.json({ entries, restartRequired: true });
  } catch (err) {
    sendError(res, err, 'Failed to change operator level', 400);
  }
});

export default router;
