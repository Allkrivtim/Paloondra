import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addToWhitelist,
  getWhitelist,
  reloadWhitelist,
  removeFromWhitelist,
  setWhitelistEnabled,
} from '../../api/whitelist';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { WhitelistDocument } from '../../types';
import Spinner from '../common/Spinner';

export default function Whitelist() {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();
  const [doc, setDoc] = useState<WhitelistDocument>({ enabled: false, entries: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setDoc(await getWhitelist());
    } catch (err) {
      setLoadError(getErrorMessage(err, t('whitelist.failedToLoad')));
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
      const { document } = await addToWhitelist(name);
      setDoc(document);
      setNameInput('');
      toast.success(t('whitelist.addedToast', { name }));
    } catch (err) {
      toast.error(getErrorMessage(err, t('whitelist.failedToAdd')));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(name: string) {
    const confirmed = await dialog.confirm({
      title: t('whitelist.removeTitle', { name }),
      confirmLabel: t('whitelist.remove'),
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(name, async () => {
      try {
        const { document } = await removeFromWhitelist(name);
        setDoc(document);
        toast.success(t('whitelist.removedToast', { name }));
      } catch (err) {
        toast.error(getErrorMessage(err, t('whitelist.failedToRemove')));
      }
    });
  }

  async function handleReload() {
    setReloading(true);
    try {
      const { document } = await reloadWhitelist();
      setDoc(document);
      toast.success(t('whitelist.reloadedToast'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('whitelist.failedToReload')));
    } finally {
      setReloading(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    const next = !doc.enabled;
    try {
      const { document } = await setWhitelistEnabled(next);
      setDoc(document);
      toast.success(next ? t('whitelist.toggledOnToast') : t('whitelist.toggledOffToast'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('whitelist.failedToToggle')));
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-panel-text">{t('whitelist.title')}</h1>
          <button onClick={handleToggle} disabled={toggling || loading} className="flex items-center gap-2">
            <span
              className={`inline-block h-5 w-9 rounded-full transition ${
                doc.enabled ? 'bg-panel-accent2' : 'bg-panel-surface2'
              }`}
            >
              <span
                className={`block h-4 w-4 translate-y-0.5 rounded-full bg-black transition ${
                  doc.enabled ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </span>
            <span className="text-xs text-panel-muted">
              {doc.enabled ? t('whitelist.enabled') : t('whitelist.disabled')}
            </span>
          </button>
        </div>
        <button
          onClick={handleReload}
          disabled={reloading}
          title={t('whitelist.reloadTooltip')}
          className="flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50"
        >
          {reloading && <Spinner className="h-3 w-3" />}
          {t('whitelist.reload')}
        </button>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder={t('whitelist.addPlaceholder')}
          className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
        />
        <button
          type="submit"
          disabled={adding || !nameInput.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {adding && <Spinner className="h-3.5 w-3.5 text-black" />}
          {t('whitelist.add')}
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-panel-border bg-panel-surface">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> {t('whitelist.loading')}
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
              {t('whitelist.retry')}
            </button>
          </div>
        )}

        {!loading && !loadError && doc.entries.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">📋</span>
            <p className="text-sm">{t('whitelist.noEntriesTitle')}</p>
            <p className="text-xs">{t('whitelist.noEntriesHint')}</p>
          </div>
        )}

        {!loading && !loadError && doc.entries.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('whitelist.columnName')}</th>
                <th className="px-4 py-2 font-medium">{t('whitelist.columnUuid')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('whitelist.columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {doc.entries.map((entry) => {
                const isBusy = busy.has(entry.name);
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
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          onClick={() => handleRemove(entry.name)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-danger disabled:opacity-50"
                        >
                          {t('whitelist.remove')}
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
