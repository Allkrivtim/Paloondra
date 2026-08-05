import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lookupUser } from '../../api/luckperms';
import { getErrorMessage } from '../../api/errors';
import { useDialog } from '../../context/DialogContext';
import Spinner from '../common/Spinner';

export type Selection = { kind: 'group'; name: string } | { kind: 'track'; name: string } | { kind: 'user'; uniqueId: string; username: string };

interface Props {
  groupNames: string[];
  trackNames: string[];
  selected: Selection | null;
  onSelect: (s: Selection) => void;
  onCreateGroup: (name: string) => Promise<void>;
  onCreateTrack: (name: string) => Promise<void>;
}

export default function EntitySidebar({ groupNames, trackNames, selected, onSelect, onCreateGroup, onCreateTrack }: Props) {
  const { t } = useTranslation();
  const dialog = useDialog();
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Session-local only - there's no "list all users" worth showing (the
  // REST API's GET /user returns bare UUIDs with no usernames), so recent
  // lookups are the closest thing to a browsable user list.
  const [recentUsers, setRecentUsers] = useState<{ uniqueId: string; username: string }[]>([]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const name = searchInput.trim();
    if (!name) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await lookupUser({ username: name });
      if (!found) {
        setSearchError(t('luckperms.userNotFound', { name }));
        return;
      }
      setRecentUsers((prev) => [found, ...prev.filter((u) => u.uniqueId !== found.uniqueId)].slice(0, 8));
      onSelect({ kind: 'user', uniqueId: found.uniqueId, username: found.username });
      setSearchInput('');
    } catch (err) {
      setSearchError(getErrorMessage(err, t('luckperms.userLookupFailed')));
    } finally {
      setSearching(false);
    }
  }

  async function handleCreateGroup() {
    const name = await dialog.prompt({ title: t('luckperms.newGroupTitle'), placeholder: t('luckperms.groupNamePlaceholder'), confirmLabel: t('common.create') });
    if (name) await onCreateGroup(name.trim());
  }

  async function handleCreateTrack() {
    const name = await dialog.prompt({ title: t('luckperms.newTrackTitle'), placeholder: t('luckperms.trackNamePlaceholder'), confirmLabel: t('common.create') });
    if (name) await onCreateTrack(name.trim());
  }

  return (
    <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto">
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-panel-muted">{t('luckperms.groups')}</h3>
          <button onClick={handleCreateGroup} className="text-xs text-panel-muted hover:text-panel-accent">
            + {t('luckperms.newGroup')}
          </button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {groupNames.map((g) => (
            <li key={g}>
              <button
                onClick={() => onSelect({ kind: 'group', name: g })}
                className={`w-full truncate rounded-lg px-2 py-1.5 text-left font-mono text-sm transition ${
                  selected?.kind === 'group' && selected.name === g ? 'bg-panel-accent2/20 text-panel-accent' : 'text-panel-text hover:bg-panel-surface2'
                }`}
              >
                {g}
              </button>
            </li>
          ))}
          {groupNames.length === 0 && <li className="px-2 py-1 text-xs text-panel-muted">{t('luckperms.noGroupsYet')}</li>}
        </ul>
      </section>

      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-panel-muted">{t('luckperms.tracks')}</h3>
          <button onClick={handleCreateTrack} className="text-xs text-panel-muted hover:text-panel-accent">
            + {t('luckperms.newTrack')}
          </button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {trackNames.map((tr) => (
            <li key={tr}>
              <button
                onClick={() => onSelect({ kind: 'track', name: tr })}
                className={`w-full truncate rounded-lg px-2 py-1.5 text-left font-mono text-sm transition ${
                  selected?.kind === 'track' && selected.name === tr ? 'bg-panel-accent2/20 text-panel-accent' : 'text-panel-text hover:bg-panel-surface2'
                }`}
              >
                {tr}
              </button>
            </li>
          ))}
          {trackNames.length === 0 && <li className="px-2 py-1 text-xs text-panel-muted">{t('luckperms.noTracksYet')}</li>}
        </ul>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-panel-muted">{t('luckperms.users')}</h3>
        <form onSubmit={handleSearch} className="flex gap-1">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('luckperms.userSearchPlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
          <button
            type="submit"
            disabled={searching || !searchInput.trim()}
            className="flex shrink-0 items-center rounded-lg border border-panel-border px-2 py-1.5 text-xs text-panel-text transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50"
          >
            {searching ? <Spinner className="h-3 w-3" /> : t('luckperms.search')}
          </button>
        </form>
        {searchError && <p className="mt-1 text-xs text-panel-danger">{searchError}</p>}
        {recentUsers.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {recentUsers.map((u) => (
              <li key={u.uniqueId}>
                <button
                  onClick={() => onSelect({ kind: 'user', uniqueId: u.uniqueId, username: u.username })}
                  className={`w-full truncate rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    selected?.kind === 'user' && selected.uniqueId === u.uniqueId
                      ? 'bg-panel-accent2/20 text-panel-accent'
                      : 'text-panel-text hover:bg-panel-surface2'
                  }`}
                >
                  {u.username}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
