import { useCallback, useEffect, useState } from 'react';
import { searchModrinth } from '../../api/modrinth';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { ModrinthSearchHit } from '../../types';
import Spinner from '../common/Spinner';
import PluginDetail from './PluginDetail';

const LOADERS = ['paper', 'spigot', 'bukkit', 'purpur', 'folia', 'velocity', 'bungeecord', 'waterfall'];
const CATEGORIES = [
  'admin-tools', 'chat', 'economy', 'equipment', 'food', 'game-mechanics',
  'library', 'magic', 'management', 'minigame', 'mobs', 'optimization',
  'social', 'storage', 'transportation', 'utility', 'world-generation',
];
const PAGE_SIZE = 20;

interface Props {
  onInstalled: () => void;
}

export default function PluginStore({ onInstalled }: Props) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [gameVersion, setGameVersion] = useState('');
  const [loader, setLoader] = useState('');
  const [category, setCategory] = useState('');
  const [hits, setHits] = useState<ModrinthSearchHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const search = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await searchModrinth({
          query: query.trim() || undefined,
          gameVersion: gameVersion.trim() || undefined,
          loader: loader || undefined,
          category: category || undefined,
          offset: nextOffset,
          limit: PAGE_SIZE,
        });
        setHits(res.hits);
        setTotalHits(res.total_hits);
        setOffset(res.offset);
      } catch (err) {
        setError(getErrorMessage(err, 'Modrinth search failed'));
        setHits([]);
      } finally {
        setLoading(false);
      }
    },
    [query, gameVersion, loader, category],
  );

  useEffect(() => {
    search(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    search(0);
  }

  if (selectedProjectId) {
    return (
      <PluginDetail
        projectId={selectedProjectId}
        activeGameVersion={gameVersion.trim() || undefined}
        activeLoader={loader || undefined}
        onBack={() => setSelectedProjectId(null)}
        onInstalled={() => {
          onInstalled();
          toast.success('Installed from Modrinth');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-panel-border bg-panel-surface p-4">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-panel-muted">Search</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. EssentialsX"
            className="rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-panel-muted">Game version</label>
          <input
            value={gameVersion}
            onChange={(e) => setGameVersion(e.target.value)}
            placeholder="1.20.1"
            className="w-28 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-panel-muted">Loader</label>
          <select
            value={loader}
            onChange={(e) => setLoader(e.target.value)}
            className="rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          >
            <option value="">Any</option>
            {LOADERS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-panel-muted">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
          >
            <option value="">Any</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-panel-accent2 px-4 py-2 text-sm font-medium text-black transition hover:bg-panel-accent"
        >
          Search
        </button>
      </form>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
          <Spinner /> Searching Modrinth...
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-3xl">⚠️</span>
          <p className="max-w-sm text-sm text-panel-danger">{error}</p>
          <button
            onClick={() => search(offset)}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && hits.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
          <span className="text-3xl">🔍</span>
          <p className="text-sm">No plugins found</p>
        </div>
      )}

      {!loading && !error && hits.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hits.map((hit) => (
              <button
                key={hit.project_id}
                onClick={() => setSelectedProjectId(hit.project_id)}
                className="flex flex-col gap-2 rounded-xl border border-panel-border bg-panel-surface p-4 text-left transition hover:border-panel-accent"
              >
                <div className="flex items-center gap-3">
                  {hit.icon_url ? (
                    <img src={hit.icon_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-panel-surface2 text-lg">
                      🧩
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-panel-text">{hit.title}</div>
                    <div className="truncate text-xs text-panel-muted">by {hit.author}</div>
                  </div>
                </div>
                <p className="line-clamp-2 text-xs text-panel-muted">{hit.description}</p>
                <div className="mt-auto flex items-center justify-between text-xs text-panel-muted">
                  <span>{hit.downloads.toLocaleString()} downloads</span>
                  <span className="truncate">{hit.versions.slice(-3).join(', ')}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-panel-muted">
            <span>
              {offset + 1}-{Math.min(offset + PAGE_SIZE, totalHits)} of {totalHits}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => search(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="rounded-lg border border-panel-border px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => search(offset + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= totalHits}
                className="rounded-lg border border-panel-border px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
