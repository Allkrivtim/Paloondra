import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { rconService } from '../services/rcon.service';
import { auditLogService } from '../services/auditLog.service';
import { sendError } from './routeUtils';

const router = Router();

router.use(requireAuth);

// A single generic "run this RCON command" endpoint, separate from the
// RCON console's own WebSocket channel (ws/rconSocket.ts). This is the one
// the Dashboard's player-management buttons (kick/ban/op/whitelist) and
// broadcast box use, and unlike the full console, every command sent
// through it is audit-logged - it's for scripted one-off "quick actions",
// not free-form console use.
router.post('/command', async (req: AuthedRequest, res) => {
  try {
    const { command } = req.body ?? {};
    if (typeof command !== 'string' || !command.trim()) {
      res.status(400).json({ error: 'command is required' });
      return;
    }
    const result = await rconService.execute(command.trim());
    await auditLogService.record(req.user!.username, 'Ran RCON command', command.trim());
    res.json(result);
  } catch (err) {
    sendError(res, err, 'RCON command failed');
  }
});

export default router;
