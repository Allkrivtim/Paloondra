import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchUsers, searchGroups } from '../../api/luckperms';
import { getErrorMessage } from '../../api/errors';
import { LuckPermsGroupSearchResult, LuckPermsSearchNodeType, LuckPermsUserSearchResult } from '../../types';
import { describeNode } from './nodeFormat';
import { ContextChips } from './ContextEditor';
import Spinner from '../common/Spinner';

const SEARCH_TYPES: LuckPermsSearchNodeType[] = ['inheritance', 'prefix', 'suffix', 'meta', 'weight', 'display_name', 'regex_permission'];

interface Props {
  onSelectUser: (uniqueId: string) => void;
  onSelectGroup: (name: string) => void;
}

/**
 * "Who has this?" - the REST API's own cross-cutting search (GET /user/search,
 * /group/search), not a client-side scan of already-loaded entities. This is
 * the counterpart to each entity panel's node list: those answer "what does
 * X have", this answers "who has X" - together, the same two directions the
 * official LuckPerms web editor's search indexes.
 */
export default function SearchPanel({ onSelectUser, onSelectGroup }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<LuckPermsSearchNodeType | ''>('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [userResults, setUserResults] = useState<LuckPermsUserSearchResult[]>([]);
  const [groupResults, setGroupResults] = useState<LuckPermsGroupSearchResult[]>([]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const params = { keyStartsWith: query.trim(), type: type || undefined };
      const [users, groups] = await Promise.all([searchUsers(params), searchGroups(params)]);
      setUserResults(users);
      setGroupResults(groups);
      setHasSearched(true);
    } catch (err) {
      setError(getErrorMessage(err, t('luckperms.searchFailed')));
    } finally {
      setSearching(false);
    }
  }

  const noResults = hasSearched && !error && userResults.length === 0 && groupResults.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-panel-text">{t('luckperms.searchTitle')}</h2>
        <p className="mt-1 text-xs text-panel-muted">{t('luckperms.searchHint')}</p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2 rounded-xl border border-panel-border bg-panel-surface p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('luckperms.searchQueryPlaceholder')}
          className="min-w-[16rem] flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as LuckPermsSearchNodeType | '')}
          className="rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
        >
          <option value="">{t('luckperms.searchTypeAny')}</option>
          {SEARCH_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`luckperms.searchType.${ty}`)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {searching && <Spinner className="h-3 w-3 text-black" />}
          {t('luckperms.search')}
        </button>
      </form>

      {error && <p className="text-sm text-panel-danger">{error}</p>}
      {noResults && <p className="text-sm text-panel-muted">{t('luckperms.searchNoResults')}</p>}

      {userResults.length > 0 && (
        <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-panel-text">
            {t('luckperms.searchUsersHeading', { count: userResults.length })}
          </h3>
          <div className="flex flex-col gap-2">
            {userResults.map((r) => (
              <div key={r.uniqueId} className="rounded-lg bg-panel-surface2 p-2.5">
                <button
                  onClick={() => onSelectUser(r.uniqueId)}
                  className="mb-1.5 font-mono text-sm text-panel-accent hover:underline"
                >
                  {r.uniqueId}
                </button>
                <div className="flex flex-col gap-1">
                  {r.results.map((n, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-xs text-panel-muted">
                      <span className="font-mono text-panel-text">{describeNode(n)}</span>
                      <ContextChips context={n.context} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {groupResults.length > 0 && (
        <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-panel-text">
            {t('luckperms.searchGroupsHeading', { count: groupResults.length })}
          </h3>
          <div className="flex flex-col gap-2">
            {groupResults.map((r) => (
              <div key={r.name} className="rounded-lg bg-panel-surface2 p-2.5">
                <button onClick={() => onSelectGroup(r.name)} className="mb-1.5 font-mono text-sm text-panel-accent hover:underline">
                  {r.name}
                </button>
                <div className="flex flex-col gap-1">
                  {r.results.map((n, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-xs text-panel-muted">
                      <span className="font-mono text-panel-text">{describeNode(n)}</span>
                      <ContextChips context={n.context} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
