import { useCallback, useEffect, useState } from 'react';
import { listAuditLog } from '../../api/auditLog';
import { getErrorMessage } from '../../api/errors';
import { AuditLogEntry } from '../../types';
import Spinner from '../common/Spinner';

const POLL_MS = 15000;

function formatTime(ts: number) {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await listAuditLog(15));
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load audit log'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-panel-text">Recent Activity</h2>
      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-panel-muted">
          <Spinner className="h-3.5 w-3.5" /> Loading...
        </div>
      )}
      {!loading && error && <p className="text-sm text-panel-danger">{error}</p>}
      {!loading && !error && entries.length === 0 && (
        <p className="text-sm text-panel-muted">No actions recorded yet.</p>
      )}
      {!loading && !error && entries.length > 0 && (
        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto text-xs">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 border-b border-panel-border/50 pb-1.5 last:border-0">
              <span className="whitespace-nowrap text-panel-muted">{formatTime(entry.timestamp)}</span>
              <span className="min-w-0 flex-1">
                <span className="text-panel-accent">{entry.username}</span>{' '}
                <span className="text-panel-text">{entry.action}</span>
                {entry.details && <span className="text-panel-muted"> — {entry.details}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
