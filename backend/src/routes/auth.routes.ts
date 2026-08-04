import { Router } from 'express';
import { verifyCredentials, issueToken } from '../auth/auth';
import { requireAuth, AuthedRequest } from '../auth/middleware';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = issueToken(user.username);
  res.json({ token, username: user.username, role: user.role, permissions: user.permissions });
});

// Stateless JWT - nothing to invalidate server side, endpoint exists for symmetry.
router.post('/logout', requireAuth, (_req, res) => {
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ username: req.user!.username, role: req.user!.role, permissions: req.user!.permissions });
});

export default router;
