import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { runRconCommand } from '../../api/rcon';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { PlayersInfo } from '../../types';
import Spinner from '../common/Spinner';

interface Props {
  players: PlayersInfo | null;
}

type Action = 'kick' | 'ban' | 'op' | 'whitelist';

const ACTION_COMMAND: Record<Action, (name: string) => string> = {
  kick: (name) => `kick ${name}`,
  ban: (name) => `ban ${name}`,
  op: (name) => `op ${name}`,
  whitelist: (name) => `whitelist add ${name}`,
};

export default function PlayerManagement({ players }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();
  const [busy, setBusy] = useState<string | null>(null);

  const ACTION_LABEL: Record<Action, string> = {
    kick: t('players.kick'),
    ban: t('players.ban'),
    op: t('players.op'),
    whitelist: t('players.whitelist'),
  };

  async function runAction(player: string, action: Action) {
    if (action === 'kick' || action === 'ban') {
      const confirmed = await dialog.confirm({
        title: t('players.confirmTitle', { action: ACTION_LABEL[action], player }),
        message: action === 'ban' ? t('players.banExtraMessage') : undefined,
        confirmLabel: ACTION_LABEL[action],
        danger: true,
      });
      if (!confirmed) return;
    }

    const key = `${player}:${action}`;
    setBusy(key);
    try {
      const { response } = await runRconCommand(ACTION_COMMAND[action](player));
      toast.success(response.trim() || t('players.actionSentFallback', { action: ACTION_LABEL[action], player }));
    } catch (err) {
      toast.error(getErrorMessage(err, t('players.failedToRunAction', { action: ACTION_LABEL[action], player })));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-panel-text">{t('players.title')}</h2>
      {!players || players.online === 0 ? (
        <p className="text-sm text-panel-muted">{t('players.noPlayersOnline')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {players.names.map((name) => (
            <li
              key={name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel-surface2 px-3 py-2"
            >
              <span className="text-sm text-panel-text">{name}</span>
              <div className="flex gap-1.5 text-xs">
                {(['kick', 'ban', 'op', 'whitelist'] as Action[]).map((action) => {
                  const isBusy = busy === `${name}:${action}`;
                  return (
                    <button
                      key={action}
                      onClick={() => runAction(name, action)}
                      disabled={busy !== null}
                      className={`flex items-center gap-1 rounded-md border border-panel-border px-2 py-1 transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50 ${
                        action === 'ban' ? 'hover:border-panel-danger hover:text-panel-danger' : ''
                      }`}
                    >
                      {isBusy && <Spinner className="h-3 w-3" />}
                      {ACTION_LABEL[action]}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
