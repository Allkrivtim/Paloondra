import { WebSocket } from 'ws';
import { Client, ClientChannel } from 'ssh2';
import { buildSshConnectConfig } from '../services/ssh.service';

type ClientMessage =
  | { type: 'data'; data: string }
  | { type: 'resize'; cols: number; rows: number };

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

/**
 * Each browser tab gets its own dedicated SSH connection + PTY, opened
 * fresh on WebSocket connect and torn down on close/error. This keeps the
 * interactive terminal isolated from the metrics/exec connection.
 */
export function handleSshConnection(ws: WebSocket): void {
  const conn = new Client();
  let stream: ClientChannel | null = null;

  send(ws, { type: 'status', connected: false, message: 'Connecting...' });

  conn.on('ready', () => {
    send(ws, { type: 'status', connected: true });
    conn.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, ch) => {
      if (err) {
        send(ws, { type: 'error', message: err.message });
        ws.close();
        return;
      }
      stream = ch;

      ch.on('data', (data: Buffer) => send(ws, { type: 'data', data: data.toString('utf8') }));
      ch.stderr.on('data', (data: Buffer) => send(ws, { type: 'data', data: data.toString('utf8') }));
      ch.on('close', () => {
        send(ws, { type: 'status', connected: false, message: 'Session ended' });
        conn.end();
        ws.close();
      });
    });
  });

  conn.on('error', (err) => {
    send(ws, { type: 'error', message: err.message });
    send(ws, { type: 'status', connected: false });
    ws.close();
  });

  try {
    conn.connect(buildSshConnectConfig());
  } catch (err) {
    send(ws, { type: 'error', message: err instanceof Error ? err.message : 'SSH connect failed' });
    ws.close();
  }

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!stream) return;
    if (msg.type === 'data' && typeof msg.data === 'string') {
      stream.write(msg.data);
    } else if (msg.type === 'resize') {
      stream.setWindow(msg.rows, msg.cols, 0, 0);
    }
  });

  ws.on('close', () => {
    if (stream) stream.close();
    conn.end();
  });
}
