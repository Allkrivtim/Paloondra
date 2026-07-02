import { WebSocket } from 'ws';
import { scriptsService } from '../services/scripts.service';
import { ConsoleLine } from '../types';

export function handleConsoleConnection(ws: WebSocket): void {
  ws.send(JSON.stringify({ type: 'history', lines: scriptsService.getHistory() }));

  const onLine = (line: ConsoleLine) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'line', ...line }));
    }
  };
  scriptsService.on('line', onLine);

  ws.on('close', () => {
    scriptsService.off('line', onLine);
  });
}
