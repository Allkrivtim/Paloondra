import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth } from '../auth/middleware';
import { sftpService } from '../services/sftp.service';
import { env } from '../config/env';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

router.use(requireAuth);

function normalizePath(p: unknown): string {
  const raw = typeof p === 'string' && p.trim() ? p : '/';
  const normalized = path.posix.normalize('/' + raw);
  return normalized;
}

router.get('/list', async (req, res) => {
  try {
    const dirPath = normalizePath(req.query.path);
    const entries = await sftpService.list(dirPath);
    res.json({ path: dirPath, entries });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list directory' });
  }
});

router.post('/mkdir', async (req, res) => {
  try {
    const dirPath = normalizePath(req.body?.path);
    await sftpService.mkdir(dirPath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create directory' });
  }
});

router.post('/rename', async (req, res) => {
  try {
    const from = normalizePath(req.body?.from);
    const to = normalizePath(req.body?.to);
    await sftpService.rename(from, to);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to rename' });
  }
});

// Move is functionally identical to rename for SFTP, kept as a distinct
// endpoint to mirror the "move between folders" UI action.
router.post('/move', async (req, res) => {
  try {
    const from = normalizePath(req.body?.from);
    const to = normalizePath(req.body?.to);
    await sftpService.rename(from, to);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to move' });
  }
});

router.delete('/item', async (req, res) => {
  try {
    const targetPath = normalizePath(req.query.path);
    await sftpService.delete(targetPath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete' });
  }
});

router.get('/download', async (req, res) => {
  try {
    const filePath = normalizePath(req.query.path);
    const info = await sftpService.stat(filePath);
    if (info.type !== 'file') {
      return res.status(400).json({ error: 'Not a file' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(info.name)}"`);
    res.setHeader('Content-Length', String(info.size));
    const stream = await sftpService.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to download' });
  }
});

router.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const destDir = normalizePath(req.query.path);
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    for (const file of files) {
      const destPath = path.posix.join(destDir, file.originalname);
      const stream = await sftpService.createWriteStream(destPath);
      await new Promise<void>((resolve, reject) => {
        stream.on('error', reject);
        stream.on('close', () => resolve());
        stream.end(file.buffer);
      });
    }
    res.json({ ok: true, uploaded: files.map((f) => f.originalname) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

router.get('/file', async (req, res) => {
  try {
    const filePath = normalizePath(req.query.path);
    const content = await sftpService.readTextFile(filePath, env.editor.maxFileSize);
    res.json({ path: filePath, content });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to read file' });
  }
});

router.put('/file', async (req, res) => {
  try {
    const filePath = normalizePath(req.body?.path);
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    await sftpService.writeTextFile(filePath, content);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save file' });
  }
});

export default router;
