import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  deleteItem,
  downloadFile,
  listDir,
  mkdir,
  moveItem,
  readFile,
  renameItem,
  uploadFiles,
  writeFile,
} from '../../api/sftp';
import { SftpEntry } from '../../types';
import Breadcrumbs from '../sftp/Breadcrumbs';
import FileEditor from '../sftp/FileEditor';
import { basename, formatBytes, formatDate, joinPath, looksLikeTextFile } from '../sftp/format';

const EDITOR_SIZE_LIMIT = 2 * 1024 * 1024;

function icon(entry: SftpEntry): string {
  if (entry.type === 'directory') return '📁';
  if (entry.type === 'symlink') return '🔗';
  return '📄';
}

export default function SftpManager() {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<{ path: string; content: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDir(dirPath);
      setEntries(res.entries);
      setCurrentPath(res.path);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh('/');
  }, [refresh]);

  const onDropFiles = useCallback(
    async (accepted: File[]) => {
      if (accepted.length === 0) return;
      try {
        await uploadFiles(currentPath, accepted);
        await refresh(currentPath);
      } catch (err: any) {
        setError(err?.response?.data?.error ?? 'Upload failed');
      }
    },
    [currentPath, refresh],
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
        setError(`"${entry.name}" is too large to edit (${formatBytes(entry.size)}). Download it instead.`);
        return;
      }
      if (!looksLikeTextFile(entry.name)) {
        setError(`"${entry.name}" doesn't look like a text file. Download it instead.`);
        return;
      }
      readFile(entry.path)
        .then((content) => setEditingFile({ path: entry.path, content }))
        .catch((err) => setError(err?.response?.data?.error ?? 'Failed to open file'));
    }
  }

  async function handleMkdir() {
    const name = window.prompt('New folder name:');
    if (!name) return;
    try {
      await mkdir(joinPath(currentPath, name));
      await refresh(currentPath);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to create folder');
    }
  }

  async function handleRename(entry: SftpEntry) {
    const name = window.prompt('Rename to:', entry.name);
    if (!name || name === entry.name) return;
    try {
      await renameItem(entry.path, joinPath(currentPath, name));
      await refresh(currentPath);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to rename');
    }
  }

  async function handleDelete(entry: SftpEntry) {
    if (!window.confirm(`Delete "${entry.name}"? This cannot be undone.`)) return;
    try {
      await deleteItem(entry.path);
      await refresh(currentPath);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to delete');
    }
  }

  async function handleDownload(entry: SftpEntry) {
    try {
      await downloadFile(entry.path, entry.name);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to download');
    }
  }

  async function handleMoveTo(targetDir: string) {
    if (!selected || selected === targetDir) return;
    const name = basename(selected);
    const dest = joinPath(targetDir, name);
    if (dest === selected) return;
    try {
      await moveItem(selected, dest);
      await refresh(currentPath);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to move item');
    } finally {
      setSelected(null);
      setDragOverPath(null);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs path={currentPath} onNavigate={refresh} onDropMove={handleMoveTo} />
        <div className="flex gap-2">
          <button
            onClick={handleMkdir}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
          >
            + New Folder
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

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-panel-danger/40 bg-panel-danger/10 px-3 py-2 text-sm text-panel-danger">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs underline">
            dismiss
          </button>
        </div>
      )}

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
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-panel-muted">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-panel-muted">
                  Empty directory
                </td>
              </tr>
            )}
            {!loading &&
              entries.map((entry) => (
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
                  }`}
                >
                  <td className="px-4 py-2">
                    <button onClick={() => openEntry(entry)} className="flex items-center gap-2 text-left">
                      <span>{icon(entry)}</span>
                      <span className="truncate text-panel-text">{entry.name}</span>
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
                          className="text-panel-muted hover:text-panel-accent"
                        >
                          Download
                        </button>
                      )}
                      <button onClick={() => handleRename(entry)} className="text-panel-muted hover:text-panel-accent">
                        Rename
                      </button>
                      <button onClick={() => handleDelete(entry)} className="text-panel-muted hover:text-panel-danger">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editingFile && (
        <FileEditor
          path={editingFile.path}
          initialContent={editingFile.content}
          onClose={() => setEditingFile(null)}
          onSave={async (content) => {
            await writeFile(editingFile.path, content);
          }}
        />
      )}
    </div>
  );
}
