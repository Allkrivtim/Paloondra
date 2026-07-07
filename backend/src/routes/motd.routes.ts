import { Router } from 'express';
import YAML from 'yaml';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { fileManagerService } from '../services/fileManager.service';
import { auditLogService } from '../services/auditLog.service';
import { env } from '../config/env';
import { sendError } from './routeUtils';
import { motdConfigPath, extractMotdValues, applyMotdUpdate, reloadBetterMotd } from '../services/motd.service';

const router = Router();

router.use(requireAuth);

router.get('/', async (_req, res) => {
  const filePath = motdConfigPath();
  let raw: string;
  try {
    raw = await fileManagerService.readTextFile(filePath, env.editor.maxFileSize);
  } catch {
    res.status(404).json({
      error: `BetterMOTD config not found at ${filePath} - install the BetterMOTD plugin and start the server once so it generates its default config.yml, or set BETTERMOTD_CONFIG_PATH if it lives somewhere else.`,
    });
    return;
  }
  try {
    res.json({ path: filePath, raw, values: extractMotdValues(raw) });
  } catch (err) {
    sendError(res, err, 'Failed to read BetterMOTD config');
  }
});

router.put('/', async (req: AuthedRequest, res) => {
  try {
    const filePath = motdConfigPath();
    const body = req.body ?? {};

    let raw: string;
    if (typeof body.raw === 'string') {
      // Raw mode: full-file overwrite. Defense in depth - the frontend's
      // Monaco/js-yaml guard should already block this, but never write a
      // file a direct API call could corrupt.
      try {
        YAML.parse(body.raw);
      } catch (parseErr) {
        res.status(400).json({ error: `Invalid YAML: ${(parseErr as Error).message}` });
        return;
      }
      raw = body.raw;
    } else if (body.updates && typeof body.updates === 'object') {
      // Form mode: only the specific top-level keys the user touched are
      // replaced - everything else (comments, ordering, other sections) is
      // preserved exactly, since this mutates the parsed Document's nodes
      // in place rather than reserializing from scratch.
      let current: string;
      try {
        current = await fileManagerService.readTextFile(filePath, env.editor.maxFileSize);
      } catch {
        res.status(404).json({ error: `BetterMOTD config not found at ${filePath}` });
        return;
      }
      try {
        raw = applyMotdUpdate(current, body.updates);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
    } else {
      res.status(400).json({ error: 'Provide either { raw } or { updates }' });
      return;
    }

    await fileManagerService.writeTextFile(filePath, raw);
    await auditLogService.record(req.user!.username, 'Saved BetterMOTD config.yml');

    // BetterMOTD reloads live via its own RCON command - never a vanilla
    // /reload and never a server restart. The save above already
    // succeeded regardless of whether this reload call itself works, so a
    // failed reload is reported alongside the saved content rather than
    // failing the whole request.
    let reload: { response: string } | { error: string };
    try {
      reload = { response: await reloadBetterMotd() };
    } catch (err) {
      reload = { error: (err as Error).message };
    }

    res.json({ path: filePath, raw, values: extractMotdValues(raw), reload });
  } catch (err) {
    sendError(res, err, 'Failed to save BetterMOTD config');
  }
});

router.post('/reload', async (req: AuthedRequest, res) => {
  try {
    const response = await reloadBetterMotd();
    await auditLogService.record(req.user!.username, 'Reloaded BetterMOTD');
    res.json({ message: response });
  } catch (err) {
    sendError(res, err, 'Failed to reload BetterMOTD');
  }
});

export default router;
