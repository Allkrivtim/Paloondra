import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { schedulerService } from '../services/scheduler.service';
import { auditLogService } from '../services/auditLog.service';
import { sendError } from './routeUtils';
import { ScheduledTaskInput, ScheduledTaskType } from '../types';

const router = Router();

router.use(requireAuth);

function parseInput(body: unknown): ScheduledTaskInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const type: ScheduledTaskType = b.type === 'rcon' ? 'rcon' : 'restart';
  return {
    name: typeof b.name === 'string' ? b.name : '',
    schedule: typeof b.schedule === 'string' ? b.schedule : '',
    type,
    command: typeof b.command === 'string' ? b.command : null,
    enabled: typeof b.enabled === 'boolean' ? b.enabled : true,
  };
}

router.get('/', async (_req, res) => {
  try {
    res.json({ tasks: await schedulerService.list() });
  } catch (err) {
    sendError(res, err, 'Failed to list scheduled tasks');
  }
});

router.post('/', async (req: AuthedRequest, res) => {
  try {
    const task = await schedulerService.create(parseInput(req.body));
    await auditLogService.record(req.user!.username, 'Created scheduled task', `${task.name} (${task.schedule})`);
    res.json({ task });
  } catch (err) {
    sendError(res, err, 'Failed to create scheduled task', 400);
  }
});

router.put('/:id', async (req: AuthedRequest, res) => {
  try {
    const task = await schedulerService.update(req.params.id, parseInput(req.body));
    await auditLogService.record(req.user!.username, 'Updated scheduled task', `${task.name} (${task.schedule})`);
    res.json({ task });
  } catch (err) {
    sendError(res, err, 'Failed to update scheduled task', 400);
  }
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  try {
    await schedulerService.delete(req.params.id);
    await auditLogService.record(req.user!.username, 'Deleted scheduled task', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to delete scheduled task');
  }
});

router.post('/:id/run', async (req: AuthedRequest, res) => {
  try {
    const task = await schedulerService.runNow(req.params.id);
    await auditLogService.record(req.user!.username, 'Manually ran scheduled task', task.name);
    res.json({ task });
  } catch (err) {
    sendError(res, err, 'Failed to run scheduled task');
  }
});

export default router;
