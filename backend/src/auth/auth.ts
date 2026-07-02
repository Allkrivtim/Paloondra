import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  username: string;
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const user = env.users.find((u) => u.username === username);
  if (!user) {
    // Still run a bcrypt compare against a dummy hash to avoid leaking
    // via response-time whether a username exists.
    await bcrypt.compare(password, '$2b$10$0000000000000000000000000000000000000000000000');
    return false;
  }
  return bcrypt.compare(password, user.passwordHash);
}

export function issueToken(username: string): string {
  return jwt.sign({ username } as TokenPayload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}
