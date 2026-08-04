import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSocket } from '../../hooks/useSocket';
import { ConsoleLine, GameConsoleStatus } from '../../types';

interface DisplayLine extends ConsoleLine {
  id: number;
}

const DEFAULT_STATUS: GameConsoleStatus = { configured: true, following: false, lastError: null };

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Strips legacy Minecraft "§"-formatting codes that occasionally leak into console text - not a full ANSI/MiniMessage parser, just avoids literal garbage characters. */
function stripMinecraftFormatting(text: string): string {
  return text.replace(/§[0-9A-FK-ORa-fk-or]/g, '');
}

function lineClass(entry: ConsoleLine): string {
  if (entry.stream === 'system') return 'text-panel-accent';
  if (entry.stream === 'stderr' || /\b(ERROR|SEVERE)\b/.test(entry.line)) return 'text-panel-danger';
  if (/\bWARN\b/.test(entry.line)) return 'text-panel-warn';
  return 'text-panel-text';
}

export default function Console() {
  const { t } = useTranslation();
  const [lines, setLines] = useState<DisplayLine[]>([]);
  const [status, setStatus] = useState<GameConsoleStatus>(DEFAULT_STATUS);
  const [statusKnown, setStatusKnown] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const historyIndexRef = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextIdRef = useRef(0);
  const [autoScroll, setAutoScroll] = useState(true);

  const onMessage = useCallback((msg: any) => {
    if (msg.type === 'status') {
      setStatus({ configured: !!msg.configured, following: !!msg.following, lastError: msg.lastError ?? null });
      setStatusKnown(true);
    } else if (msg.type === 'history') {
      const initial: DisplayLine[] = (msg.lines ?? []).map((line: ConsoleLine) => ({ ...line, id: nextIdRef.current++ }));
      setLines(initial.slice(-999));
    } else if (msg.type === 'line') {
      const entry: DisplayLine = { stream: msg.stream, line: msg.line, timestamp: msg.timestamp, id: nextIdRef.current++ };
      setLines((prev) => [...prev.slice(-999), entry]);
    }
  }, []);

  const { connected, send } = useSocket('/ws/game-console', onMessage);

  useEffect(() => {
    if (autoScroll) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines, autoScroll]);

  function handleScroll() {
    const el = logRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  }

  function jumpToLatest() {
    setAutoScroll(true);
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }

  const canSend = connected && status.configured;

  function submit() {
    const command = input.trim();
    if (!command || !canSend) return;
    send({ type: 'send', command });
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

  if (statusKnown && !status.configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-panel-muted">
        <span className="text-3xl">🖥️</span>
        <p className="max-w-md text-sm">{t('console.notConfigured')}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${status.following ? 'bg-panel-accent' : 'bg-panel-danger'}`} />
          <span className="text-panel-muted">
            {status.following ? t('console.connected') : t('console.disconnected')}
            {!connected && t('console.reconnectingToPanel')}
          </span>
          {!status.following && status.lastError && (
            <span className="max-w-sm truncate text-xs text-panel-muted" title={status.lastError}>
              · {status.lastError}
            </span>
          )}
        </div>
        <span className="text-xs text-panel-muted" title={t('console.dockerNoteTooltip')}>
          {t('console.dockerNote')}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={logRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto rounded-xl border border-panel-border bg-black/40 p-3 font-mono text-xs leading-relaxed"
        >
          {lines.length === 0 && <div className="text-panel-muted">{t('console.noOutputYet')}</div>}
          {lines.map((entry) => (
            <div key={entry.id} className={`whitespace-pre-wrap ${lineClass(entry)}`}>
              <span className="text-panel-muted">[{formatTime(entry.timestamp)}]</span> {stripMinecraftFormatting(entry.line)}
            </div>
          ))}
        </div>
        {!autoScroll && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-3 right-3 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black shadow transition hover:bg-panel-accent"
          >
            {t('console.jumpToLatest')}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!canSend}
          placeholder={canSend ? t('console.placeholderConnected') : t('console.placeholderReconnecting')}
          className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 font-mono text-sm text-panel-text outline-none focus:border-panel-accent disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={!input.trim() || !canSend}
          className="rounded-lg bg-panel-accent2 px-4 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {t('console.send')}
        </button>
      </div>
    </div>
  );
}
