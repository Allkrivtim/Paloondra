import { WebSocket } from 'ws';
import { rconService } from '../services/rcon.service';

type ClientMessage = { type: 'exec'; command: string; id?: string };

export function handleRconConnection(ws: WebSocket): void {
  ws.send(JSON.stringify({ type: 'status', ...rconService.getStatus() }));

  const onStatus = (status: unknown) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'status', ...(status as object) }));
    }
  };
  rconService.on('status', onStatus);

  ws.on('message', async (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== 'exec' || typeof msg.command !== 'string' || !msg.command.trim()) {
      return;
    }

    try {
      const result = await rconService.execute(msg.command);
      ws.send(JSON.stringify({ type: 'result', id: msg.id, ...result }));
    } catch (err) {
      ws.send(
        JSON.stringify({
          type: 'error',
          id: msg.id,
          command: msg.command,
          error: err instanceof Error ? err.message : 'RCON command failed',
          timestamp: Date.now(),
        }),
      );
    }
  });

  ws.on('close', () => {
    rconService.off('status', onStatus);
  });
}
