import { Router } from 'express';
import path from 'path';
import YAML from 'yaml';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { fileManagerService } from '../services/fileManager.service';
import { auditLogService } from '../services/auditLog.service';
import { env } from '../config/env';
import { sendError, requireServerRootDir } from './routeUtils';
import { ServerFileKey } from '../types';

const router = Router();

router.use(requireAuth);

const FILENAMES: Record<ServerFileKey, string> = {
  bukkit: 'bukkit.yml',
  spigot: 'spigot.yml',
};

function requireFilePath(key: string): { key: ServerFileKey; filename: string; fullPath: string } {
  if (key !== 'bukkit' && key !== 'spigot') {
    throw new Error(`Unknown server file "${key}"`);
  }
  const filename = FILENAMES[key];
  return { key, filename, fullPath: path.posix.join(requireServerRootDir(), filename) };
}

router.get('/:key', async (req, res) => {
  try {
    const { filename, fullPath } = requireFilePath(req.params.key);
    const raw = await fileManagerService.readTextFile(fullPath, env.editor.maxFileSize);
    res.json({ filename, raw });
  } catch (err) {
    sendError(res, err, 'Failed to read file');
  }
});

router.put('/:key', async (req: AuthedRequest, res) => {
  try {
    const { key, filename, fullPath } = requireFilePath(req.params.key);
    const { raw } = req.body ?? {};
    if (typeof raw !== 'string') {
      res.status(400).json({ error: 'raw is required' });
      return;
    }

    // Defense in depth: the frontend's Monaco/js-yaml guard should already
    // block this, but never write a file a direct API call could corrupt.
    try {
      YAML.parse(raw);
    } catch (parseErr) {
      res.status(400).json({ error: `Invalid YAML: ${(parseErr as Error).message}` });
      return;
    }

    await fileManagerService.writeTextFile(fullPath, raw);
    await auditLogService.record(req.user!.username, `Saved ${filename}`);
    res.json({ filename, raw, key });
  } catch (err) {
    sendError(res, err, 'Failed to save file');
  }
});

export default router;
