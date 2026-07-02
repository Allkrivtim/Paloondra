import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { RconLogEntry } from '../../types';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function RconConsole() {
  const [log, setLog] = useState<RconLogEntry[]>([]);
  const [rconConnected, setRconConnected] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const historyIndexRef = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const onMessage = useCallback((msg: any) => {
    if (msg.type === 'status') {
      setRconConnected(!!msg.rconConnected);
    } else if (msg.type === 'result') {
      setLog((prev) => [
        ...prev.slice(-499),
        { id: msg.id ?? makeId(), command: msg.command, response: msg.response, timestamp: msg.timestamp },
      ]);
    } else if (msg.type === 'error') {
      setLog((prev) => [
        ...prev.slice(-499),
        { id: msg.id ?? makeId(), command: msg.command, error: msg.error, timestamp: msg.timestamp },
      ]);
    }
  }, []);

  const { connected, send } = useSocket('/ws/rcon', onMessage);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  function submit() {
    const command = input.trim();
    if (!command) return;
    send({ type: 'exec', command, id: makeId() });
    setHistory((prev) => [...prev, command]);
    historyIndexRef.current = null;
    setInput('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = historyIndexRef.current === null ? history.length - 1 : Math.max(0, historyIndexRef.current - 1);
      historyIndexRef.current = idx;
      setInput(history[idx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndexRef.current === null) return;
      const idx = historyIndexRef.current + 1;
      if (idx >= history.length) {
        historyIndexRef.current = null;
        setInput('');
      } else {
        historyIndexRef.current = idx;
        setInput(history[idx]);
      }
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${rconConnected ? 'bg-panel-accent' : 'bg-panel-danger'}`} />
        <span className="text-panel-muted">
          RCON {rconConnected ? 'connected' : 'disconnected'}
          {!connected && ' · reconnecting to panel...'}
        </span>
      </div>

      <div
        ref={logRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-panel-border bg-black/40 p-3 font-mono text-xs leading-relaxed"
      >
        {log.length === 0 && <div className="text-panel-muted">No commands sent yet. Try "list" or "help".</div>}
        {log.map((entry) => (
          <div key={entry.id} className="mb-2">
            <div className="text-panel-accent">
              <span className="text-panel-muted">[{formatTime(entry.timestamp)}]</span> &gt; {entry.command}
            </div>
            {entry.response !== undefined && (
              <div className="whitespace-pre-wrap pl-4 text-panel-text">{entry.response || '(empty response)'}</div>
            )}
            {entry.error && <div className="whitespace-pre-wrap pl-4 text-panel-danger">{entry.error}</div>}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!connected}
          placeholder={connected ? 'Enter RCON command...' : 'Reconnecting...'}
          className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 font-mono text-sm text-panel-text outline-none focus:border-panel-accent disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={!input.trim() || !connected}
          className="rounded-lg bg-panel-accent2 px-4 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
