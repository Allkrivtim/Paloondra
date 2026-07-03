import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import {
  deletePlugin,
  installPluginFromFile,
  installPluginFromUrl,
  listPlugins,
  togglePlugin,
} from '../../api/plugins';
import { downloadFile } from '../../api/sftp';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { PluginInfo } from '../../types';
import Spinner from '../common/Spinner';
import { formatBytes, formatDate } from '../sftp/format';

interface Props {
  onChanged: () => void;
}

export default function InstalledPlugins({ onChanged }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [urlInput, setUrlInput] = useState('');
  const [installingUrl, setInstallingUrl] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPlugins(await listPlugins());
    } catch (err) {
      setLoadError(getErrorMessage(err, t('plugins.failedToLoadPlugins')));
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

  async function handleToggle(plugin: PluginInfo) {
    await withBusy(plugin.filename, async () => {
      try {
        await togglePlugin(plugin.filename, !plugin.enabled);
        const name = plugin.name ?? plugin.filename;
        toast.success(plugin.enabled ? t('plugins.disabledToast', { name }) : t('plugins.enabledToast', { name }));
        onChanged();
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, t('plugins.failedToToggle')));
      }
    });
  }

  async function handleDelete(plugin: PluginInfo) {
    const name = plugin.name ?? plugin.filename;
    const confirmed = await dialog.confirm({
      title: t('plugins.deleteTitle', { name }),
      message: t('plugins.deleteMessage'),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(plugin.filename, async () => {
      try {
        await deletePlugin(plugin.filename);
        toast.success(t('plugins.deletedToast', { name }));
        onChanged();
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, t('plugins.failedToDelete')));
      }
    });
  }

  async function handleDownload(plugin: PluginInfo) {
    try {
      await downloadFile(plugin.path, plugin.filename);
    } catch (err) {
      toast.error(getErrorMessage(err, t('plugins.failedToDownload')));
    }
  }

  async function handleInstallUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setInstallingUrl(true);
    try {
      const plugin = await installPluginFromUrl(urlInput.trim());
      toast.success(t('plugins.installedToast', { name: plugin.name ?? plugin.filename }));
      setUrlInput('');
      onChanged();
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, t('plugins.failedToInstall')));
    } finally {
      setInstallingUrl(false);
    }
  }

  const onDropFiles = useCallback(
    async (accepted: File[]) => {
      for (const file of accepted) {
        setUploadProgress(0);
        try {
          const plugin = await installPluginFromFile(file, setUploadProgress);
          toast.success(t('plugins.installedToast', { name: plugin.name ?? plugin.filename }));
          onChanged();
        } catch (err) {
          toast.error(getErrorMessage(err, t('plugins.failedToInstallNamed', { name: file.name })));
        } finally {
          setUploadProgress(null);
        }
      }
      await refresh();
    },
    [onChanged, refresh, toast, t],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: onDropFiles,
    noClick: true,
    noKeyboard: true,
    accept: { 'application/java-archive': ['.jar'] },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <form
          onSubmit={handleInstallUrl}
          className="rounded-xl border border-panel-border bg-panel-surface p-4"
        >
          <h3 className="mb-2 text-sm font-semibold text-panel-text">{t('plugins.installByUrl')}</h3>
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder={t('plugins.installByUrlPlaceholder')}
              className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
            />
            <button
              type="submit"
              disabled={installingUrl || !urlInput.trim()}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-panel-accent2 px-3 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
            >
              {installingUrl && <Spinner className="h-3.5 w-3.5 text-black" />}
              {t('plugins.install')}
            </button>
          </div>
        </form>

        <div
          {...getRootProps()}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-4 text-center transition ${
            isDragActive ? 'border-panel-accent bg-panel-accent/5' : 'border-panel-border bg-panel-surface'
          }`}
        >
          <input {...getInputProps()} />
          <h3 className="text-sm font-semibold text-panel-text">{t('plugins.installByFile')}</h3>
          {uploadProgress !== null ? (
            <div className="flex items-center gap-2 text-xs text-panel-muted">
              <Spinner className="h-3.5 w-3.5" /> {t('plugins.uploading', { progress: uploadProgress })}
            </div>
          ) : (
            <p className="text-xs text-panel-muted">
              {t('plugins.dropOrBrowse')}{' '}
              <button onClick={open} className="text-panel-accent underline">
                {t('plugins.browse')}
              </button>
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-panel-border bg-panel-surface">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> {t('plugins.loadingPlugins')}
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

        {!loading && !loadError && plugins.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">🧩</span>
            <p className="text-sm">{t('plugins.noPluginsTitle')}</p>
            <p className="text-xs">{t('plugins.noPluginsHint')}</p>
          </div>
        )}

        {!loading && !loadError && plugins.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('plugins.columnPlugin')}</th>
                <th className="px-4 py-2 font-medium">{t('plugins.columnVersion')}</th>
                <th className="px-4 py-2 font-medium">{t('plugins.columnAuthor')}</th>
                <th className="px-4 py-2 font-medium">{t('plugins.columnSize')}</th>
                <th className="px-4 py-2 font-medium">{t('plugins.columnModified')}</th>
                <th className="px-4 py-2 font-medium">{t('plugins.columnStatus')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('plugins.columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((plugin) => {
                const isBusy = busy.has(plugin.filename);
                return (
                  <tr
                    key={plugin.filename}
                    className={`border-t border-panel-border transition hover:bg-panel-surface2 ${
                      isBusy ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span>🧩</span>
                        <div>
                          <div className="text-panel-text">{plugin.name ?? plugin.filename}</div>
                          {plugin.description && (
                            <div className="max-w-xs truncate text-xs text-panel-muted">{plugin.description}</div>
                          )}
                        </div>
                        {isBusy && <Spinner className="h-3 w-3" />}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-panel-muted">{plugin.version ?? t('common.emptyValue')}</td>
                    <td className="px-4 py-2 text-panel-muted">{plugin.author ?? t('common.emptyValue')}</td>
                    <td className="px-4 py-2 text-panel-muted">{formatBytes(plugin.size)}</td>
                    <td className="px-4 py-2 text-panel-muted">{formatDate(plugin.modifiedAt)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          plugin.enabled
                            ? 'bg-panel-accent/10 text-panel-accent'
                            : 'bg-panel-muted/10 text-panel-muted'
                        }`}
                      >
                        {plugin.enabled ? t('common.enabled') : t('common.disabled')}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          onClick={() => handleToggle(plugin)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                        >
                          {plugin.enabled ? t('plugins.disable') : t('plugins.enable')}
                        </button>
                        <button
                          onClick={() => handleDownload(plugin)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                        >
                          {t('plugins.download')}
                        </button>
                        <button
                          onClick={() => handleDelete(plugin)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-danger disabled:opacity-50"
                        >
                          {t('plugins.delete')}
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
