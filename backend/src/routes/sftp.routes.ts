import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../auth/middleware';
import { fileManagerService, resolveDefaultPath } from '../services/fileManager.service';
import { env } from '../config/env';
import { sendError } from './routeUtils';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

router.use(requireAuth);

function normalizePath(p: unknown): string {
  const raw = typeof p === 'string' && p.trim() ? p : '/';
  return path.posix.normalize('/' + raw);
}

router.get('/default-path', async (_req, res) => {
  try {
    res.json({ path: await resolveDefaultPath() });
  } catch (err) {
    sendError(res, err, 'Failed to resolve default directory');
  }
});

router.get('/list', async (req, res) => {
  try {
    const dirPath = normalizePath(req.query.path);
    const entries = await fileManagerService.list(dirPath);
    res.json({ path: dirPath, entries });
  } catch (err) {
    sendError(res, err, 'Failed to list directory');
  }
});

router.post('/mkdir', async (req, res) => {
  try {
    const dirPath = normalizePath(req.body?.path);
    await fileManagerService.mkdir(dirPath);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to create directory');
  }
});

router.post('/rename', async (req, res) => {
  try {
    const from = normalizePath(req.body?.from);
    const to = normalizePath(req.body?.to);
    await fileManagerService.rename(from, to);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to rename');
  }
});

// Move is functionally identical to rename, kept as a distinct endpoint to
// mirror the "move between folders" UI action.
router.post('/move', async (req, res) => {
  try {
    const from = normalizePath(req.body?.from);
    const to = normalizePath(req.body?.to);
    await fileManagerService.rename(from, to);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to move');
  }
});

router.delete('/item', async (req, res) => {
  try {
    const targetPath = normalizePath(req.query.path);
    await fileManagerService.delete(targetPath);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to delete');
  }
});

router.get('/download', async (req, res) => {
  try {
    const filePath = normalizePath(req.query.path);
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
    sendError(res, err, 'Failed to download');
  }
});

router.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const destDir = normalizePath(req.query.path);
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }
    for (const file of files) {
      const destPath = path.posix.join(destDir, file.originalname);
      await fileManagerService.writeBuffer(destPath, file.buffer);
    }
    res.json({ ok: true, uploaded: files.map((f) => f.originalname) });
  } catch (err) {
    sendError(res, err, 'Upload failed');
  }
});

router.get('/file', async (req, res) => {
  try {
    const filePath = normalizePath(req.query.path);
    const content = await fileManagerService.readTextFile(filePath, env.editor.maxFileSize);
    res.json({ path: filePath, content });
  } catch (err) {
    sendError(res, err, 'Failed to read file', 400);
  }
});

router.put('/file', async (req, res) => {
  try {
    const filePath = normalizePath(req.body?.path);
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    await fileManagerService.writeTextFile(filePath, content);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err, 'Failed to save file');
  }
});

export default router;
