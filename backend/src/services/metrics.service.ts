import { EventEmitter } from 'events';
import { env } from '../config/env';
import { rconService } from './rcon.service';
import { sshService } from './ssh.service';
import { MetricsSample } from '../types';

// No DB is used - samples live in this in-memory ring buffer and are lost on
// restart. To persist history, replace `history` with writes/reads against a
// time-series table (e.g. Postgres + TimescaleDB, or SQLite) here.
class MetricsService extends EventEmitter {
  private history: MetricsSample[] = [];
  private timer: NodeJS.Timeout | null = null;

  getHistory(): MetricsSample[] {
    return this.history;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.sample(), env.metrics.intervalMs);
    void this.sample();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async sample(): Promise<void> {
    const [players, tps, host] = await Promise.all([
      rconService.isConnected() ? rconService.getPlayers() : Promise.resolve(null),
      rconService.isConnected() ? this.getTps() : Promise.resolve(null),
      sshService.isConnected() ? this.getHostStats() : Promise.resolve(null),
    ]);

    const entry: MetricsSample = {
      timestamp: Date.now(),
      players,
      tps,
      cpuLoadPct: host?.cpuLoadPct ?? null,
      memUsedMB: host?.memUsedMB ?? null,
      memTotalMB: host?.memTotalMB ?? null,
      diskUsedPct: host?.diskUsedPct ?? null,
    };

    this.history.push(entry);
    if (this.history.length > env.metrics.historySize) {
      this.history.shift();
    }
    this.emit('sample', entry);
  }

  private async getTps(): Promise<number | null> {
    try {
      const { response } = await rconService.execute('tps');
      const match = response.match(/(\d+(\.\d+)?)/);
      return match ? parseFloat(match[1]) : null;
    } catch {
      return null;
    }
  }

  private async getHostStats(): Promise<{
    cpuLoadPct: number | null;
    memUsedMB: number | null;
    memTotalMB: number | null;
    diskUsedPct: number | null;
  } | null> {
    try {
      const [top, free, df] = await Promise.all([
        sshService.exec("top -bn1 | grep -i 'Cpu(s)'"),
        sshService.exec('free -m'),
        sshService.exec('df -P /'),
      ]);

      let cpuLoadPct: number | null = null;
      const idleMatch = top.stdout.match(/(\d+(\.\d+)?)\s*%?\s*id/i);
      if (idleMatch) {
        cpuLoadPct = Math.round((100 - parseFloat(idleMatch[1])) * 10) / 10;
      }

      let memUsedMB: number | null = null;
      let memTotalMB: number | null = null;
      const memLine = free.stdout.split('\n').find((l) => l.trim().startsWith('Mem:'));
      if (memLine) {
        const parts = memLine.trim().split(/\s+/);
        memTotalMB = parseInt(parts[1], 10);
        memUsedMB = parseInt(parts[2], 10);
      }

      let diskUsedPct: number | null = null;
      const dfLine = df.stdout.trim().split('\n')[1];
      if (dfLine) {
        const parts = dfLine.trim().split(/\s+/);
        const pct = parts[4]?.replace('%', '');
        if (pct) diskUsedPct = parseInt(pct, 10);
      }

      return { cpuLoadPct, memUsedMB, memTotalMB, diskUsedPct };
    } catch {
      return null;
    }
  }
}

export const metricsService = new MetricsService();
