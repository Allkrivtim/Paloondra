# Paloondra

A web-based admin panel for a Minecraft server. Paloondra **never touches the
server process or its files directly** — every action goes through one of
four external channels:

- **Shell scripts** (`START_SCRIPT` / `STOP_SCRIPT` / `RESTART_SCRIPT`), run via `child_process`
- **RCON** (`rcon-client`) for in-game commands and the player list
- **SSH** (`ssh2`) for the interactive terminal and host metrics (`top`/`free`/`df`)
- **SFTP** (`ssh2`'s SFTP subsystem, or `sudo` over SSH exec) for the file manager

All connection details (script paths, RCON, SSH/SFTP credentials) live
**only** in the backend's `.env` file. There is no "add a server" UI — on
startup the backend reads `.env` once, and every tab is already wired to
that single target server.

This guide assumes no prior familiarity with the project. If you just want
the short version, skip to [Quick start](#quick-start).

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Quick start](#quick-start)
3. [Every `.env` variable, explained](#every-env-variable-explained)
4. [Creating users](#creating-users)
5. [Enabling sudo mode for the file manager](#enabling-sudo-mode-for-the-file-manager)
6. [Running in production](#running-in-production)
7. [Running with systemd](#running-with-systemd)
8. [Development mode](#development-mode)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Node.js 18 or newer** (20 LTS recommended) and npm, on the machine that
  will run the Paloondra backend. This does **not** need to be the same
  machine as the Minecraft server — the backend reaches it over SSH/RCON.
- **A Minecraft server** that you can already start/stop/restart by hand,
  reachable over the network from wherever Paloondra's backend runs.
- **RCON enabled** on that server. In `server.properties`:
  ```properties
  enable-rcon=true
  rcon.port=25575
  rcon.password=some-strong-password
  broadcast-rcon-to-ops=true
  ```
  Restart the Minecraft server after changing these.
- **SSH access** to the host running the Minecraft server, either a
  password or a private key, for a user that can read (and ideally write)
  the server's files.
- Three shell scripts on the machine running the Paloondra **backend**
  (typically the same host as the Minecraft server) that start, stop, and
  restart your server however you normally do it — `screen`, `tmux`,
  `systemctl`, a Docker command, whatever you already use. Paloondra just
  runs `sh <path-to-script>` and streams stdout/stderr; it has no opinion
  on what's inside.

## Quick start

```bash
git clone <this-repo-url> paloondra
cd paloondra

# Backend
cd backend
npm install
cp .env.example .env
# edit .env - see the variable reference below
npm run hash -- "a-strong-password-for-your-first-user"
# paste the printed hash into USERS in .env as admin:<hash>
npm run dev

# Frontend (in a second terminal)
cd ../frontend
npm install
cp .env.example .env
# edit VITE_API_BASE_URL if the backend isn't on localhost:4000
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`) and log in with
the username/password you just hashed.

---

## Every `.env` variable, explained

All of these live in `backend/.env` (copy from `backend/.env.example`).
There is no separate config for the frontend beyond the API URL (see
[Development mode](#development-mode)).

### Server

| Variable | Example | Meaning |
|---|---|---|
| `PORT` | `4000` | Port the backend HTTP/WebSocket server listens on. |
| `CORS_ORIGIN` | `http://localhost:5173` | The origin your frontend is served from. Must match exactly (scheme + host + port) or the browser will block API calls. |

### Auth

| Variable | Example | Meaning |
|---|---|---|
| `JWT_SECRET` | `f3a1...` (48+ random bytes) | Signs login tokens. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Changing it invalidates all existing sessions. |
| `JWT_EXPIRES_IN` | `12h` | How long a login stays valid. Any [`ms`](https://github.com/vercel/ms) string (`30m`, `7d`, ...) or a number of seconds. |
| `USERS` | `admin:$2b$10$...,mod:$2b$10$...` | Comma separated `username:bcrypt_hash` pairs. See [Creating users](#creating-users) below — there is no signup UI. |

### Shell scripts

| Variable | Example | Meaning |
|---|---|---|
| `START_SCRIPT` | `/opt/minecraft/start.sh` | Absolute path. Run via `sh <path>` when you click Start. |
| `STOP_SCRIPT` | `/opt/minecraft/stop.sh` | Same, for Stop. |
| `RESTART_SCRIPT` | `/opt/minecraft/restart.sh` | Same, for Restart. |

These must be readable and executable by the OS user running the Paloondra
backend process (`chmod +x` them). Output (stdout/stderr) streams live to
the Dashboard tab.

### RCON

| Variable | Example | Meaning |
|---|---|---|
| `RCON_HOST` | `127.0.0.1` | Same host as the Minecraft server, unless RCON is exposed elsewhere. |
| `RCON_PORT` | `25575` | Must match `rcon.port` in `server.properties`. |
| `RCON_PASSWORD` | `some-strong-password` | Must match `rcon.password` in `server.properties`. |

### SSH / SFTP

| Variable | Example | Meaning |
|---|---|---|
| `SSH_HOST` | `127.0.0.1` | Host running the Minecraft server. |
| `SSH_PORT` | `22` | SSH port. |
| `SSH_USER` | `mcadmin` | SSH login user. Used for the terminal tab, host metrics, and the file manager. |
| `SSH_PASSWORD` | `hunter2` | Password auth. Leave blank if using a key. |
| `SSH_KEY_PATH` | `/home/mcadmin/.ssh/id_ed25519` | Private key auth. Takes priority over `SSH_PASSWORD` if both are set. |
| `SSH_KEY_PASSPHRASE` | (blank if none) | Passphrase for the key above, if it's encrypted. |

You need **either** `SSH_PASSWORD` or `SSH_KEY_PATH` — the backend refuses
to start with neither set.

### File manager (SFTP)

| Variable | Example | Meaning |
|---|---|---|
| `SFTP_DEFAULT_PATH` | `/home/mcadmin/server` | Absolute path the File Manager tab opens by default. If unset, or if the path doesn't exist / isn't a directory, Paloondra falls back to `SSH_USER`'s home directory. |
| `SFTP_USE_SUDO` | `false` | Set to `true` if `SSH_USER` doesn't own the Minecraft server's files (e.g. they belong to a dedicated `minecraft` service account). See [Enabling sudo mode](#enabling-sudo-mode-for-the-file-manager) — requires a sudoers entry before you flip this on. |
| `SUDO_PATH` | `/usr/bin/sudo` | Path to the `sudo` binary on the target host. Only used when `SFTP_USE_SUDO=true`. Must match your sudoers entry. |

### Metrics

| Variable | Example | Meaning |
|---|---|---|
| `METRICS_INTERVAL_MS` | `5000` | How often (ms) to poll RCON's player list and the host's CPU/RAM/disk. |
| `METRICS_HISTORY_SIZE` | `120` | How many samples the in-memory ring buffer keeps for the Dashboard charts (at the default interval, 120 samples ≈ 10 minutes). Resets on backend restart — there's no database. |

### Editor

| Variable | Example | Meaning |
|---|---|---|
| `EDITOR_MAX_FILE_SIZE` | `2097152` (2 MiB) | The built-in file editor refuses to open anything larger than this, and refuses anything that looks binary regardless of size. |

If anything required is missing or malformed, the backend prints every
problem it found and exits immediately — it will not start half-configured.

---

## Creating users

There is no registration page or user-management UI by design — you edit
`USERS` in `.env` by hand.

1. Pick a username and a strong password.
2. From `backend/`, run:
   ```bash
   npm run hash -- "the-password"
   ```
3. Copy the printed bcrypt hash and add `username:hash` to `USERS` in
   `.env`, comma separated if there's more than one:
   ```
   USERS=admin:$2b$10$abc...,mod:$2b$10$xyz...
   ```
4. Restart the backend. To remove a user, delete their entry and restart.

There's no "forgot password" flow either — to reset one, generate a new
hash and replace their entry.

---

## Enabling sudo mode for the file manager

By default the File Manager talks to the target host over the raw SFTP
protocol, which is always bound to `SSH_USER`'s own filesystem permissions.
That's fine if `SSH_USER` owns the Minecraft server's files. If the server
runs as a separate service account (say, `minecraft`) and your SSH user is
a personal admin account, plain SFTP will hit "permission denied" on
everything.

`SFTP_USE_SUDO=true` works around this: instead of the SFTP subsystem,
every file manager operation (list, read, write, upload, download, rename,
delete, mkdir) runs as a `sudo`-prefixed shell command over the same SSH
connection. This requires `SSH_USER` to have **passwordless sudo** for a
specific set of commands.

### 1. Confirm where the binaries live

Paloondra invokes these exact absolute paths:

```
/usr/bin/find
/usr/bin/cat
/usr/bin/tee
/usr/bin/mkdir
/usr/bin/mv
/usr/bin/rm
/usr/bin/sudo   (or whatever you set SUDO_PATH to)
```

On the **target host**, check they match:

```bash
which find cat tee mkdir mv rm sudo
```

If your distro keeps any of them somewhere else (some put `cat`/`mkdir`/`mv`/`rm`
in `/bin`, which is often just a symlink to `/usr/bin` anyway, but check),
adjust both the sudoers file below and `SUDO_PATH` accordingly, and open an
issue/PR if you need the `TOOLS` paths in
`backend/src/services/sudoFs.service.ts` made configurable for your setup.

### 2. Create the sudoers entry

On the target host, as root:

```bash
visudo -f /etc/sudoers.d/paloondra
```

Paste (replacing `mcadmin` with your actual `SSH_USER`):

```
# Paloondra file manager - passwordless, limited to the binaries the
# backend actually shells out to. Nothing else.
mcadmin ALL=(root) NOPASSWD: /usr/bin/find, /usr/bin/cat, /usr/bin/tee, /usr/bin/mkdir, /usr/bin/mv, /usr/bin/rm
```

Save and exit (`visudo` validates the syntax for you before writing).

### 3. Understand what you just granted

`sudo`'s command matching is by binary path, not by arguments — this entry
lets `mcadmin` run `find`, `cat`, `tee`, `mkdir`, `mv`, and `rm` as root
**anywhere on the filesystem**, not just inside the Minecraft server
directory. That's effectively root-equivalent for file operations. Only
enable this if:

- `SSH_USER` is a dedicated account used only by Paloondra (recommended), and
- you trust everyone with a Paloondra login the same way you'd trust
  someone with root on that box, since the File Manager tab will let them
  read/write/delete anything.

If you want tighter scoping, sudoers supports wildcards in the command
argument position (e.g. restricting `rm` to a specific directory prefix),
but GNU `find`/`tee`'s flexible argument handling makes that easy to defeat
in practice — treat the account-level trust boundary above as the real
control, not the sudoers wildcard.

### 4. Turn it on

```
SFTP_USE_SUDO=true
SUDO_PATH=/usr/bin/sudo
```

Restart the backend. Test it by opening the File Manager tab and browsing
to a directory `SSH_USER` doesn't directly own.

---

## Running in production

### Build the frontend

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL to your real backend URL
npm run build
```

This produces static files in `frontend/dist/`. Serve them with any static
file server. Two easy options:

**Quick option** (fine for a small deployment):
```bash
npx serve -s dist -l 5173
```

**Nginx** (recommended if you're already terminating TLS with nginx):
```nginx
server {
    listen 443 ssl;
    server_name paloondra.example.com;

    ssl_certificate     /etc/letsencrypt/live/paloondra.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/paloondra.example.com/privkey.pem;

    root /var/www/paloondra/dist;
    index index.html;
    location / {
        try_files $uri /index.html;
    }
}
```
Point `VITE_API_BASE_URL` (baked in at build time) at wherever you expose
the backend, and set the backend's `CORS_ORIGIN` to `https://paloondra.example.com`.

### Build and run the backend

```bash
cd backend
npm install
cp .env.example .env   # fill in real values
npm run build
npm start
```

`npm start` runs the compiled output in `dist/`; use a process manager (see
[systemd](#running-with-systemd) below) so it restarts on crash/reboot.

### Put it behind HTTPS

The backend serves plain HTTP/WS. In production, put a reverse proxy (nginx,
Caddy, Traefik) in front of it that terminates TLS and forwards to
`http://127.0.0.1:4000`, upgrading WebSocket connections
(`Connection: upgrade`) for the `/ws/*` paths. JWTs and SSH/RCON traffic
between the browser and the backend should never travel in plaintext over
a public network.

---

## Running with systemd

Example unit for the backend (`/etc/systemd/system/paloondra.service`):

```ini
[Unit]
Description=Paloondra backend
After=network.target

[Service]
Type=simple
User=paloondra
WorkingDirectory=/opt/paloondra/backend
EnvironmentFile=/opt/paloondra/backend/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

Notes:
- `EnvironmentFile` reads `.env` directly — no need to duplicate the values
  in the unit file. Keep `.env` readable only by the `paloondra` user
  (`chmod 600 backend/.env`).
- Create the `paloondra` user first (`useradd --system --home /opt/paloondra paloondra`),
  make sure it owns `/opt/paloondra`, and that it can execute your
  `START_SCRIPT`/`STOP_SCRIPT`/`RESTART_SCRIPT`.
- `npm run build` first so `dist/index.js` exists.

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now paloondra
sudo systemctl status paloondra
journalctl -u paloondra -f   # live logs
```

If you're serving the frontend with nginx (as shown above), nginx already
runs as its own service — no extra unit needed there.

---

## Development mode

```bash
# backend - auto-reloads on file changes
cd backend && npm run dev

# frontend - Vite dev server with hot reload
cd frontend && npm run dev
```

The frontend dev server proxies nothing by itself — it talks to the
backend URL in `frontend/.env` (`VITE_API_BASE_URL`) directly, so the
backend's `CORS_ORIGIN` must match the Vite dev server's origin
(`http://localhost:5173` by default).

`npm run dev` in the frontend runs `vite`'s own dev server, which is not
hardened for exposure beyond localhost — don't point it at a public
network interface.

---

## Troubleshooting

**"Invalid configuration" and the backend refuses to start**
The error list printed on startup is the full set of problems — fix each
line it names. This is deliberate: Paloondra won't run half-configured.

**Dashboard shows "Offline" / RCON console shows "disconnected"**
- Check `RCON_HOST`/`RCON_PORT`/`RCON_PASSWORD` match `server.properties`
  exactly (`rcon.port`, `rcon.password`) and `enable-rcon=true` is set.
- Confirm the Minecraft server was restarted after changing
  `server.properties` — RCON config isn't hot-reloaded.
- From the backend host, test connectivity directly:
  `nc -zv <RCON_HOST> <RCON_PORT>`. If that fails, it's a network/firewall
  issue, not a Paloondra issue — check the Minecraft host's firewall allows
  the RCON port from wherever the backend runs.

**RCON commands fail with an auth-looking error**
`RCON_PASSWORD` doesn't match `rcon.password` in `server.properties`, or
the server hasn't picked up a changed password yet (restart it).

**SSH terminal / File Manager show "connect ECONNREFUSED" or "connect ETIMEDOUT"**
- `SSH_HOST`/`SSH_PORT` is wrong, or something (firewall, security group)
  is blocking the connection from the backend host.
- Test manually from the backend host: `ssh -p <SSH_PORT> <SSH_USER>@<SSH_HOST>`
  with the same credentials/key configured in `.env`. If that doesn't work
  in a plain terminal, it won't work in Paloondra either.

**SSH terminal / File Manager show "All configured authentication methods failed"**
Wrong password, or wrong/missing private key. If using `SSH_KEY_PATH`,
double check file permissions (`chmod 600`) and that the key isn't
encrypted with a passphrase you haven't set in `SSH_KEY_PASSPHRASE`.

**File Manager shows "Permission denied" on files that clearly exist**
`SSH_USER` doesn't own those files over plain SFTP. Either change
`SSH_USER` to one that does, or enable
[sudo mode](#enabling-sudo-mode-for-the-file-manager).

**Sudo mode enabled but still getting permission errors**
- Confirm the sudoers entry is in place and matches `SSH_USER` exactly:
  `sudo -n -l -U <SSH_USER>` (run as root on the target host) should list
  the six commands with `NOPASSWD`.
- Confirm the binary paths in the sudoers file match reality
  (`which find cat tee mkdir mv rm`) and match `sudoFs.service.ts`'s
  `TOOLS` map.
- If `sudo` itself prompts for a password when Paloondra runs a command,
  the `-n` (non-interactive) flag Paloondra passes will make that command
  fail fast with a clear "sudo: a password is required" error rather than
  hanging — that means the `NOPASSWD` entry isn't matching. Re-check the
  username and paths.

**Start/Stop/Restart buttons do nothing, or the Dashboard log stays empty**
- Confirm the script paths in `.env` are correct and the files are
  executable (`chmod +x`) by the OS user running the backend process.
- Check the backend's own logs (`journalctl -u paloondra -f` if using
  systemd, or the terminal running `npm run dev`) for a "Failed to launch
  script" line.

**Login fails with "Invalid username or password" even though you're sure it's right**
- Make sure you copied the *entire* bcrypt hash from `npm run hash` into
  `USERS`, with no line breaks and no surrounding quotes.
- Bcrypt hashes start with `$2a$`, `$2b$`, or `$2y$` — anything else means
  the value in `USERS` isn't a real bcrypt hash, and the backend will have
  already refused to start and told you so.

**Browser console shows CORS errors**
`CORS_ORIGIN` in the backend's `.env` must exactly match the origin the
frontend is served from (scheme, host, and port). `http://localhost:5173`
and `http://127.0.0.1:5173` are different origins as far as CORS is
concerned.

---

## Project structure

```
backend/    Express + TypeScript API and WebSocket server
frontend/   React + Vite + TypeScript + Tailwind UI
```

## Tabs

| Tab | What it does |
|---|---|
| **Dashboard** | Online/offline status, Start/Stop/Restart buttons (run the configured scripts, output streams live), player count/TPS/host CPU/RAM/disk charts |
| **RCON Console** | Command input with history (↑/↓), live output log, auto-reconnect |
| **SSH Terminal** | Full interactive shell (xterm.js + ssh2 PTY), resizable, auto-reconnects a fresh session if the connection drops |
| **File Manager** | SFTP (or sudo-mode) browser: navigate, upload/download, rename, delete, mkdir, drag & drop (upload from OS, move between folders), built-in Monaco editor for text files |
| **Plugins & Mods** | Placeholder ("На доработке") |

## Notes on the implementation

- **Metrics history** is kept in an in-memory ring buffer
  (`backend/src/services/metrics.service.ts`) sized by
  `METRICS_HISTORY_SIZE` — it resets on backend restart. A comment in that
  file marks where a time-series table (Postgres/TimescaleDB, SQLite, etc.)
  could be plugged in if you want persistence across restarts.
- **Auth** is stateless JWT (`Authorization: Bearer <token>` for REST,
  `?token=<jwt>` query param for WebSocket upgrades, since browsers can't
  set custom headers on a WS handshake). A 401 from any API call clears the
  stored token and bounces to the login screen, which also tears down any
  open WebSockets so they don't retry forever with a token that will never
  become valid again.
- **Reconnection**: RCON, the shared SSH connection (metrics + sudo-mode
  file ops), and the plain-SFTP connection each retry with exponential
  backoff (2s → 30s) if dropped, and immediately attempt a fresh connection
  on demand (e.g. the moment you send an RCON command or hit the file
  manager) rather than waiting out a pending backoff timer. The SSH
  terminal tab opens a dedicated connection per browser session and
  reconnects automatically if it drops.
- The `dev` known-vulnerability scan (`npm audit`) flags esbuild/vite's
  **dev server** (not the production build) for a request-forwarding issue
  fixed only in vite 8 — a breaking upgrade out of scope here. Don't expose
  `vite dev` to an untrusted network; use `npm run build` + a real static
  server for anything other than local development.

## Security

- Change `JWT_SECRET` and every user's password before exposing this
  anywhere beyond localhost.
- Put the backend behind HTTPS/WSS (reverse proxy) in production.
- Only enable `SFTP_USE_SUDO` if you understand and accept what it grants —
  see [Enabling sudo mode](#enabling-sudo-mode-for-the-file-manager).
- The SFTP file editor refuses to open files over `EDITOR_MAX_FILE_SIZE`
  bytes (default 2 MiB) or files that look binary.
