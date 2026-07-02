import { Router } from 'express';
import multer from 'multer';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { pluginsService } from '../services/plugins.service';
import { auditLogService } from '../services/auditLog.service';
import { env } from '../config/env';
import { sendError } from './routeUtils';

const router = Router();

router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.plugins.maxJarSize },
});

router.get('/', async (_req, res) => {
  try {
    res.json({ plugins: await pluginsService.list() });
  } catch (err) {
    sendError(res, err, 'Failed to list plugins');
  }
});

router.post('/toggle', async (req: AuthedRequest, res) => {
  try {
    const { filename, enable } = req.body ?? {};
    if (typeof filename !== 'string' || typeof enable !== 'boolean') {
      res.status(400).json({ error: 'filename (string) and enable (boolean) are required' });
      return;
    }
    await pluginsService.toggle(filename, enable);
    await auditLogService.record(req.user!.username, enable ? 'Enabled plugin' : 'Disabled plugin', filename);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to toggle plugin');
  }
});

router.delete('/:filename', async (req: AuthedRequest, res) => {
  try {
    const { filename } = req.params;
    await pluginsService.delete(filename);
    await auditLogService.record(req.user!.username, 'Deleted plugin', filename);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to delete plugin');
  }
});

router.post('/install-url', async (req: AuthedRequest, res) => {
  try {
    const { url } = req.body ?? {};
    if (typeof url !== 'string' || !url.trim()) {
      res.status(400).json({ error: 'url is required' });
      return;
    }
    const plugin = await pluginsService.installFromUrl(url.trim());
    await auditLogService.record(req.user!.username, 'Installed plugin from URL', plugin.filename);
    res.json({ plugin });
  } catch (err) {
    sendError(res, err, 'Failed to install plugin');
  }
});

router.post('/install-file', upload.single('file'), async (req: AuthedRequest, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    const plugin = await pluginsService.installFromBuffer(file.originalname, file.buffer);
    await auditLogService.record(req.user!.username, 'Installed plugin from upload', plugin.filename);
    res.json({ plugin });
  } catch (err) {
    sendError(res, err, 'Failed to install plugin');
  }
});

export default router;
