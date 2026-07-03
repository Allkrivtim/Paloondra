# Paloondra

A web-based admin panel for a Minecraft server. Paloondra **never touches the
server process or its files directly** — every action goes through one of
these external channels:

- **Shell scripts** (`START_SCRIPT` / `STOP_SCRIPT` / `RESTART_SCRIPT` / `BACKUP_SCRIPT`), run over the same SSH connection as the terminal, from inside `SCRIPTS_DIR` on the target server
- **RCON** (`rcon-client`) for in-game commands, the player list, quick moderation actions, broadcasts, and scheduled RCON tasks
- **SSH** (`ssh2`) for the interactive terminal and host metrics (`top`/`free`/`df`)
- **SFTP** (`ssh2`'s SFTP subsystem, or `sudo` over SSH exec) for the file manager, the plugins list, backups, and the server.properties editor
- **node-cron** (backend-local) for scheduled restarts/RCON commands - nothing external, just a timer that calls the same RCON/scripts channels above
- **The public Modrinth API** (`api.modrinth.com`) - the one exception to "only talks to your one configured server" - used only for the plugin store's search/browse/install, over plain HTTPS, no credentials involved

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
6. [Plugins & the plugin store](#plugins--the-plugin-store)
7. [Scheduled tasks](#scheduled-tasks)
8. [Backups](#backups)
9. [server.properties editor](#serverproperties-editor)
10. [Audit log](#audit-log)
11. [Localization](#localization)
12. [Running in production](#running-in-production)
13. [Running with systemd](#running-with-systemd)
14. [Docker](#docker)
15. [Development mode](#development-mode)
16. [Troubleshooting](#troubleshooting)

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
- Start/stop/restart (and optionally backup) shell scripts **on that same
  server**, in one directory, that do whatever you normally do to manage
  it — `screen`, `tmux`, `systemctl`, a Docker command, whatever you
  already use. Paloondra runs them over SSH as `cd <SCRIPTS_DIR> &&
  ./<script>` and streams stdout/stderr back to the Dashboard; it has no
  opinion on what's inside them. They need to be executable
  (`chmod +x *.sh` in that directory).

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

### Shell scripts

| Variable | Example | Meaning |
|---|---|---|
| `SCRIPTS_DIR` | `/home/minecraft/scripts` | Absolute path **on the target server** (the SSH host above) containing your scripts. |
| `START_SCRIPT` | `start.sh` | Filename inside `SCRIPTS_DIR`, run when you click Start. |
| `STOP_SCRIPT` | `stop.sh` | Same, for Stop. |
| `RESTART_SCRIPT` | `restart.sh` | Same, for Restart. |
| `BACKUP_SCRIPT` | `backup.sh` | Same - not wired to a Dashboard button, but runnable the same way (`POST /api/server/backup`) if you want to trigger it from your own tooling. |

These run over the **same SSH connection** as the terminal tab and file
manager - not locally on whatever machine runs the Paloondra backend. Each
one executes as:

```
cd <SCRIPTS_DIR> && ./<the filename>
```

so a script that assumes it's running from its own directory (relative
paths inside it) keeps working exactly as if you'd `cd`'d there and run it
by hand. They must be executable on the server: `chmod +x` everything in
`SCRIPTS_DIR`. Output (stdout/stderr) streams live to the Dashboard tab;
a non-zero exit code or an SSH-level failure (connection down, script
missing) shows up there too instead of hanging.

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

### Plugins

All optional, like `SFTP_DEFAULT_PATH` above: leave one unset and the
corresponding tab shows a clear "not configured" message instead of the
backend refusing to start.

| Variable | Example | Meaning |
|---|---|---|
| `PLUGINS_DIR` | `/home/minecraft/server/plugins` | Absolute path to the server's `plugins/` directory, on the target server. Required for the Plugins tab. |
| `PLUGIN_JAR_MAX_SIZE` | `104857600` (100 MiB) | Largest `.jar` the panel will upload, or read into memory to parse `plugin.yml` out of. |

### Backups

| Variable | Example | Meaning |
|---|---|---|
| `BACKUPS_DIR` | `/home/minecraft/backups` | Absolute path, on the target server, to wherever `BACKUP_SCRIPT` writes its archives. Only used for listing/downloading/deleting them — triggering a backup still just runs `BACKUP_SCRIPT`. |

### server.properties editor

| Variable | Example | Meaning |
|---|---|---|
| `SERVER_PROPERTIES_PATH` | `/home/minecraft/server/server.properties` | Absolute path to `server.properties`, on the target server. |

### Plugin store config

| Variable | Example | Meaning |
|---|---|---|
| `MODRINTH_API_URL` | `https://api.modrinth.com/v2` | Base URL of the Modrinth API. No reason to change this unless you're pointing at a mirror/proxy. See [Plugins & the plugin store](#plugins--the-plugin-store) for how it's used. |

### Local data storage

Unlike every other path in this file, this one is **not** on the target
server - it's local to whatever machine runs the Paloondra backend, with no
SSH involved.

| Variable | Example | Meaning |
|---|---|---|
| `DATA_DIR` | `./data` | Where the scheduler's tasks and the audit log are persisted as small JSON files. In Docker this needs its own volume so it survives container recreation - already wired up in `docker-compose.yml`. |

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

## Plugins & the plugin store

The Plugins tab has two sub-tabs: **Installed** (what's already in
`PLUGINS_DIR`) and **Store** (search/browse/install from Modrinth).

### Enable/disable convention

There's no database tracking plugin state - Paloondra uses the same
convention Bukkit/Spigot/Paper server owners already use by hand:
**disabling a plugin renames it from `Foo.jar` to `Foo.jar.disabled`**.
Re-enabling reverses the rename. This means:

- Toggling a plugin in the UI is just an SFTP rename - instant, no server
  interaction.
- Anything already named `*.jar.disabled` in `PLUGINS_DIR` before you ever
  open the panel shows up as disabled, correctly, with no extra setup.
- The change only takes effect once the server actually restarts and
  re-scans the plugins folder - which is why installing, deleting, or
  toggling a plugin shows a "restart required" banner with a one-click
  Restart button (runs `RESTART_SCRIPT`, same as the Dashboard's button).

### Reading real plugin names

For each `.jar`, Paloondra looks inside it (jars are zip files) for
`plugin.yml` or `paper-plugin.yml`, parses the YAML, and shows the real
`name`/`version`/`author`/`description` instead of just the filename. If
neither file is present or parses cleanly (some jars are obfuscated or use
non-standard build layouts), the panel falls back to showing the filename -
this never blocks listing, installing, or managing the plugin, it's display
only. Parsed metadata is cached per file (keyed by size + modified time) so
re-opening the tab doesn't re-parse every jar.

### Installing

- **By URL**: paste a direct link to a `.jar`; the backend downloads it
  (validating it's actually a zip by its magic bytes, not just trusting the
  `.jar` extension) and uploads it to `PLUGINS_DIR` over SFTP. This accepts
  *any* http(s) URL you give it - it's a deliberately open "fetch this file
  for me" feature, so only use links you trust.
- **By file**: drag a `.jar` onto the upload zone, or click to browse.
  Streamed to the backend and then to `PLUGINS_DIR`, with a progress
  indicator.
- **From the Store**: see below.

Both paths reject anything over `PLUGIN_JAR_MAX_SIZE` and anything that
doesn't look like a real zip archive.

### Plugin store (Modrinth)

Search hits Modrinth's public API, filtered to `project_type:plugin`, with
optional game version / loader / category filters. Clicking a result shows
its full description, links, and every published version; picking a
version's Install button downloads that version's primary file straight
from Modrinth's CDN and installs it the same way "install by URL" does.
If the version you pick doesn't list the game version or loader you
filtered by, you'll get a confirmation prompt warning about the possible
mismatch before it installs anyway - Paloondra doesn't know what version
your server is actually running, so this is a best-effort check based on
what you told the search filters, not a guarantee.

Rate limits and network errors from Modrinth surface as a normal error
toast/banner rather than crashing the tab - if you hit a rate limit, wait a
moment and search again.

**Mods are out of scope** for this tab - it only searches
`project_type:plugin`. The `frontend/src/components/plugins/PluginStore.tsx`
and `backend/src/services/modrinth.service.ts`/`pluginStore.routes.ts`
files are where mod support (a separate Modrinth `project_type`, and likely
its own tab given mods usually need a client-side counterpart) would slot
in later - deliberately not implemented here.

---

## Scheduled tasks

Cron-scheduled restarts or RCON commands (nightly restarts, timed
announcements, periodic saves, whatever), editable in the Scheduled Tasks
tab. Each task is:

- A **name** (just for display).
- A standard 5-field **cron expression** (`minute hour day month weekday`,
  optionally 6 fields with a leading seconds field - see the presets
  dropdown in the "New Task" form for common examples), evaluated in the
  **backend's local timezone**.
- An **action**: either "Restart server" (runs `RESTART_SCRIPT`, same as
  the Dashboard button) or "RCON command" (any command, e.g. `say Server
  restarting in 5 minutes`).
- **Enabled** or not - disabled tasks are kept but not scheduled.

Tasks persist to `DATA_DIR/scheduled-tasks.json` and are re-armed on
backend startup. "Run now" triggers a task immediately without waiting for
its schedule (handy for testing a new task actually does what you expect).
Every run - scheduled or manual - records its result (RCON response, or
confirmation the restart script was triggered) and shows up in both the
task's "Last run" column and the [audit log](#audit-log).

---

## Backups

Backups aren't a separate mechanism - "running a backup" is just
`BACKUP_SCRIPT` (see [Shell scripts](#every-env-variable-explained)),
triggered from the Backups tab's "Run Backup Now" button exactly like the
Dashboard's Start/Stop/Restart buttons. What the Backups tab adds is a view
into `BACKUPS_DIR`: list what's there, download an archive, or delete one,
all over the same SFTP/sudo transport as the File Manager. Whatever backup
strategy `BACKUP_SCRIPT` implements (a `tar` of the world folder, a
plugin-based backup command, a call to an external tool) is entirely up to
you - Paloondra just runs the script and shows you what it produced.

---

## server.properties editor

Two modes, both writing to `SERVER_PROPERTIES_PATH` over SFTP:

- **Form** - the ~20 most commonly changed keys (difficulty, gamemode, PvP,
  whitelist, view/simulation distance, MOTD, level seed/name/type, and
  more) get proper inputs (dropdowns for enums, checkboxes for booleans),
  plus an "Other properties" section listing every other key already in
  your file as a plain key/value row, with an "Add property" button for
  anything not present yet. Saving only rewrites the specific lines that
  changed - comments and ordering in the rest of the file are preserved.
- **Raw** - the file as plain text, for anything the form doesn't cover or
  if you just prefer editing it directly. Saving in this mode overwrites
  the whole file with exactly what's in the textarea.

`rcon.port` / `rcon.password` / `enable-rcon` are intentionally **not**
given special form treatment - editing them here changes the actual file
on the server but has no effect on Paloondra's own `RCON_HOST`/`RCON_PORT`/
`RCON_PASSWORD` in `.env` (those are separate config, used to *connect*).
If you change the RCON port/password in `server.properties`, update
`backend/.env` to match and restart the backend, or RCON-dependent tabs
will start failing to connect after the Minecraft server restarts.

---

## Audit log

A small, append-only history of mutating admin actions - script runs
(start/stop/restart/backup), plugin installs/deletes/toggles, backup
deletes, scheduled task changes and runs, server.properties saves, and
"quick action" RCON commands (the Dashboard's kick/ban/op/whitelist buttons
and broadcast box). It's shown as a compact panel on the Dashboard (last
15 entries, refreshing every 15s) and available in full via
`GET /api/audit-log`.

This is deliberately **not** a log of every command typed into the RCON
Console tab - that tab already shows its own live command/response history
in place; the audit log is for "what changed", not a general-purpose
terminal transcript. It's stored as JSON in
`DATA_DIR/audit-log.json` (capped at the most recent 1000 entries), the
same local-to-the-backend storage the scheduler uses - see
[Local data storage](#every-env-variable-explained).

---

## Localization

The UI ships in **English and Russian**, via
[react-i18next](https://react.i18next.com/). Every tab, toast, confirmation
dialog, banner, and empty/loading state is translated - there's no
hardcoded UI text left in either language. Technical terms (RCON, SSH,
SFTP, plugin/mod names, cron, MOTD, TPS, CPU, RAM) are kept as-is in both
languages, matching how they're normally used even in Russian-language
admin tooling.

A language switcher sits in the header, next to the username/logout button.
Switching is instant (no page reload) and the choice is remembered in the
browser's `localStorage` (`paloondra.language`) - this is purely a
client-side display preference, unrelated to and stored separately from
the backend's `.env` connection config. On first visit (nothing in
`localStorage` yet), the language is detected from the browser and falls
back to English if it isn't Russian.

Translation strings live in `frontend/src/i18n/locales/en.json` and
`ru.json` (mirrored key structure - `frontend/src/i18n/index.ts` sets up
the `i18next-browser-languagedetector` for the localStorage/browser
detection above). Error messages returned by the backend (e.g. an SSH or
RCON exception's raw text) are shown as-is in English regardless of the
selected UI language - only the panel's own fallback messages, labels, and
copy are translated. This is a deliberate choice: backend errors are
often literal exception text (`ECONNREFUSED`, stack-trace fragments) that
isn't meaningful to translate, so the two are kept clearly distinct rather
than half-translating error strings inconsistently.

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
- Create the `paloondra` user first (`useradd --system --home /opt/paloondra paloondra`)
  and make sure it owns `/opt/paloondra`. It doesn't need local execute
  permissions on your start/stop/restart/backup scripts - those run over
  SSH on the target server, not on this machine (see
  [Shell scripts](#every-env-variable-explained)).
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

## Docker

An alternative to the manual build/systemd setup above: two containers
(backend + an nginx that serves the built frontend and reverse-proxies the
API/WebSockets), started with `docker compose up`.

### Prerequisites

- Docker Engine with the `docker compose` plugin (Docker Desktop includes
  it; on Linux, `docker compose version` should print something without
  needing a separate `docker-compose` binary).

### 1. Fill in the two `.env` files

There are two, for two different things:

- **`backend/.env`** — the app's own runtime config, exactly as described
  in [Every `.env` variable, explained](#every-env-variable-explained)
  above. Copy it and fill it in the same way you would for a non-Docker
  install:
  ```bash
  cp backend/.env.example backend/.env
  ```
  One value needs Docker-specific attention — see step 2 below before you
  consider this file done. Your start/stop/restart/backup scripts (`SCRIPTS_DIR`
  and friends) need **no Docker-specific changes at all**: they run over
  SSH on the target server exactly as described in
  [Shell scripts](#every-env-variable-explained), regardless of whether the
  backend itself is containerized.

- **`.env`** (repo root) — the one setting `docker-compose.yml` itself
  needs (what URL the panel will be reached at):
  ```bash
  cp .env.example .env
  ```

### 2. Point RCON/SSH at a reachable host

`127.0.0.1` inside the backend container is the *container itself*, not
your Docker host — if the Minecraft server runs on the same physical
machine as Docker, using `127.0.0.1` in `backend/.env` (the default in
`.env.example`, meant for non-Docker installs) will fail to connect. Use
the special hostname `host.docker.internal` instead, which
`docker-compose.yml` already maps to the Docker host for you:

```
RCON_HOST=host.docker.internal
SSH_HOST=host.docker.internal
```

This same `SSH_HOST` is what the start/stop/restart/backup scripts run
against too, so fixing it here covers both.

If the Minecraft server runs on a *different* machine, use its real
reachable address instead — that case needs no special handling.

### 3. Set `VITE_API_BASE_URL` to how you'll reach the panel

In the root `.env`, set `VITE_API_BASE_URL` to the URL you'll actually
open in a browser — e.g. `http://192.168.1.50` for a LAN box, or
`http://localhost` if you're only testing on the same machine. This gets
baked into the frontend's JavaScript at build time, so if you change it
later you need to rebuild: `docker compose build frontend`.

### 4. Build and start

```bash
docker compose up -d --build
```

Open `http://<the address from step 3>/` — nginx listens on port 80,
which is the only port this stack publishes to the host (the backend is
only reachable from the frontend container, over Docker's internal
network).

Useful commands:

```bash
docker compose logs -f backend    # backend logs (script output, connection status, errors)
docker compose logs -f frontend   # nginx access/error logs
docker compose restart backend    # pick up backend/.env changes (no rebuild needed)
docker compose down               # stop and remove both containers
```

Changes to `backend/.env` take effect on `docker compose restart backend`
(it's bind-mounted, not baked into the image). Changes to the root `.env`'s
`VITE_API_BASE_URL` need `docker compose up -d --build` again, since Vite
inlines it at build time.

### HTTPS

This setup is plain HTTP on port 80, with no TLS — fine for trying it out
on a LAN, not fine for exposing it on the public internet, since JWTs and
SSH/RCON traffic would travel in plaintext. For real production use, put a
TLS-terminating reverse proxy (Caddy, Traefik, or nginx with certbot) in
front of port 80, or extend `frontend/nginx.conf` to listen on 443 with a
certificate and add a container/host-level way to obtain one. That's
deliberately left out here to keep this stack's first run as simple as
possible.

### Implementation notes

- `backend/.env` is bind-mounted into the container (`/app/.env`) rather
  than loaded via Compose's `env_file:`. This is intentional: Compose's
  `env_file:` interpolates `$VAR`/`${VAR}` in the file, which would
  silently corrupt bcrypt hashes in `USERS` (they contain literal `$`
  characters) unless every `$` were doubled to `$$`. Mounting the file
  instead lets the app's own dotenv loader read it exactly as written, so
  hashes from `npm run hash` work unmodified — the same file, unchanged,
  works both with and without Docker.
- The backend image is multi-stage: dependencies (including the native
  build toolchain `ssh2`'s optional `cpu-features` addon needs) are
  installed once, `tsc` runs in a build stage, and the runtime stage copies
  the compiled `dist/` plus a `node_modules` pruned of devDependencies —
  no compiler or build tools ship in the final image.
- The frontend image is also multi-stage: `vite build` runs in a Node
  stage, and only the static output is copied into a plain `nginx:alpine`
  image alongside `frontend/nginx.conf`.
- The scheduler's tasks and the audit log ([Local data storage](#every-env-variable-explained))
  live in the named `paloondra-data` volume, mounted at `/app/data` (the
  default `DATA_DIR`). Without it, both would reset every time the backend
  container is recreated. `docker compose down -v` removes it - don't run
  that unless you actually want to lose scheduled tasks and audit history.

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

**Start/Stop/Restart/Backup show "Failed to run ... over SSH" in the Dashboard log**
The script action couldn't even reach the SSH connection - same causes and
fixes as the SSH terminal connection errors above (wrong `SSH_HOST`/
`SSH_PORT`, bad credentials, network/firewall). The script itself never ran.

**Start/Stop/Restart/Backup run but immediately show a non-zero exit code**
- Confirm `SCRIPTS_DIR` in `backend/.env` is the absolute path **on the
  target server** (the SSH host), not on whatever machine runs the
  Paloondra backend - these are usually the same host, but don't have to
  be.
- Confirm `START_SCRIPT`/`STOP_SCRIPT`/`RESTART_SCRIPT`/`BACKUP_SCRIPT` are
  just filenames (`start.sh`), not paths, and that those files actually
  exist inside `SCRIPTS_DIR` on the server.
- Confirm they're executable **on the server**: `chmod +x` everything in
  `SCRIPTS_DIR` there (not on the machine running the backend, if that's a
  different one). A "Permission denied" line in the Dashboard log almost
  always means this.

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
concerned. (Not applicable to the Docker setup - nginx proxies `/api` on
the same origin the page was loaded from, so there's no cross-origin
request to begin with.)

**Docker: RCON/SSH show "connect ECONNREFUSED 127.0.0.1:..."**
`127.0.0.1` inside the backend container refers to the container itself.
If the Minecraft server is on the same physical machine as Docker, set
`RCON_HOST`/`SSH_HOST` in `backend/.env` to `host.docker.internal` instead
(see [Docker](#docker), step 2) and `docker compose restart backend`. This
affects the start/stop/restart/backup scripts too, since they run over the
same SSH connection.

**Plugins/Backups/Server Config tab shows "not configured"**
`PLUGINS_DIR` / `BACKUPS_DIR` / `SERVER_PROPERTIES_PATH` is unset in
`backend/.env`. These are optional (unlike RCON/SSH, the backend still
starts without them) so the tab just tells you it needs a value instead of
failing at startup - set the relevant one and restart the backend.

**Plugins list shows filenames but no real name/version/author**
`plugin.yml`/`paper-plugin.yml` wasn't found or didn't parse inside that
jar - this is display-only and doesn't block installing, enabling, or
deleting it. Some jars (unusual build layouts, obfuscation) genuinely don't
have a readable one; the filename fallback is expected in that case.

**Installing a plugin fails with "doesn't look like a valid .jar file"**
The downloaded/uploaded content doesn't start with a zip signature - the
URL probably points to an HTML page (a download *landing* page, not the
direct file link) rather than the actual `.jar`. Find the direct download
link and try again.

**Plugin store search fails with a rate-limit error**
You're hitting Modrinth's public API rate limit. Wait a bit and search
again - this isn't something Paloondra's config controls.

**Scheduled task won't save: "... is not a valid cron expression"**
Use the preset dropdown in the task form for known-good examples, or
double check you have exactly 5 fields (minute hour day month weekday) -
or 6 with an optional leading seconds field. `node-cron`'s validator is
what's rejecting it, not a Paloondra-specific restriction.

**Scheduled restart/RCON task ran but nothing happened in-game**
Check the task's "Last run" column (hover it for the full result) and the
audit log - a restart task only *triggers* `RESTART_SCRIPT` (see the
Dashboard for its live output, same as clicking Restart by hand); an RCON
task's result is the raw RCON response, which will clearly show a
connection error if RCON was down at the time.

---

## Project structure

```
backend/    Express + TypeScript API and WebSocket server
frontend/   React + Vite + TypeScript + Tailwind UI
scripts/    Example start/stop/restart/backup .sh templates - copy these to
            SCRIPTS_DIR on your target server, they don't run from here
docker-compose.yml, backend/Dockerfile, frontend/Dockerfile, frontend/nginx.conf
            The Docker setup - see the Docker section above
```

## Tabs

| Tab | What it does |
|---|---|
| **Dashboard** | Online/offline status, Start/Stop/Restart buttons (run the configured scripts over SSH on the target server, output streams live), player count/TPS/host CPU/RAM/disk charts, online players with quick kick/ban/op/whitelist actions, a broadcast (`say`) box, and a recent-activity audit log panel |
| **RCON Console** | Command input with history (↑/↓), live output log, auto-reconnect |
| **SSH Terminal** | Full interactive shell (xterm.js + ssh2 PTY), resizable, auto-reconnects a fresh session if the connection drops |
| **File Manager** | SFTP (or sudo-mode) browser: navigate, upload/download, rename, delete, mkdir, drag & drop (upload from OS, move between folders), built-in Monaco editor for text files |
| **Plugins & Mods** | Installed plugins (enable/disable/delete/download, real names parsed from `plugin.yml`), install by URL or drag-and-drop `.jar`, and a Modrinth-backed plugin store with search/filters/install - see [Plugins & the plugin store](#plugins--the-plugin-store). A banner at the top makes clear only plugins are supported; mod support isn't available yet |
| **Backups** | Trigger `BACKUP_SCRIPT`, list/download/delete what it produces - see [Backups](#backups) |
| **Scheduled Tasks** | Cron-scheduled restarts or RCON commands, editable list, run-now - see [Scheduled tasks](#scheduled-tasks) |
| **Server Config** | Friendly form + raw-text editor for `server.properties` - see [server.properties editor](#serverproperties-editor) |

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
- **Reconnection**: RCON, the shared SSH connection (metrics, sudo-mode
  file ops, and the start/stop/restart/backup scripts), and the plain-SFTP
  connection each retry with exponential backoff (2s → 30s) if dropped, and
  immediately attempt a fresh connection on demand (e.g. the moment you
  send an RCON command, click Start, or hit the file manager) rather than
  waiting out a pending backoff timer. The SSH terminal tab opens a
  dedicated connection per browser session and reconnects automatically if
  it drops.
- The `dev` known-vulnerability scan (`npm audit`) flags esbuild/vite's
  **dev server** (not the production build) for a request-forwarding issue
  fixed only in vite 8 — a breaking upgrade out of scope here. Don't expose
  `vite dev` to an untrusted network; use `npm run build` + a real static
  server for anything other than local development.
- **Scheduled tasks and the audit log** are the only state that persists
  outside of "whatever's on the target server" - small JSON files in
  `DATA_DIR`, written via a temp-file-then-rename so a crash mid-write
  can't corrupt them. Everything else (plugin list, backups, players) is
  read live from the target server on every request; there's no cache to
  go stale except the small per-jar metadata cache in
  `plugins.service.ts`, keyed by file size + modified time.
- **The plugin store is the one feature that reaches outside your own
  infrastructure** - search/browse/version calls go straight to
  `MODRINTH_API_URL` from the backend (never the browser, avoiding CORS
  and keeping Modrinth entirely out of the frontend's network surface).
  Installing from it re-downloads the chosen file and re-uploads it to
  `PLUGINS_DIR` over SFTP - Modrinth itself never touches your server. The
  install endpoint only accepts file URLs on `cdn.modrinth.com`, separate
  from the general "install by URL" feature which accepts any http(s) URL
  you give it on purpose.

## Security

- Change `JWT_SECRET` and every user's password before exposing this
  anywhere beyond localhost.
- Put the backend behind HTTPS/WSS (reverse proxy) in production.
- Only enable `SFTP_USE_SUDO` if you understand and accept what it grants —
  see [Enabling sudo mode](#enabling-sudo-mode-for-the-file-manager).
- The SFTP file editor refuses to open files over `EDITOR_MAX_FILE_SIZE`
  bytes (default 2 MiB) or files that look binary.
- **"Install plugin by URL" fetches any http(s) URL you give it** and
  uploads the result to `PLUGINS_DIR` as a `.jar` if it passes a basic
  zip-signature check. That's the feature working as designed, not a bug -
  same trust model as pasting a link into any other "download this for me"
  tool. Only every user in `USERS` can reach it (it's behind the same auth
  as everything else), so this is scoped by "who has a Paloondra login",
  same as file deletes or running arbitrary RCON commands already are.
- The Modrinth-backed **install-from-store** endpoint is intentionally
  narrower: it only accepts file URLs on `cdn.modrinth.com`, so a request
  crafted to look like a store install can't be used to smuggle an
  arbitrary-URL fetch past that restriction.
- Every plugin/backup filename that reaches a server-side path join is
  validated to be a bare filename first (no `/`, `\`, `..`) - installing,
  toggling, or deleting a plugin/backup can't be used to reach outside
  `PLUGINS_DIR`/`BACKUPS_DIR` via a crafted filename.
- The Dashboard's kick/ban/op/whitelist/broadcast buttons and every
  plugin/backup/scheduler/server.properties mutation are recorded in the
  [audit log](#audit-log) with the acting username - the interactive RCON
  Console tab is not (it already shows its own live history in place).
