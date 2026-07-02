import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
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
      setLoadError(getErrorMessage(err, 'Failed to load plugins'));
    } finally {
      setLoading(false);
    }
  }, []);

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
        toast.success(`${plugin.enabled ? 'Disabled' : 'Enabled'} "${plugin.name ?? plugin.filename}"`);
        onChanged();
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to toggle plugin'));
      }
    });
  }

  async function handleDelete(plugin: PluginInfo) {
    const confirmed = await dialog.confirm({
      title: `Delete "${plugin.name ?? plugin.filename}"?`,
      message: 'This removes the .jar from the server. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(plugin.filename, async () => {
      try {
        await deletePlugin(plugin.filename);
        toast.success(`Deleted "${plugin.name ?? plugin.filename}"`);
        onChanged();
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to delete plugin'));
      }
    });
  }

  async function handleDownload(plugin: PluginInfo) {
    try {
      await downloadFile(plugin.path, plugin.filename);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to download plugin'));
    }
  }

  async function handleInstallUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setInstallingUrl(true);
    try {
      const plugin = await installPluginFromUrl(urlInput.trim());
      toast.success(`Installed "${plugin.name ?? plugin.filename}"`);
      setUrlInput('');
      onChanged();
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to install plugin'));
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
          toast.success(`Installed "${plugin.name ?? plugin.filename}"`);
          onChanged();
        } catch (err) {
          toast.error(getErrorMessage(err, `Failed to install "${file.name}"`));
        } finally {
          setUploadProgress(null);
        }
      }
      await refresh();
    },
    [onChanged, refresh, toast],
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
          <h3 className="mb-2 text-sm font-semibold text-panel-text">Install by URL</h3>
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/plugin.jar"
              className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
            />
            <button
              type="submit"
              disabled={installingUrl || !urlInput.trim()}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-panel-accent2 px-3 py-2 text-sm font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
            >
              {installingUrl && <Spinner className="h-3.5 w-3.5 text-black" />}
              Install
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
          <h3 className="text-sm font-semibold text-panel-text">Install by file</h3>
          {uploadProgress !== null ? (
            <div className="flex items-center gap-2 text-xs text-panel-muted">
              <Spinner className="h-3.5 w-3.5" /> Uploading... {uploadProgress}%
            </div>
          ) : (
            <p className="text-xs text-panel-muted">
              Drag a .jar here, or{' '}
              <button onClick={open} className="text-panel-accent underline">
                browse
              </button>
            </p>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-panel-border bg-panel-surface">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> Loading plugins...
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
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && plugins.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">🧩</span>
            <p className="text-sm">No plugins installed</p>
            <p className="text-xs">Install one above, or browse the Store tab.</p>
          </div>
        )}

        {!loading && !loadError && plugins.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Plugin</th>
                <th className="px-4 py-2 font-medium">Version</th>
                <th className="px-4 py-2 font-medium">Author</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Modified</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
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
                    <td className="px-4 py-2 text-panel-muted">{plugin.version ?? '—'}</td>
                    <td className="px-4 py-2 text-panel-muted">{plugin.author ?? '—'}</td>
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
                        {plugin.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          onClick={() => handleToggle(plugin)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                        >
                          {plugin.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDownload(plugin)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => handleDelete(plugin)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-danger disabled:opacity-50"
                        >
                          Delete
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
