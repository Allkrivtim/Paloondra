import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addOp, listOps, removeOp, setOpLevel } from '../../api/ops';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { api } from '../../api/client';
import { OpEntry } from '../../types';
import Spinner from '../common/Spinner';
import RestartBanner from '../common/RestartBanner';

const LEVELS = [1, 2, 3, 4];

export default function Ops() {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();
  const [entries, setEntries] = useState<OpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [nameInput, setNameInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setEntries(await listOps());
    } catch (err) {
      setLoadError(getErrorMessage(err, t('ops.failedToLoad')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function withBusy(key: string, action: () => Promise<void>) {
    setBusy((prev) => new Set(prev).add(key));
    try {
      await action();
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    setAdding(true);
    try {
      const { entries: next } = await addOp(name);
      setEntries(next);
      setNameInput('');
      toast.success(t('ops.addedToast', { name }));
    } catch (err) {
      toast.error(getErrorMessage(err, t('ops.failedToAdd')));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(entry: OpEntry) {
    const confirmed = await dialog.confirm({
      title: t('ops.removeTitle', { name: entry.name }),
      confirmLabel: t('ops.remove'),
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(entry.uuid, async () => {
      try {
        const { entries: next } = await removeOp(entry.name);
        setEntries(next);
        toast.success(t('ops.removedToast', { name: entry.name }));
      } catch (err) {
        toast.error(getErrorMessage(err, t('ops.failedToRemove')));
      }
    });
  }

  async function handleLevelChange(entry: OpEntry, level: number) {
    if (level === entry.level) return;
    await withBusy(entry.uuid, async () => {
      try {
        const { entries: next } = await setOpLevel(entry.uuid, level);
        setEntries(next);
        setNeedsRestart(true);
        toast.success(t('ops.levelChangedToast'));
      } catch (err) {
        toast.error(getErrorMessage(err, t('ops.failedToChangeLevel')));
      }
    });
  }

  async function handleRestart() {
    setRestarting(true);
    try {
      await api.post('/server/restart');
      toast.success(t('serverConfig.restartTriggered'));
      setNeedsRestart(false);
    } catch (err) {
      toast.error(getErrorMessage(err, t('serverConfig.failedToTriggerRestart')));
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-sm font-semibold text-panel-text">{t('ops.title')}</h1>

      {needsRestart && (
        <RestartBanner
          message={t('ops.levelChangeRestartMessage')}
          onRestart={handleRestart}
          restarting={restarting}
          onDismiss={() => setNeedsRestart(false)}
        />
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder={t('ops.addPlaceholder')}
          className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
        />
        <button
          type="submit"
          disabled={adding || !nameInput.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {adding && <Spinner className="h-3.5 w-3.5 text-black" />}
          {t('ops.add')}
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-panel-border bg-panel-surface">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> {t('ops.loading')}
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="max-w-sm text-sm text-panel-danger">{loadError}</p>
            <button
              onClick={refresh}
              className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
            >
              {t('ops.retry')}
            </button>
          </div>
        )}

        {!loading && !loadError && entries.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">🛡️</span>
            <p className="text-sm">{t('ops.noEntriesTitle')}</p>
            <p className="text-xs">{t('ops.noEntriesHint')}</p>
          </div>
        )}

        {!loading && !loadError && entries.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('ops.columnName')}</th>
                <th className="px-4 py-2 font-medium">{t('ops.columnUuid')}</th>
                <th className="px-4 py-2 font-medium">{t('ops.columnLevel')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('ops.columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isBusy = busy.has(entry.uuid);
                return (
                  <tr
                    key={entry.uuid}
                    className={`border-t border-panel-border transition hover:bg-panel-surface2 ${
                      isBusy ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-panel-text">
                      <div className="flex items-center gap-2">
                        {entry.name}
                        {isBusy && <Spinner className="h-3 w-3" />}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-panel-muted">{entry.uuid}</td>
                    <td className="px-4 py-2">
                      <select
                        value={entry.level}
                        onChange={(e) => handleLevelChange(entry, Number(e.target.value))}
                        disabled={isBusy}
                        className="rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1 text-xs text-panel-text outline-none focus:border-panel-accent disabled:opacity-50"
                      >
                        {LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          onClick={() => handleRemove(entry)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-danger disabled:opacity-50"
                        >
                          {t('ops.remove')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
