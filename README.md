# Minecraft Server Admin Panel

A web-based admin panel for a Minecraft server. The panel **never touches the
server process or its files directly** — every action goes through one of
four external channels:

- **Shell scripts** (`START_SCRIPT` / `STOP_SCRIPT` / `RESTART_SCRIPT`), run via `child_process`
- **RCON** (`rcon-client`) for in-game commands and the player list
- **SSH** (`ssh2`) for the interactive terminal and host metrics (`top`/`free`/`df`)
- **SFTP** (`ssh2`'s SFTP subsystem) for the file manager

All connection details (script paths, RCON, SSH/SFTP credentials) live
**only** in the backend's `.env` file. There is no "add a server" UI — on
startup the backend reads `.env` once and every tab is already wired to that
single target server.

## Project structure

```
backend/    Express + TypeScript API and WebSocket server
frontend/   React + Vite + TypeScript + Tailwind UI
```

## Prerequisites

- Node.js 18+
- A Minecraft server reachable via RCON
- SSH access (password or key) to the host running that server
- Three shell scripts on that host (or anywhere the backend process can
  execute) that start/stop/restart the server your way

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `backend/.env`:

- `START_SCRIPT` / `STOP_SCRIPT` / `RESTART_SCRIPT` — absolute paths to your
  own scripts, e.g. scripts that `screen -S mc -X stuff`, use `systemctl`,
  or a `tmux` session. The panel just runs `sh <path>` and streams
  stdout/stderr — write these scripts to do whatever start/stop/restart
  means for your setup.
- `RCON_HOST` / `RCON_PORT` / `RCON_PASSWORD` — match `server.properties`
  (`enable-rcon=true`, `rcon.port`, `rcon.password`).
- `SSH_HOST` / `SSH_PORT` / `SSH_USER` and either `SSH_PASSWORD` or
  `SSH_KEY_PATH` (+ `SSH_KEY_PASSPHRASE` if the key is encrypted).
- `JWT_SECRET` — generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `USERS` — comma separated `username:bcrypt_hash` pairs. There is no
  registration UI; add users by hand. Generate a hash for each user:
  ```bash
  npm run hash -- "the-password"
  ```
  then paste `username:<hash>` into `USERS` (comma separated for more than
  one user).

Run it:

```bash
npm run dev      # ts-node-dev, auto-reload
# or
npm run build && npm start
```

The server listens on `PORT` (default `4000`) and exposes:

- REST: `http://localhost:4000/api/...`
- WebSockets: `ws://localhost:4000/ws/console|rcon|ssh|metrics?token=<jwt>`

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
```

Set `VITE_API_BASE_URL` in `frontend/.env` to wherever the backend is
running (e.g. `http://localhost:4000`).

```bash
npm run dev
```

Open the printed URL (default `http://localhost:5173`) and log in with a
username/password from `USERS`.

For production, `npm run build` emits static files in `frontend/dist/` —
serve them with any static file server/CDN, with `CORS_ORIGIN` on the
backend set to that origin.

## Tabs

| Tab | What it does |
|---|---|
| **Dashboard** | Online/offline status, Start/Stop/Restart buttons (run the configured scripts, output streams live), player count/TPS/host CPU/RAM/disk charts |
| **RCON Console** | Command input with history (↑/↓), live output log, auto-reconnect |
| **SSH Terminal** | Full interactive shell (xterm.js + ssh2 PTY), resizable |
| **File Manager** | SFTP browser: navigate, upload/download, rename, delete, mkdir, drag & drop (upload from OS, move between folders), built-in Monaco editor for text files |
| **Plugins & Mods** | Placeholder ("На доработке") |

## Notes on the implementation

- **Metrics history** is kept in an in-memory ring buffer
  (`backend/src/services/metrics.service.ts`) sized by
  `METRICS_HISTORY_SIZE` — it resets on backend restart. A comment in that
  file marks where a time-series table (Postgres/TimescaleDB, SQLite, etc.)
  could be plugged in if you want persistence across restarts.
- **Auth** is stateless JWT (`Authorization: Bearer <token>` for REST,
  `?token=<jwt>` query param for WebSocket upgrades, since browsers can't
  set custom headers on a WS handshake). Logout just discards the token
  client-side.
- **Reconnection**: RCON, the metrics SSH connection, and the SFTP
  connection each retry with exponential backoff (2s → 30s) if the
  connection drops. The SSH terminal tab opens a fresh connection per
  browser session; reload the tab to reconnect.
- The `dev` known-vulnerability scan (`npm audit`) flags esbuild/vite's
  **dev server** (not the production build) for a request-forwarding issue
  fixed only in vite 8 — a breaking upgrade out of scope here. Don't expose
  `vite dev` to an untrusted network; use `npm run build` + a real static
  server for anything other than local development.

## Security

- Change `JWT_SECRET` and every user's password before exposing this
  anywhere beyond localhost.
- Put the backend behind HTTPS/WSS (e.g. a reverse proxy) in production —
  JWTs and RCON/SSH credentials should never travel in plaintext.
- The SFTP file editor refuses to open files over `EDITOR_MAX_FILE_SIZE`
  bytes (default 2 MB) or files that look binary.
