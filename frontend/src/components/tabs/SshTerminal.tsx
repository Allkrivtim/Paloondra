import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useSocket } from '../../hooks/useSocket';

export default function SshTerminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sendRef = useRef<((data: object) => boolean) | null>(null);
  const [status, setStatus] = useState('Connecting...');

  const onMessage = useCallback((msg: any) => {
    if (msg.type === 'data') {
      termRef.current?.write(msg.data);
    } else if (msg.type === 'status') {
      setStatus(msg.connected ? 'Connected' : msg.message ?? 'Disconnected');
    } else if (msg.type === 'error') {
      termRef.current?.write(`\r\n\x1b[31m${msg.message}\x1b[0m\r\n`);
    }
  }, []);

  const { connected, send } = useSocket('/ws/ssh', onMessage);
  sendRef.current = send;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Consolas, monospace',
      theme: {
        background: '#0b0d12',
        foreground: '#e5e7eb',
        cursor: '#4ade80',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fit;

    term.onData((data) => {
      sendRef.current?.({ type: 'data', data });
    });

    // xterm's internal render service isn't ready to handle a resize the
    // instant open() returns - fitting/observing one frame later avoids a
    // "dimensions" TypeError from its Viewport during the very first layout.
    let resizeObserver: ResizeObserver | null = null;
    const raf = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      try {
        fit.fit();
      } catch {
        // ignore - the observer below will retry once the container settles
      }
      resizeObserver = new ResizeObserver(() => {
        try {
          fit.fit();
          sendRef.current?.({ type: 'resize', cols: term.cols, rows: term.rows });
        } catch {
          // ignore fit errors during teardown
        }
      });
      resizeObserver.observe(containerRef.current);
    });

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (connected && termRef.current) {
      send({ type: 'resize', cols: termRef.current.cols, rows: termRef.current.rows });
    }
  }, [connected, send]);

  return (
    <div className="flex h-full flex-col gap-3 p-4 sm:p-6">
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-panel-accent' : 'bg-panel-danger'}`} />
        <span className="text-panel-muted">{status}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-panel-border bg-[#0b0d12] p-2">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
