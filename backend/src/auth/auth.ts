import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { usersService } from '../services/users.service';
import { StoredUser } from '../types';

export interface TokenPayload {
  username: string;
}

/** Resolves to the matched user (role included) on success, null on a bad username/password. */
export async function verifyCredentials(username: string, password: string): Promise<StoredUser | null> {
  return usersService.verifyCredentials(username, password);
}

export function issueToken(username: string): string {
  return jwt.sign({ username } as TokenPayload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}
