import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { scriptsService } from '../services/scripts.service';
import { rconService } from '../services/rcon.service';
import { ScriptName } from '../types';

const router = Router();
const VALID_ACTIONS: ScriptName[] = ['start', 'stop', 'restart', 'backup'];

router.use(requireAuth);

router.post('/:action', (req, res) => {
  const action = req.params.action as ScriptName;
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `Unknown action "${action}"` });
  }
  scriptsService.run(action);
  res.json({ ok: true, action });
});

router.get('/status', (_req, res) => {
  res.json(rconService.getStatus());
});

export default router;
