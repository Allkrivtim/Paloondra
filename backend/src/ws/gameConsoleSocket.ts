import { WebSocket } from 'ws';
import { gameConsoleService } from '../services/gameConsole.service';
import { ConsoleLine } from '../types';

type ClientMessage = { type: 'send'; command: string };

export function handleGameConsoleConnection(ws: WebSocket): void {
  ws.send(JSON.stringify({ type: 'status', ...gameConsoleService.getStatus() }));
  ws.send(JSON.stringify({ type: 'history', lines: gameConsoleService.getHistory() }));

  const onLine = (line: ConsoleLine) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'line', ...line }));
    }
  };
  const onStatus = (status: unknown) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'status', ...(status as object) }));
    }
  };
  gameConsoleService.on('line', onLine);
  gameConsoleService.on('status', onStatus);

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type !== 'send' || typeof msg.command !== 'string' || !msg.command.trim()) {
      return;
    }
    // sendCommand() never rejects - failures are pushed into the shared
    // console history for every connected client to see, same as a normal
    // server console line.
    void gameConsoleService.sendCommand(msg.command.trim());
  });

  ws.on('close', () => {
    gameConsoleService.off('line', onLine);
    gameConsoleService.off('status', onStatus);
  });
}
