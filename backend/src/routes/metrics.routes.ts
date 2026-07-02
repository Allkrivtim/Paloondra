import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { metricsService } from '../services/metrics.service';

const router = Router();

router.use(requireAuth);

router.get('/history', (_req, res) => {
  res.json({ samples: metricsService.getHistory() });
});

export default router;
