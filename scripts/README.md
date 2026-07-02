# scripts/

This directory holds example start/stop/restart/backup `.sh` templates.
They're not meant to run from here - Paloondra runs your scripts **on the
target Minecraft server**, over SSH, not on whatever machine runs the
backend (container or otherwise). Copy the `.example` files you want, drop
the `.example` suffix, edit them for how you actually run your server
(`screen`, `tmux`, `systemctl`, Docker, whatever), and **upload them to
your server** into one directory.

## How this maps into `backend/.env`

Whatever directory you put your scripts in on the server is `SCRIPTS_DIR`.
Each of `START_SCRIPT` / `STOP_SCRIPT` / `RESTART_SCRIPT` / `BACKUP_SCRIPT`
is then just the filename inside it - Paloondra runs them as:

```
cd <SCRIPTS_DIR> && ./<filename>
```

over the same SSH connection the terminal tab and file manager use (see
`SSH_HOST`/`SSH_USER`/etc. in `backend/.env`). For example:

```
SCRIPTS_DIR=/home/minecraft/scripts
START_SCRIPT=start.sh
STOP_SCRIPT=stop.sh
RESTART_SCRIPT=restart.sh
BACKUP_SCRIPT=backup.sh
```

`BACKUP_SCRIPT` isn't wired to a Dashboard button (there isn't one), but
it's runnable the same way as the other three if you want to trigger it
from your own tooling (`POST /api/server/backup`).

Make sure the scripts are executable **on the server**:
`chmod +x /home/minecraft/scripts/*.sh` (or wherever you put them) - not on
the machine running the Paloondra backend, if that's a different one.

See the main [README](../README.md#every-env-variable-explained) for the
full variable reference, and the [Docker section](../README.md#docker) if
you're running the backend in a container - no volume mount is needed for
scripts there, since they live entirely on the remote server.
