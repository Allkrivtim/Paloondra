import { useEffect, useState } from 'react';
import { getModrinthProject, getModrinthVersions, installFromModrinth } from '../../api/modrinth';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { ModrinthProject, ModrinthVersion } from '../../types';
import Spinner from '../common/Spinner';

interface Props {
  projectId: string;
  activeGameVersion?: string;
  activeLoader?: string;
  onBack: () => void;
  onInstalled: () => void;
}

export default function PluginDetail({ projectId, activeGameVersion, activeLoader, onBack, onInstalled }: Props) {
  const toast = useToast();
  const dialog = useDialog();
  const [project, setProject] = useState<ModrinthProject | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getModrinthProject(projectId), getModrinthVersions(projectId)])
      .then(([p, v]) => {
        if (cancelled) return;
        setProject(p);
        setVersions(v);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Failed to load plugin details'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleInstall(version: ModrinthVersion) {
    const file = version.files.find((f) => f.primary) ?? version.files[0];
    if (!file) {
      toast.error(`Version ${version.version_number} has no downloadable file`);
      return;
    }

    const mismatches: string[] = [];
    if (activeGameVersion && !version.game_versions.includes(activeGameVersion)) {
      mismatches.push(`doesn't list game version ${activeGameVersion}`);
    }
    if (activeLoader && !version.loaders.includes(activeLoader)) {
      mismatches.push(`doesn't list loader "${activeLoader}"`);
    }
    if (mismatches.length > 0) {
      const confirmed = await dialog.confirm({
        title: 'Version may not be compatible',
        message: `This version ${mismatches.join(' and ')}. Install anyway?`,
        confirmLabel: 'Install anyway',
        danger: true,
      });
      if (!confirmed) return;
    }

    setInstallingVersionId(version.id);
    try {
      await installFromModrinth(file.url, project?.title ?? projectId, version.version_number);
      onInstalled();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to install plugin'));
    } finally {
      setInstallingVersionId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="w-fit text-sm text-panel-muted hover:text-panel-text">
        ← Back to search
      </button>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
          <Spinner /> Loading...
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-3xl">⚠️</span>
          <p className="max-w-sm text-sm text-panel-danger">{error}</p>
        </div>
      )}

      {!loading && !error && project && (
        <>
          <div className="flex items-start gap-4 rounded-xl border border-panel-border bg-panel-surface p-4">
            {project.icon_url ? (
              <img src={project.icon_url} alt="" className="h-16 w-16 flex-shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-panel-surface2 text-2xl">
                🧩
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-panel-text">{project.title}</h2>
              <p className="mt-1 text-sm text-panel-muted">{project.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-panel-muted">
                <span>{project.downloads.toLocaleString()} downloads</span>
                <span>·</span>
                <span>{project.followers.toLocaleString()} followers</span>
                {project.categories.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{project.categories.join(', ')}</span>
                  </>
                )}
              </div>
              <div className="mt-2 flex gap-3 text-xs">
                {project.source_url && (
                  <a href={project.source_url} target="_blank" rel="noreferrer" className="text-panel-accent hover:underline">
                    Source
                  </a>
                )}
                {project.issues_url && (
                  <a href={project.issues_url} target="_blank" rel="noreferrer" className="text-panel-accent hover:underline">
                    Issues
                  </a>
                )}
                {project.wiki_url && (
                  <a href={project.wiki_url} target="_blank" rel="noreferrer" className="text-panel-accent hover:underline">
                    Wiki
                  </a>
                )}
              </div>
            </div>
          </div>

          {project.body && (
            <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-panel-border bg-panel-surface p-4 text-sm text-panel-muted">
              {project.body}
            </div>
          )}

          <div className="rounded-xl border border-panel-border bg-panel-surface">
            <div className="border-b border-panel-border px-4 py-3 text-sm font-semibold text-panel-text">
              Versions
            </div>
            {versions.length === 0 && <div className="p-4 text-sm text-panel-muted">No versions published.</div>}
            <div className="divide-y divide-panel-border">
              {versions.map((version) => {
                const installing = installingVersionId === version.id;
                const mismatch =
                  (activeGameVersion && !version.game_versions.includes(activeGameVersion)) ||
                  (activeLoader && !version.loaders.includes(activeLoader));
                return (
                  <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm text-panel-text">
                        <span className="font-medium">{version.version_number}</span>
                        <span className="text-xs text-panel-muted">{version.name}</span>
                        {mismatch && (
                          <span className="rounded-full bg-panel-warn/10 px-2 py-0.5 text-xs text-panel-warn">
                            possible mismatch
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1 text-xs text-panel-muted">
                        <span>{version.loaders.join(', ') || 'any loader'}</span>
                        <span>·</span>
                        <span className="truncate">{version.game_versions.slice(-4).join(', ')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleInstall(version)}
                      disabled={installingVersionId !== null}
                      className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
                    >
                      {installing && <Spinner className="h-3 w-3 text-black" />}
                      {installing ? 'Installing...' : 'Install'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
