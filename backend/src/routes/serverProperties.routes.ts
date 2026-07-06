import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { fileManagerService } from '../services/fileManager.service';
import { parseProperties, applyProperties } from '../services/propertiesFile';
import { auditLogService } from '../services/auditLog.service';
import { sendError, requireServerPropertiesPath } from './routeUtils';

const router = Router();

router.use(requireAuth);

const MAX_SIZE = 1024 * 1024; // server.properties is always tiny; 1 MiB is generous

router.get('/', async (_req, res) => {
  try {
    const raw = await fileManagerService.readTextFile(requireServerPropertiesPath(), MAX_SIZE);
    res.json({ raw, properties: parseProperties(raw) });
  } catch (err) {
    sendError(res, err, 'Failed to read server.properties');
  }
});

router.put('/', async (req: AuthedRequest, res) => {
  try {
    const filePath = requireServerPropertiesPath();
    const body = req.body ?? {};

    let raw: string;
    if (typeof body.raw === 'string') {
      raw = body.raw;
    } else if (body.properties && typeof body.properties === 'object') {
      const current = await fileManagerService.readTextFile(filePath, MAX_SIZE);
      raw = applyProperties(current, body.properties);
    } else {
      res.status(400).json({ error: 'Provide either { raw } or { properties }' });
      return;
    }

    await fileManagerService.writeTextFile(filePath, raw);
    await auditLogService.record(req.user!.username, 'Saved server.properties');
    res.json({ raw, properties: parseProperties(raw) });
  } catch (err) {
    sendError(res, err, 'Failed to save server.properties');
  }
});

export default router;
