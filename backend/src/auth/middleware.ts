import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './auth';
import { usersService } from '../services/users.service';
import { PermissionKey, UserRole } from '../types';

export interface AuthedRequest extends Request {
  user?: { username: string; role: UserRole; permissions: PermissionKey[]; sftpRootPath: string | null };
}

/**
 * Verifies the JWT AND that the user it names still exists, looking up
 * their CURRENT role every request rather than trusting a role baked into
 * the token. Two reasons: the token payload only ever carries `username`
 * (see auth.ts), and a role change or account deletion needs to take
 * effect immediately - not up to JWT_EXPIRES_IN later, which for a
 * "revoke admin rights" or "remove this person's access" action would
 * otherwise leave a real window where the old permissions still work.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = verifyToken(token);
    const user = await usersService.findByUsername(payload.username);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = { username: user.username, role: user.role, permissions: user.permissions, sftpRootPath: user.sftpRootPath };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Chain after requireAuth on any route only admins should reach (currently just /api/users). */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Chain after requireAuth on any route that should be restricted by a
 * granular permission key. Admins always bypass this check - permissions
 * are only ever meaningful for role: 'user' accounts (see StoredUser).
 */
export function requirePermission(key: PermissionKey) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (req.user?.role === 'admin' || req.user?.permissions.includes(key)) {
      next();
      return;
    }
    res.status(403).json({ error: 'You do not have permission to access this feature' });
  };
}
