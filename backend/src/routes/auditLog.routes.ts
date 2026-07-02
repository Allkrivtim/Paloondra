import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { auditLogService } from '../services/auditLog.service';
import { sendError } from './routeUtils';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
    res.json({ entries: await auditLogService.list(limit && limit > 0 ? Math.min(limit, 1000) : undefined) });
  } catch (err) {
    sendError(res, err, 'Failed to load audit log');
  }
});

export default router;
