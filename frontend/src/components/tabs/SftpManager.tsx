import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  deleteItem,
  downloadFile,
  getDefaultPath,
  listDir,
  mkdir,
  moveItem,
  readFile,
  renameItem,
  uploadFiles,
  writeFile,
} from '../../api/sftp';
import { getErrorMessage } from '../../api/errors';
import { SftpEntry } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import Breadcrumbs from '../sftp/Breadcrumbs';
import FileEditor from '../sftp/FileEditor';
import Spinner from '../common/Spinner';
import { basename, formatBytes, formatDate, joinPath, looksLikeTextFile } from '../sftp/format';

const EDITOR_SIZE_LIMIT = 2 * 1024 * 1024;

function icon(entry: SftpEntry): string {
  if (entry.type === 'directory') return '📁';
  if (entry.type === 'symlink') return '🔗';
  return '📄';
}

export default function SftpManager() {
  const toast = useToast();
  const dialog = useDialog();
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busyPaths, setBusyPaths] = useState<Set<string>>(new Set());

  const refresh = useCallback(async (dirPath: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listDir(dirPath);
      setEntries(res.entries);
      setCurrentPath(res.path);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Failed to load directory'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getDefaultPath()
      .then((defaultPath) => refresh(defaultPath))
      .catch(() => refresh('/'));
  }, [refresh]);

  const onDropFiles = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      try {
        await uploadFiles(currentPath, accepted);
        toast.success(`Uploaded ${accepted.length} file${accepted.length === 1 ? '' : 's'}`);
        await refresh(currentPath);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Upload failed'));
      }
    },
    [currentPath, refresh, toast],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: onDropFiles,
    noClick: true,
    noKeyboard: true,
  });

  function openEntry(entry: SftpEntry) {
    if (entry.type === 'directory') {
      refresh(entry.path);
      return;
    }
    if (entry.type === 'file') {
      if (entry.size > EDITOR_SIZE_LIMIT) {
        toast.error(`"${entry.name}" is too large to edit (${formatBytes(entry.size)}). Download it instead.`);
        return;
      }
      if (!looksLikeTextFile(entry.name)) {
        toast.error(`"${entry.name}" doesn't look like a text file. Download it instead.`);
        return;
      }
      withBusy(entry.path, async () => {
        try {
          const content = await readFile(entry.path);
          setEditingFile({ path: entry.path, content });
        } catch (err) {
          toast.error(getErrorMessage(err, 'Failed to open file'));
        }
      });
    }
  }

  async function withBusy(key: string, action: () => Promise<void>) {
    setBusyPaths((prev) => new Set(prev).add(key));
    try {
      await action();
    } finally {
      setBusyPaths((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleMkdir() {
    const name = await dialog.prompt({
      title: 'New folder',
      placeholder: 'Folder name',
      confirmLabel: 'Create',
    });
    if (!name) return;
    await withBusy('__mkdir__', async () => {
      try {
        await mkdir(joinPath(currentPath, name));
        toast.success(`Created "${name}"`);
        await refresh(currentPath);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to create folder'));
      }
    });
  }

  async function handleRename(entry: SftpEntry) {
    const name = await dialog.prompt({
      title: `Rename "${entry.name}"`,
      defaultValue: entry.name,
      confirmLabel: 'Rename',
    });
    if (!name || name === entry.name) return;
    await withBusy(entry.path, async () => {
      try {
        await renameItem(entry.path, joinPath(currentPath, name));
        toast.success(`Renamed to "${name}"`);
        await refresh(currentPath);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to rename'));
      }
    });
  }

  async function handleDelete(entry: SftpEntry) {
    const confirmed = await dialog.confirm({
      title: `Delete "${entry.name}"?`,
      message:
        entry.type === 'directory'
          ? 'This deletes the folder and everything inside it. This cannot be undone.'
          : 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(entry.path, async () => {
      try {
        await deleteItem(entry.path);
        toast.success(`Deleted "${entry.name}"`);
        await refresh(currentPath);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to delete'));
      }
    });
  }

  async function handleDownload(entry: SftpEntry) {
    try {
      await downloadFile(entry.path, entry.name);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to download'));
    }
  }

  async function handleMoveTo(targetDir: string) {
    if (!selected || selected === targetDir) return;
    const name = basename(selected);
    const dest = joinPath(targetDir, name);
    if (dest === selected) return;
    await withBusy(selected, async () => {
      try {
        await moveItem(selected, dest);
        toast.success(`Moved "${name}"`);
        await refresh(currentPath);
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to move item'));
      } finally {
        setSelected(null);
        setDragOverPath(null);
      }
    });
  }

  const mkdirBusy = busyPaths.has('__mkdir__');

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs path={currentPath} onNavigate={refresh} onDropMove={handleMoveTo} />
        <div className="flex gap-2">
          <button
            onClick={handleMkdir}
            disabled={mkdirBusy}
            className="flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50"
          >
            {mkdirBusy && <Spinner className="h-3 w-3" />}+ New Folder
          </button>
          <button
            onClick={open}
            className="rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent"
          >
            Upload
          </button>
          <button
            onClick={() => refresh(currentPath)}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
          >
            Refresh
          </button>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`relative min-h-0 flex-1 overflow-auto rounded-xl border ${
          isDragActive ? 'border-panel-accent bg-panel-accent/5' : 'border-panel-border'
        } bg-panel-surface`}
      >
        <input {...getInputProps()} />
        {isDragActive && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-panel-bg/70 text-sm font-medium text-panel-accent">
            Drop files to upload to {currentPath}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> Loading directory...
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="max-w-sm text-sm text-panel-danger">{loadError}</p>
            <button
              onClick={() => refresh(currentPath)}
              className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && entries.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">📂</span>
            <p className="text-sm">This folder is empty</p>
            <p className="text-xs">Drag files here to upload, or use the buttons above.</p>
          </div>
        )}

        {!loading && !loadError && entries.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Permissions</th>
                <th className="px-4 py-2 font-medium">Modified</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const busy = busyPaths.has(entry.path);
                return (
                  <tr
                    key={entry.path}
                    draggable
                    onDragStart={() => setSelected(entry.path)}
                    onDragOver={(e) => {
                      if (entry.type === 'directory') {
                        e.preventDefault();
                        setDragOverPath(entry.path);
                      }
                    }}
                    onDragLeave={() => setDragOverPath((p) => (p === entry.path ? null : p))}
                    onDrop={(e) => {
                      if (entry.type !== 'directory') return;
                      e.preventDefault();
                      e.stopPropagation();
                      handleMoveTo(entry.path);
                    }}
                    onDoubleClick={() => openEntry(entry)}
                    className={`cursor-pointer border-t border-panel-border transition hover:bg-panel-surface2 ${
                      dragOverPath === entry.path ? 'bg-panel-accent/10' : ''
                    } ${busy ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2">
                      <button onClick={() => openEntry(entry)} className="flex items-center gap-2 text-left">
                        <span>{icon(entry)}</span>
                        <span className="truncate text-panel-text">{entry.name}</span>
                        {busy && <Spinner className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-panel-muted">
                      {entry.type === 'file' ? formatBytes(entry.size) : '—'}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-panel-muted">{entry.permissions}</td>
                    <td className="px-4 py-2 text-panel-muted">{formatDate(entry.modifiedAt)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2 text-xs">
                        {entry.type === 'file' && (
                          <button
                            onClick={() => handleDownload(entry)}
                            disabled={busy}
                            className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                          >
                            Download
                          </button>
                        )}
                        <button
                          onClick={() => handleRename(entry)}
                          disabled={busy}
                          className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          disabled={busy}
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

      {editingFile && (
        <FileEditor
          path={editingFile.path}
          initialContent={editingFile.content}
          onClose={() => setEditingFile(null)}
          onSave={async (content) => {
            await writeFile(editingFile.path, content);
            toast.success('File saved');
          }}
        />
      )}
    </div>
  );
}
