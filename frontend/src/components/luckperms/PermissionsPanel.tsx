import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuckPermsContext, LuckPermsNewNode, LuckPermsNode } from '../../types';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { isPermissionNode, datetimeLocalToExpiry } from './nodeFormat';
import { getKnownPermissionKeys } from './knownKeys';
import { ContextInput } from './ContextEditor';
import NodeRow from './NodeRow';
import Spinner from '../common/Spinner';

interface Props {
  nodes: LuckPermsNode[];
  onAdd: (node: LuckPermsNewNode) => Promise<void>;
  onRemove: (node: LuckPermsNode) => Promise<void>;
}

export default function PermissionsPanel({ nodes, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const permissionNodes = nodes.filter(isPermissionNode);

  const [key, setKey] = useState('');
  const [value, setValue] = useState(true);
  const [context, setContext] = useState<LuckPermsContext[]>([]);
  const [expiry, setExpiry] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setAdding(true);
    try {
      await onAdd({ key: key.trim(), value, context: context.length ? context : undefined, expiry: datetimeLocalToExpiry(expiry) });
      setKey('');
      setValue(true);
      setContext([]);
      setExpiry('');
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToAddNode')));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(node: LuckPermsNode) {
    setRemovingKey(node.key);
    try {
      await onRemove(node);
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToRemoveNode')));
    } finally {
      setRemovingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('luckperms.permissionKeyPlaceholder')}
            list="lp-known-permission-keys"
            className="min-w-[16rem] flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
          />
          {/* Suggestions from whatever this session has actually seen so far, not LuckPerms' own registry - see knownKeys.ts. */}
          <datalist id="lp-known-permission-keys">
            {getKnownPermissionKeys().map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <label className="flex items-center gap-1.5 text-sm text-panel-text">
            <input type="checkbox" checked={value} onChange={(e) => setValue(e.target.checked)} className="h-4 w-4 accent-panel-accent2" />
            {t('luckperms.valueTrue')}
          </label>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs text-panel-muted hover:text-panel-accent"
          >
            {showAdvanced ? t('luckperms.hideAdvanced') : t('luckperms.showAdvanced')}
          </button>
          <button
            type="submit"
            disabled={adding || !key.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {adding && <Spinner className="h-3 w-3 text-black" />}
            {t('luckperms.addPermission')}
          </button>
        </div>
        {showAdvanced && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-panel-surface2 p-2">
            <ContextInput value={context} onChange={setContext} />
            <label className="flex items-center gap-1.5 text-xs text-panel-muted">
              {t('luckperms.expiryLabel')}
              <input
                type="datetime-local"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="rounded border border-panel-border bg-panel-surface px-1.5 py-0.5 text-xs text-panel-text outline-none focus:border-panel-accent"
              />
            </label>
          </div>
        )}
      </form>

      {permissionNodes.length === 0 ? (
        <p className="text-sm text-panel-muted">{t('luckperms.noPermissions')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {permissionNodes.map((n, i) => (
            <NodeRow key={`${n.key}-${i}`} node={n} label={n.key} busy={removingKey === n.key} onRemove={() => handleRemove(n)} />
          ))}
        </div>
      )}
    </div>
  );
}
