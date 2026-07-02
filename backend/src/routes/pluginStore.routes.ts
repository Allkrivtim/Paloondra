import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { modrinthService, ModrinthError } from '../services/modrinth.service';
import { pluginsService } from '../services/plugins.service';
import { auditLogService } from '../services/auditLog.service';
import { sendError } from './routeUtils';

const router = Router();

router.use(requireAuth);

function handleModrinthError(res: Parameters<typeof sendError>[0], err: unknown, fallback: string): void {
  if (err instanceof ModrinthError) {
    sendError(res, err, fallback, err.status === 429 ? 429 : err.status === 404 ? 404 : 502);
    return;
  }
  sendError(res, err, fallback);
}

router.get('/search', async (req, res) => {
  try {
    const result = await modrinthService.search({
      query: typeof req.query.query === 'string' ? req.query.query : undefined,
      gameVersion: typeof req.query.gameVersion === 'string' ? req.query.gameVersion : undefined,
      loader: typeof req.query.loader === 'string' ? req.query.loader : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      offset: req.query.offset ? parseInt(String(req.query.offset), 10) : undefined,
      limit: req.query.limit ? parseInt(String(req.query.limit), 10) : undefined,
    });
    res.json(result);
  } catch (err) {
    handleModrinthError(res, err, 'Modrinth search failed');
  }
});

router.get('/project/:id', async (req, res) => {
  try {
    res.json(await modrinthService.getProject(req.params.id));
  } catch (err) {
    handleModrinthError(res, err, 'Failed to load plugin details');
  }
});

router.get('/project/:id/versions', async (req, res) => {
  try {
    res.json(await modrinthService.getVersions(req.params.id));
  } catch (err) {
    handleModrinthError(res, err, 'Failed to load plugin versions');
  }
});

// Only Modrinth's own CDN is allowed here - this endpoint exists to install
// a specific version's file the client just fetched via the two routes
// above, not as a general "fetch any URL" proxy (that's install-url on
// plugins.routes.ts, a deliberately separate, explicitly-named feature).
const ALLOWED_HOSTS = ['cdn.modrinth.com'];

router.post('/install', async (req: AuthedRequest, res) => {
  try {
    const { fileUrl, projectTitle, versionNumber } = req.body ?? {};
    if (typeof fileUrl !== 'string' || !fileUrl.trim()) {
      res.status(400).json({ error: 'fileUrl is required' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      res.status(400).json({ error: 'fileUrl is not a valid URL' });
      return;
    }
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      res.status(400).json({ error: `fileUrl must be hosted on ${ALLOWED_HOSTS.join(', ')}` });
      return;
    }

    const plugin = await pluginsService.installFromUrl(fileUrl);
    const label = [projectTitle, versionNumber].filter((v) => typeof v === 'string' && v).join(' ');
    await auditLogService.record(
      req.user!.username,
      'Installed plugin from Modrinth',
      label ? `${label} -> ${plugin.filename}` : plugin.filename,
    );
    res.json({ plugin });
  } catch (err) {
    sendError(res, err, 'Failed to install plugin');
  }
});

export default router;
