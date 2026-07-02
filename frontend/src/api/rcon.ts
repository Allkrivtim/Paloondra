import { api } from './client';

export interface RconCommandResult {
  command: string;
  response: string;
  timestamp: number;
}

/** One-off RCON command over REST (audit-logged) - for quick actions (kick/ban/op/whitelist/broadcast), not the interactive console (which uses its own WebSocket channel). */
export async function runRconCommand(command: string): Promise<RconCommandResult> {
  const res = await api.post('/rcon/command', { command });
  return res.data;
}
