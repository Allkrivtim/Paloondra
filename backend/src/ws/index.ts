import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { verifyToken } from '../auth/auth';
import { usersService } from '../services/users.service';
import { handleConsoleConnection } from './consoleSocket';
import { handleGameConsoleConnection } from './gameConsoleSocket';
import { handleSshConnection } from './sshSocket';
import { handleMetricsConnection } from './metricsSocket';
import { PermissionKey } from '../types';

const ROUTES: Record<string, (ws: WebSocket) => void> = {
  '/ws/console': handleConsoleConnection,
  '/ws/game-console': handleGameConsoleConnection,
  '/ws/ssh': handleSshConnection,
  '/ws/metrics': handleMetricsConnection,
};

// Permission required to open each channel - omitted entries (/ws/console,
// the Dashboard's script-output panel, and /ws/metrics) are read-only
// monitoring and stay open to every authenticated user, matching
// metrics.routes.ts/auditLog.routes.ts on the REST side.
const ROUTE_PERMISSIONS: Partial<Record<string, PermissionKey>> = {
  '/ws/game-console': 'console',
  '/ws/ssh': 'ssh',
};

export function setupWebSockets(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    void (async () => {
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
        const payload = verifyToken(token);
        // Also confirm the user still exists - a WS connection shouldn't
        // keep working after their account is removed, same as REST calls
        // via requireAuth (see auth/middleware.ts).
        const user = await usersService.findByUsername(payload.username);
        if (!user) throw new Error('User no longer exists');

        const requiredPermission = ROUTE_PERMISSIONS[url.pathname];
        if (requiredPermission && user.role !== 'admin' && !user.permissions.includes(requiredPermission)) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        handler(ws);
      });
    })();
  });
}
