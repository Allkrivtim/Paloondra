# scripts/

This directory is a placeholder for your **own** start/stop/restart/backup
`.sh` scripts. It's not meant to ship real scripts in version control - the
`.example` files here are just a starting point. Copy one, drop the
`.example` suffix, and edit it for how you actually run your Minecraft
server (`screen`, `tmux`, `systemctl`, Docker, whatever).

## How this maps into Docker

`docker-compose.yml` mounts this directory (path controlled by `SCRIPTS_DIR`
in the repo-root `.env`) into the backend container at `/scripts`. Point
`START_SCRIPT` / `STOP_SCRIPT` / `RESTART_SCRIPT` in `backend/.env` at the
**container** path, not the host path:

```
START_SCRIPT=/scripts/start.sh
STOP_SCRIPT=/scripts/stop.sh
RESTART_SCRIPT=/scripts/restart.sh
```

There's no `BACKUP_SCRIPT` variable - the panel doesn't call a backup script
itself, but `backup.sh` sitting in this same directory is reachable from
inside the container too (e.g. for a host cron job that runs it via
`docker compose exec backend sh /scripts/backup.sh`, or for `start.sh`/
`stop.sh` to call it directly).

See the main [README](../README.md#docker) for the full Docker setup guide.

Make sure your real scripts are executable on the host before starting the
stack: `chmod +x scripts/*.sh`.
