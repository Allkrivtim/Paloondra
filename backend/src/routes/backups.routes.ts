import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../auth/middleware';
import { fileManagerService } from '../services/fileManager.service';
import { auditLogService } from '../services/auditLog.service';
import { env } from '../config/env';
import { sendError, safeJoinFilename } from './routeUtils';
import { BackupInfo } from '../types';

const router = Router();

router.use(requireAuth);

function requireDir(): string {
  if (!env.backups.dir) {
    throw new Error('BACKUPS_DIR is not configured - set it in backend/.env to use the Backups tab');
  }
  return env.backups.dir;
}

// Triggering a backup just runs BACKUP_SCRIPT, same as Start/Stop/Restart -
// see POST /api/server/backup in server.routes.ts. This file only lists/
// deletes the archives that script produces. Downloads reuse the generic
// /api/sftp/download endpoint directly (a backup archive is just a file
// reachable over the same SFTP/sudo transport).

router.get('/', async (_req, res) => {
  try {
    const dir = requireDir();
    const entries = await fileManagerService.list(dir);
    const backups: BackupInfo[] = entries
      .filter((e) => e.type === 'file')
      .map((e) => ({ filename: e.name, path: e.path, size: e.size, modifiedAt: e.modifiedAt }))
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
    res.json({ backups });
  } catch (err) {
    sendError(res, err, 'Failed to list backups');
  }
});

router.delete('/:filename', async (req: AuthedRequest, res) => {
  try {
    const dir = requireDir();
    const filePath = safeJoinFilename(dir, req.params.filename);
    await fileManagerService.delete(filePath);
    await auditLogService.record(req.user!.username, 'Deleted backup', req.params.filename);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to delete backup');
  }
});

export default router;
