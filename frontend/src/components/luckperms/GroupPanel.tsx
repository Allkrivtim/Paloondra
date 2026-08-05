import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getGroup, deleteGroup, addGroupNode, deleteGroupNodes, checkGroupPermission } from '../../api/luckperms';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { LuckPermsGroup, LuckPermsNewNode, LuckPermsNode } from '../../types';
import { recordNodes } from './knownKeys';
import PermissionsPanel from './PermissionsPanel';
import ParentsPanel from './ParentsPanel';
import ChatMetaPanel from './ChatMetaPanel';
import MetaPanel from './MetaPanel';
import GroupInfo from './GroupInfo';
import PermissionCheckPanel from './PermissionCheckPanel';
import Spinner from '../common/Spinner';

type SubTab = 'permissions' | 'parents' | 'chatmeta' | 'meta';

interface Props {
  name: string;
  allGroupNames: string[];
  onDeleted: () => void;
}

export default function GroupPanel({ name, allGroupNames, onDeleted }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();
  const [group, setGroup] = useState<LuckPermsGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<SubTab>('permissions');
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setGroup(await getGroup(name));
    } catch (err) {
      setLoadError(getErrorMessage(err, t('luckperms.failedToLoadGroup')));
    } finally {
      setLoading(false);
    }
  }, [name, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (group) recordNodes(group.nodes);
  }, [group]);

  async function handleAdd(node: LuckPermsNewNode) {
    setGroup(await addGroupNode(name, node));
  }

  async function handleRemove(node: LuckPermsNode) {
    setGroup(await deleteGroupNodes(name, [{ key: node.key, value: node.value, context: node.context, expiry: node.expiry }]));
  }

  async function handleDelete() {
    const confirmed = await dialog.confirm({
      title: t('luckperms.deleteGroupTitle', { name }),
      message: t('luckperms.deleteGroupMessage'),
      confirmLabel: t('luckperms.delete'),
      danger: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteGroup(name);
      toast.success(t('luckperms.groupDeletedToast', { name }));
      onDeleted();
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToDeleteGroup')));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
        <Spinner /> {t('luckperms.loading')}
      </div>
    );
  }
  if (loadError || !group) {
    return <p className="p-4 text-sm text-panel-danger">{loadError}</p>;
  }

  const TABS: { key: SubTab; label: string }[] = [
    { key: 'permissions', label: t('luckperms.tabPermissions') },
    { key: 'parents', label: t('luckperms.tabParents') },
    { key: 'chatmeta', label: t('luckperms.tabChatMeta') },
    { key: 'meta', label: t('luckperms.tabMeta') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-lg font-semibold text-panel-text">{group.name}</h2>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-danger hover:text-panel-danger disabled:opacity-50"
        >
          {deleting && <Spinner className="h-3 w-3" />}
          {t('luckperms.deleteGroup')}
        </button>
      </div>

      <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
        <GroupInfo nodes={group.nodes} onAdd={handleAdd} onRemove={handleRemove} />
      </div>

      <div className="rounded-xl border border-panel-border bg-panel-surface p-4">
        <h3 className="mb-2 text-sm font-semibold text-panel-text">{t('luckperms.testPermission')}</h3>
        <PermissionCheckPanel checkFn={(key) => checkGroupPermission(name, key)} />
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
        {tab === 'permissions' && <PermissionsPanel nodes={group.nodes} onAdd={handleAdd} onRemove={handleRemove} />}
        {tab === 'parents' && (
          <ParentsPanel nodes={group.nodes} allGroupNames={allGroupNames} excludeName={name} onAdd={handleAdd} onRemove={handleRemove} />
        )}
        {tab === 'chatmeta' && <ChatMetaPanel nodes={group.nodes} onAdd={handleAdd} onRemove={handleRemove} />}
        {tab === 'meta' && <MetaPanel nodes={group.nodes} onAdd={handleAdd} onRemove={handleRemove} />}
      </div>
    </div>
  );
}
