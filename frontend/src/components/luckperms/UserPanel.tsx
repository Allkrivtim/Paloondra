import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getUser, addUserNode, deleteUserNodes, checkUserPermission, promoteUser, demoteUser } from '../../api/luckperms';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { LuckPermsNewNode, LuckPermsNode, LuckPermsUser } from '../../types';
import { recordNodes } from './knownKeys';
import PermissionsPanel from './PermissionsPanel';
import ParentsPanel from './ParentsPanel';
import ChatMetaPanel from './ChatMetaPanel';
import MetaPanel from './MetaPanel';
import PermissionCheckPanel from './PermissionCheckPanel';
import Spinner from '../common/Spinner';

type SubTab = 'permissions' | 'parents' | 'chatmeta' | 'meta';

interface Props {
  uniqueId: string;
  /** Optional - a search result only carries a uniqueId (see SearchPanel); the real username comes from GET /user/:uniqueId once it loads. */
  username?: string;
  allGroupNames: string[];
  allTrackNames: string[];
}

export default function UserPanel({ uniqueId, username, allGroupNames, allTrackNames }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [user, setUser] = useState<LuckPermsUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<SubTab>('permissions');
  const [selectedTrack, setSelectedTrack] = useState('');
  const [trackBusy, setTrackBusy] = useState<'promote' | 'demote' | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUser(await getUser(uniqueId));
    } catch (err) {
      setLoadError(getErrorMessage(err, t('luckperms.failedToLoadUser')));
    } finally {
      setLoading(false);
    }
  }, [uniqueId, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (user) recordNodes(user.nodes);
  }, [user]);

  async function handleAdd(node: LuckPermsNewNode) {
    setUser(await addUserNode(uniqueId, node));
  }

  async function handleRemove(node: LuckPermsNode) {
    setUser(await deleteUserNodes(uniqueId, [{ key: node.key, value: node.value, context: node.context, expiry: node.expiry }]));
  }

  async function handleTrackMove(direction: 'promote' | 'demote') {
    if (!selectedTrack) return;
    setTrackBusy(direction);
    try {
      const updated = direction === 'promote' ? await promoteUser(uniqueId, selectedTrack) : await demoteUser(uniqueId, selectedTrack);
      setUser(updated);
      toast.success(
        direction === 'promote'
          ? t('luckperms.promotedToast', { username: updated.username ?? username ?? uniqueId })
          : t('luckperms.demotedToast', { username: updated.username ?? username ?? uniqueId }),
      );
    } catch (err) {
      toast.error(getErrorMessage(err, direction === 'promote' ? t('luckperms.failedToPromote') : t('luckperms.failedToDemote')));
    } finally {
      setTrackBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
        <Spinner /> {t('luckperms.loading')}
      </div>
    );
  }
  if (loadError || !user) {
    return <p className="p-4 text-sm text-panel-danger">{loadError}</p>;
  }

  // The real username, once known - always available by this point (the
  // load above succeeded), the `username` prop is only a fallback for
  // whatever brief moment it isn't.
  const displayName = user.username ?? username ?? uniqueId;

  const TABS: { key: SubTab; label: string }[] = [
    { key: 'permissions', label: t('luckperms.tabPermissions') },
    { key: 'parents', label: t('luckperms.tabParents') },
    { key: 'chatmeta', label: t('luckperms.tabChatMeta') },
    { key: 'meta', label: t('luckperms.tabMeta') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-mono text-lg font-semibold text-panel-text">{displayName}</h2>
        <p className="font-mono text-xs text-panel-muted">{user.uniqueId}</p>
        {user.metadata.primaryGroup && (
          <p className="mt-1 text-xs text-panel-muted">
            {t('luckperms.primaryGroup')}: <span className="font-mono text-panel-text">{user.metadata.primaryGroup}</span>
          </p>
        )}
      </div>

      {allTrackNames.length > 0 && (
        <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-panel-text">{t('luckperms.trackAction')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
              className="min-w-[10rem] rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
            >
              <option value="">{t('luckperms.selectTrackPlaceholder')}</option>
              {allTrackNames.map((tr) => (
                <option key={tr} value={tr}>
                  {tr}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleTrackMove('promote')}
              disabled={!selectedTrack || trackBusy !== null}
              className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
            >
              {trackBusy === 'promote' && <Spinner className="h-3 w-3 text-black" />}
              {t('luckperms.promote')}
            </button>
            <button
              onClick={() => handleTrackMove('demote')}
              disabled={!selectedTrack || trackBusy !== null}
              className="flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-danger hover:text-panel-danger disabled:opacity-50"
            >
              {trackBusy === 'demote' && <Spinner className="h-3 w-3" />}
              {t('luckperms.demote')}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
        <h3 className="mb-2 text-sm font-semibold text-panel-text">{t('luckperms.testPermission')}</h3>
        <PermissionCheckPanel checkFn={(key) => checkUserPermission(uniqueId, key)} />
      </div>

      <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
        <div className="mb-3 flex gap-1 border-b border-panel-border">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`px-3 py-2 text-sm font-medium transition ${
                tab === tb.key ? 'border-b-2 border-panel-accent text-panel-accent' : 'text-panel-muted hover:text-panel-text'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
        {tab === 'permissions' && <PermissionsPanel nodes={user.nodes} onAdd={handleAdd} onRemove={handleRemove} />}
        {tab === 'parents' && <ParentsPanel nodes={user.nodes} allGroupNames={allGroupNames} onAdd={handleAdd} onRemove={handleRemove} />}
        {tab === 'chatmeta' && <ChatMetaPanel nodes={user.nodes} onAdd={handleAdd} onRemove={handleRemove} />}
        {tab === 'meta' && <MetaPanel nodes={user.nodes} onAdd={handleAdd} onRemove={handleRemove} />}
      </div>
    </div>
  );
}
