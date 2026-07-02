import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { verifyToken } from '../auth/auth';
import { handleConsoleConnection } from './consoleSocket';
import { handleRconConnection } from './rconSocket';
import { handleSshConnection } from './sshSocket';
import { handleMetricsConnection } from './metricsSocket';

const ROUTES: Record<string, (ws: WebSocket) => void> = {
  '/ws/console': handleConsoleConnection,
  '/ws/rcon': handleRconConnection,
  '/ws/ssh': handleSshConnection,
  '/ws/metrics': handleMetricsConnection,
};

export function setupWebSockets(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const handler = ROUTES[url.pathname];

    if (!handler) {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      verifyToken(token);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      handler(ws);
    });
  });
}
