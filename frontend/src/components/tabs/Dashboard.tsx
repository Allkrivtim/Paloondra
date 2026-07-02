import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../api/client';
import { getErrorMessage } from '../../api/errors';
import { useSocket } from '../../hooks/useSocket';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { ConsoleLine, MetricsSample, ScriptName, ServerStatus } from '../../types';
import StatCard from '../common/StatCard';
import Spinner from '../common/Spinner';

const ACTION_LABELS: Record<ScriptName, string> = { start: 'Start', stop: 'Stop', restart: 'Restart' };

const STATUS_POLL_MS = 5000;

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function Dashboard() {
  const toast = useToast();
  const dialog = useDialog();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [samples, setSamples] = useState<MetricsSample[]>([]);
  const [logLines, setLogLines] = useState<ConsoleLine[]>([]);
  const [busyAction, setBusyAction] = useState<ScriptName | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await api.get<ServerStatus>('/server/status');
        if (!cancelled) setStatus(res.data);
      } catch {
        if (!cancelled) setStatus({ online: false, rconConnected: false, lastChecked: Date.now() });
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    poll();
    const id = setInterval(poll, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const onMetricsMessage = useCallback((msg: any) => {
    if (msg.type === 'history') setSamples(msg.samples);
    else if (msg.type === 'sample') setSamples((prev) => [...prev.slice(-119), msg.sample]);
  }, []);
  useSocket('/ws/metrics', onMetricsMessage);

  const onConsoleMessage = useCallback((msg: any) => {
    if (msg.type === 'history') setLogLines(msg.lines);
    else if (msg.type === 'line') setLogLines((prev) => [...prev.slice(-499), msg]);
  }, []);
  useSocket('/ws/console', onConsoleMessage);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logLines]);

  async function runAction(action: ScriptName) {
    if (action === 'stop' || action === 'restart') {
      const confirmed = await dialog.confirm({
        title: `${ACTION_LABELS[action]} the server?`,
        message:
          action === 'stop'
            ? 'This disconnects any players currently online.'
            : 'This briefly disconnects any players currently online.',
        confirmLabel: ACTION_LABELS[action],
        danger: true,
      });
      if (!confirmed) return;
    }

    setBusyAction(action);
    try {
      await api.post(`/server/${action}`);
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to trigger ${action}`));
    } finally {
      setTimeout(() => setBusyAction(null), 1500);
    }
  }

  const latest = samples[samples.length - 1];
  const chartData = samples.map((s) => ({
    time: formatTime(s.timestamp),
    players: s.players?.online ?? 0,
    cpu: s.cpuLoadPct ?? null,
    mem: s.memTotalMB ? Math.round(((s.memUsedMB ?? 0) / s.memTotalMB) * 1000) / 10 : null,
    disk: s.diskUsedPct ?? null,
  }));

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <section className="flex flex-col gap-4 rounded-xl border border-panel-border bg-panel-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {statusLoading ? (
            <Spinner />
          ) : (
            <span
              className={`h-3 w-3 rounded-full ${
                status?.online ? 'bg-panel-accent shadow-[0_0_8px_2px_rgba(74,222,128,0.6)]' : 'bg-panel-danger'
              }`}
            />
          )}
          <div>
            <div className="text-sm font-semibold text-panel-text">
              {statusLoading ? 'Checking status...' : `Server is ${status?.online ? 'Online' : 'Offline'}`}
            </div>
            {!statusLoading && (
              <div className="text-xs text-panel-muted">
                RCON: {status?.rconConnected ? 'connected' : 'disconnected'}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runAction('start')}
            disabled={busyAction !== null}
            className="rounded-lg bg-panel-accent2 px-4 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {busyAction === 'start' ? 'Starting...' : 'Start'}
          </button>
          <button
            onClick={() => runAction('restart')}
            disabled={busyAction !== null}
            className="rounded-lg border border-panel-warn text-panel-warn px-4 py-2 text-sm font-medium transition hover:bg-panel-warn/10 disabled:opacity-50"
          >
            {busyAction === 'restart' ? 'Restarting...' : 'Restart'}
          </button>
          <button
            onClick={() => runAction('stop')}
            disabled={busyAction !== null}
            className="rounded-lg border border-panel-danger text-panel-danger px-4 py-2 text-sm font-medium transition hover:bg-panel-danger/10 disabled:opacity-50"
          >
            {busyAction === 'stop' ? 'Stopping...' : 'Stop'}
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Players Online"
          value={latest?.players ? `${latest.players.online}${latest.players.max ? ` / ${latest.players.max}` : ''}` : '—'}
          sub={latest?.players?.names.join(', ') || undefined}
        />
        <StatCard label="TPS" value={latest?.tps != null ? latest.tps.toFixed(1) : '—'} />
        <StatCard label="Host CPU" value={latest?.cpuLoadPct != null ? `${latest.cpuLoadPct}%` : '—'} />
        <StatCard
          label="Host RAM"
          value={
            latest?.memUsedMB != null && latest?.memTotalMB != null
              ? `${latest.memUsedMB} / ${latest.memTotalMB} MB`
              : '—'
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="relative rounded-xl border border-panel-border bg-panel-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-panel-text">Players Online</h2>
          {samples.length === 0 && <ChartEmptyState />}
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3d" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} minTickGap={30} />
              <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#161922', border: '1px solid #2a2f3d', fontSize: 12 }} />
              <Line type="monotone" dataKey="players" stroke="#4ade80" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="relative rounded-xl border border-panel-border bg-panel-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-panel-text">Host Resource Usage (%)</h2>
          {samples.length === 0 && <ChartEmptyState />}
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3d" />
              <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} minTickGap={30} />
              <YAxis stroke="#9ca3af" fontSize={11} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#161922', border: '1px solid #2a2f3d', fontSize: 12 }} />
              <Line type="monotone" dataKey="cpu" name="CPU" stroke="#60a5fa" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="mem" name="RAM" stroke="#fbbf24" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="disk" name="Disk" stroke="#f87171" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-panel-border bg-panel-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-panel-text">Live Server Output</h2>
        <div
          ref={logRef}
          className="h-56 overflow-y-auto rounded-lg bg-black/40 p-3 font-mono text-xs leading-relaxed"
        >
          {logLines.length === 0 && <div className="text-panel-muted">No output yet.</div>}
          {logLines.map((l, i) => (
            <div
              key={i}
              className={
                l.stream === 'stderr'
                  ? 'text-panel-danger'
                  : l.stream === 'system'
                    ? 'text-panel-warn'
                    : 'text-panel-text'
              }
            >
              <span className="text-panel-muted">[{formatTime(l.timestamp)}]</span> {l.line}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChartEmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-xs text-panel-muted">
      Waiting for the first metrics sample...
    </div>
  );
}
