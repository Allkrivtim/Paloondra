import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { AuthedRequest, requireAuth, requirePermission } from '../auth/middleware';
import { fileManagerService, resolveDefaultPath } from '../services/fileManager.service';
import { env } from '../config/env';
import { assertWithinRoot, ScopeViolationError, sendError } from './routeUtils';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

router.use(requireAuth);
router.use(requirePermission('sftp'));

function normalizePath(p: unknown): string {
  const raw = typeof p === 'string' && p.trim() ? p : '/';
  return path.posix.normalize('/' + raw);
}

/** Admins are never restricted; a 'user' account's root comes from their StoredUser.sftpRootPath (null = unrestricted). */
function effectiveRoot(req: AuthedRequest): string | null {
  return req.user!.role === 'admin' ? null : req.user!.sftpRootPath;
}

/** Normalizes `p` and enforces it's within the request user's sftpRootPath, if any. */
function scopedPath(req: AuthedRequest, p: unknown): string {
  const normalized = normalizePath(p);
  assertWithinRoot(effectiveRoot(req), normalized);
  return normalized;
}

/** ScopeViolationError maps to 403 regardless of the route's usual fallback status; everything else keeps that fallback. */
function handleError(res: Parameters<typeof sendError>[0], err: unknown, fallback: string, fallbackStatus = 500): void {
  sendError(res, err, fallback, err instanceof ScopeViolationError ? 403 : fallbackStatus);
}

router.get('/default-path', async (req: AuthedRequest, res) => {
  try {
    // A scoped user's "default" is simply their root - no point resolving
    // SFTP_DEFAULT_PATH/home dir, both of which are likely outside it.
    const root = effectiveRoot(req);
    res.json({ path: root ?? (await resolveDefaultPath()) });
  } catch (err) {
    handleError(res, err, 'Failed to resolve default directory');
  }
});

router.get('/list', async (req: AuthedRequest, res) => {
  try {
    const dirPath = scopedPath(req, req.query.path);
    const entries = await fileManagerService.list(dirPath);
    res.json({ path: dirPath, entries });
  } catch (err) {
    handleError(res, err, 'Failed to list directory');
  }
});

router.post('/mkdir', async (req: AuthedRequest, res) => {
  try {
    const dirPath = scopedPath(req, req.body?.path);
    await fileManagerService.mkdir(dirPath);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'Failed to create directory');
  }
});

router.post('/rename', async (req: AuthedRequest, res) => {
  try {
    const from = scopedPath(req, req.body?.from);
    const to = scopedPath(req, req.body?.to);
    await fileManagerService.rename(from, to);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'Failed to rename');
  }
});

// Move is functionally identical to rename, kept as a distinct endpoint to
// mirror the "move between folders" UI action.
router.post('/move', async (req: AuthedRequest, res) => {
  try {
    const from = scopedPath(req, req.body?.from);
    const to = scopedPath(req, req.body?.to);
    await fileManagerService.rename(from, to);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'Failed to move');
  }
});

router.delete('/item', async (req: AuthedRequest, res) => {
  try {
    const targetPath = scopedPath(req, req.query.path);
    await fileManagerService.delete(targetPath);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'Failed to delete');
  }
});

router.get('/download', async (req: AuthedRequest, res) => {
  try {
    const filePath = scopedPath(req, req.query.path);
    const info = await fileManagerService.stat(filePath);
    if (info.type !== 'file') {
      res.status(400).json({ error: 'Not a file' });
      return;
    }
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(info.name)}"`);
    res.setHeader('Content-Length', String(info.size));
    const stream = await fileManagerService.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch (err) {
    handleError(res, err, 'Failed to download');
  }
});

router.post('/upload', upload.array('files'), async (req: AuthedRequest, res) => {
  try {
    const destDir = scopedPath(req, req.query.path);
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }
    for (const file of files) {
      // basename() strips any directory components a crafted originalname
      // could carry (e.g. "../../etc/passwd") - without this, an upload
      // could write outside destDir entirely, scoped root or not.
      const destPath = path.posix.join(destDir, path.posix.basename(file.originalname));
      await fileManagerService.writeBuffer(destPath, file.buffer);
    }
    res.json({ ok: true, uploaded: files.map((f) => f.originalname) });
  } catch (err) {
    handleError(res, err, 'Upload failed');
  }
});

router.get('/file', async (req: AuthedRequest, res) => {
  try {
    const filePath = scopedPath(req, req.query.path);
    const content = await fileManagerService.readTextFile(filePath, env.editor.maxFileSize);
    res.json({ path: filePath, content });
  } catch (err) {
    handleError(res, err, 'Failed to read file', 400);
  }
});

router.put('/file', async (req: AuthedRequest, res) => {
  try {
    const filePath = scopedPath(req, req.body?.path);
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    await fileManagerService.writeTextFile(filePath, content);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, 'Failed to save file');
  }
});

export default router;
