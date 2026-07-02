import express from 'express';
import cors from 'cors';
import http from 'http';
import { env } from './config/env';
import authRoutes from './routes/auth.routes';
import serverRoutes from './routes/server.routes';
import sftpRoutes from './routes/sftp.routes';
import metricsRoutes from './routes/metrics.routes';
import pluginsRoutes from './routes/plugins.routes';
import pluginStoreRoutes from './routes/pluginStore.routes';
import backupsRoutes from './routes/backups.routes';
import schedulerRoutes from './routes/scheduler.routes';
import serverPropertiesRoutes from './routes/serverProperties.routes';
import rconRoutes from './routes/rcon.routes';
import auditLogRoutes from './routes/auditLog.routes';
import { setupWebSockets } from './ws';
import { rconService } from './services/rcon.service';
import { sshService } from './services/ssh.service';
import { fileManagerService } from './services/fileManager.service';
import { metricsService } from './services/metrics.service';
import { schedulerService } from './services/scheduler.service';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/server', serverRoutes);
app.use('/api/sftp', sftpRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/plugins/store', pluginStoreRoutes);
app.use('/api/plugins', pluginsRoutes);
app.use('/api/backups', backupsRoutes);
app.use('/api/scheduler/tasks', schedulerRoutes);
app.use('/api/server-properties', serverPropertiesRoutes);
app.use('/api/rcon', rconRoutes);
app.use('/api/audit-log', auditLogRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
setupWebSockets(server);

server.listen(env.port, () => {
  console.log(`Paloondra backend listening on port ${env.port}`);
});

// Persistent, pre-configured connections - established once at startup from
// .env. There is no in-app connection setup; every tab is already wired to
// this single target server.
rconService.start();
sshService.start();
fileManagerService.start();
metricsService.start();
void schedulerService.start();

function shutdown() {
  console.log('Shutting down...');
  metricsService.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
