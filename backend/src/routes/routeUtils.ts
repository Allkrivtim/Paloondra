import { Response } from 'express';

/** Logs the real error server-side and sends a safe message to the client. */
export function sendError(res: Response, err: unknown, fallback: string, status = 500): void {
  // eslint-disable-next-line no-console
  console.error(fallback, err);
  const message = err instanceof Error ? err.message : fallback;
  res.status(status).json({ error: message });
}
