import { Router } from 'express';
import { verifyCredentials, issueToken } from '../auth/auth';
import { requireAuth, AuthedRequest } from '../auth/middleware';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const valid = await verifyCredentials(username, password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = issueToken(username);
  res.json({ token, username });
});

// Stateless JWT - nothing to invalidate server side, endpoint exists for symmetry.
router.post('/logout', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ username: req.user!.username });
});

export default router;
