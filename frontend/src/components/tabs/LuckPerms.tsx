import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getHealth, listGroups, listTracks, createGroup, createTrack, getGroup } from '../../api/luckperms';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import EntitySidebar, { Selection } from '../luckperms/EntitySidebar';
import GroupPanel from '../luckperms/GroupPanel';
import TrackPanel from '../luckperms/TrackPanel';
import UserPanel from '../luckperms/UserPanel';
import SearchPanel from '../luckperms/SearchPanel';
import UsersBrowserPanel from '../luckperms/UsersBrowserPanel';
import { recordNodes } from '../luckperms/knownKeys';
import Spinner from '../common/Spinner';

type HealthState = { configured: boolean; ok: boolean } | null;

export default function LuckPerms() {
  const { t } = useTranslation();
  const toast = useToast();
  const [health, setHealth] = useState<HealthState>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [trackNames, setTrackNames] = useState<string[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const seededKnownKeys = useRef(false);

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      setHealth(await getHealth());
    } catch {
      setHealth({ configured: true, ok: false });
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  const refreshLists = useCallback(async () => {
    setListsLoading(true);
    setListsError(null);
    try {
      const [groups, tracks] = await Promise.all([listGroups(), listTracks()]);
      setGroupNames(groups);
      setTrackNames(tracks);
    } catch (err) {
      setListsError(getErrorMessage(err, t('luckperms.failedToLoadLists')));
    } finally {
      setListsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    if (health?.configured && health.ok) refreshLists();
  }, [health, refreshLists]);

  // Seeds the Permissions/Meta add-forms' autocomplete (see knownKeys.ts)
  // from every group's own node list the moment the tab opens, so there's
  // something useful to suggest even before browsing anything - groups are
  // where most permissions actually get defined. Fire-and-forget, once per
  // session; a group that errors just doesn't contribute, doesn't block
  // the rest.
  useEffect(() => {
    if (seededKnownKeys.current || groupNames.length === 0) return;
    seededKnownKeys.current = true;
    Promise.allSettled(groupNames.map((name) => getGroup(name))).then((results) => {
      for (const result of results) {
        if (result.status === 'fulfilled') recordNodes(result.value.nodes);
      }
    });
  }, [groupNames]);

  async function handleCreateGroup(name: string) {
    if (!name) return;
    try {
      await createGroup(name);
      toast.success(t('luckperms.groupCreatedToast', { name }));
      await refreshLists();
      setSelected({ kind: 'group', name });
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToCreateGroup')));
    }
  }

  async function handleCreateTrack(name: string) {
    if (!name) return;
    try {
      await createTrack(name);
      toast.success(t('luckperms.trackCreatedToast', { name }));
      await refreshLists();
      setSelected({ kind: 'track', name });
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToCreateTrack')));
    }
  }

  function handleGroupDeleted() {
    setSelected(null);
    refreshLists();
  }

  function handleTrackDeleted() {
    setSelected(null);
    refreshLists();
  }

  if (checkingHealth) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-panel-muted">
        <Spinner /> {t('luckperms.loading')}
      </div>
    );
  }

  if (!health?.configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-panel-muted">
        <span className="text-3xl">🔒</span>
        <p className="text-sm font-medium text-panel-text">{t('luckperms.notConfiguredTitle')}</p>
        <p className="max-w-md text-xs">{t('luckperms.notConfiguredHint')}</p>
      </div>
    );
  }

  if (!health.ok) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-panel-muted">
        <span className="text-3xl">⚠️</span>
        <p className="text-sm font-medium text-panel-text">{t('luckperms.unreachableTitle')}</p>
        <p className="max-w-md text-xs">{t('luckperms.unreachableHint')}</p>
        <button
          onClick={checkHealth}
          className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-accent hover:text-panel-accent"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4 p-4 sm:p-6">
      {listsLoading && groupNames.length === 0 && trackNames.length === 0 ? (
        <div className="flex w-64 shrink-0 items-center justify-center gap-2 text-panel-muted">
          <Spinner />
        </div>
      ) : listsError ? (
        <div className="flex w-64 shrink-0 flex-col items-center gap-2 p-4 text-center text-xs text-panel-danger">
          <p>{listsError}</p>
          <button onClick={refreshLists} className="text-panel-muted underline hover:text-panel-accent">
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <EntitySidebar
          groupNames={groupNames}
          trackNames={trackNames}
          selected={selected}
          onSelect={setSelected}
          onCreateGroup={handleCreateGroup}
          onCreateTrack={handleCreateTrack}
        />
      )}

      <div className="min-w-0 flex-1 overflow-auto">
        {!selected && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-panel-muted">
            <span className="text-3xl">🔑</span>
            <p className="text-sm">{t('luckperms.emptySelectionHint')}</p>
          </div>
        )}
        {selected?.kind === 'search' && (
          <SearchPanel
            onSelectUser={(uniqueId) => setSelected({ kind: 'user', uniqueId })}
            onSelectGroup={(name) => setSelected({ kind: 'group', name })}
          />
        )}
        {selected?.kind === 'browse-users' && (
          <UsersBrowserPanel onSelectUser={(uniqueId, username) => setSelected({ kind: 'user', uniqueId, username })} />
        )}
        {selected?.kind === 'group' && <GroupPanel key={selected.name} name={selected.name} allGroupNames={groupNames} onDeleted={handleGroupDeleted} />}
        {selected?.kind === 'track' && <TrackPanel key={selected.name} name={selected.name} allGroupNames={groupNames} onDeleted={handleTrackDeleted} />}
        {selected?.kind === 'user' && (
          <UserPanel key={selected.uniqueId} uniqueId={selected.uniqueId} username={selected.username} allGroupNames={groupNames} allTrackNames={trackNames} />
        )}
      </div>
    </div>
  );
}
