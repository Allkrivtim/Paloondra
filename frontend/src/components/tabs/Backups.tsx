import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteBackup, listBackups, runBackup } from '../../api/backups';
import { downloadFile } from '../../api/sftp';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { BackupInfo } from '../../types';
import Spinner from '../common/Spinner';
import { formatBytes, formatDate } from '../sftp/format';

export default function Backups() {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setBackups(await listBackups());
    } catch (err) {
      setLoadError(getErrorMessage(err, t('backups.failedToLoadBackups')));
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

  async function handleRunBackup() {
    setRunning(true);
    try {
      await runBackup();
      toast.success(t('backups.backupTriggered'));
      setTimeout(refresh, 3000);
    } catch (err) {
      toast.error(getErrorMessage(err, t('backups.failedToTrigger')));
    } finally {
      setRunning(false);
    }
  }

  async function handleDownload(backup: BackupInfo) {
    try {
      await downloadFile(backup.path, backup.filename);
    } catch (err) {
      toast.error(getErrorMessage(err, t('backups.failedToDownload')));
    }
  }

  async function handleDelete(backup: BackupInfo) {
    const confirmed = await dialog.confirm({
      title: t('backups.deleteTitle', { name: backup.filename }),
      message: t('backups.deleteMessage'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(backup.filename, async () => {
      try {
        await deleteBackup(backup.filename);
        toast.success(t('backups.deletedToast', { name: backup.filename }));
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, t('backups.failedToDelete')));
      }
    });
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-panel-text">{t('backups.title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={handleRunBackup}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {running && <Spinner className="h-3 w-3 text-black" />}
            {running ? t('backups.triggering') : t('backups.runBackupNow')}
          </button>
          <button
            onClick={refresh}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
          >
            {t('backups.refresh')}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-panel-border bg-panel-surface">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> {t('backups.loadingBackups')}
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
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !loadError && backups.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">🗄️</span>
            <p className="text-sm">{t('backups.noBackupsTitle')}</p>
            <p className="text-xs">{t('backups.noBackupsHint')}</p>
          </div>
        )}

        {!loading && !loadError && backups.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('backups.columnFilename')}</th>
                <th className="px-4 py-2 font-medium">{t('backups.columnSize')}</th>
                <th className="px-4 py-2 font-medium">{t('backups.columnCreated')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('backups.columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => {
                const isBusy = busy.has(backup.filename);
                return (
                  <tr
                    key={backup.filename}
                    className={`border-t border-panel-border transition hover:bg-panel-surface2 ${
                      isBusy ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-panel-text">
                      <div className="flex items-center gap-2">
                        <span>🗄️</span>
                        {backup.filename}
                        {isBusy && <Spinner className="h-3 w-3" />}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-panel-muted">{formatBytes(backup.size)}</td>
                    <td className="px-4 py-2 text-panel-muted">{formatDate(backup.modifiedAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          onClick={() => handleDownload(backup)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                        >
                          {t('backups.download')}
                        </button>
                        <button
                          onClick={() => handleDelete(backup)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-danger disabled:opacity-50"
                        >
                          {t('backups.delete')}
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
