import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuckPermsNewNode, LuckPermsNode } from '../../types';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { buildMetaKey, isMetaNode, parseMetaKey } from './nodeFormat';
import { getKnownMetaKeys } from './knownKeys';
import NodeRow from './NodeRow';
import Spinner from '../common/Spinner';

interface Props {
  nodes: LuckPermsNode[];
  onAdd: (node: LuckPermsNewNode) => Promise<void>;
  onRemove: (node: LuckPermsNode) => Promise<void>;
}

export default function MetaPanel({ nodes, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const metaNodes = nodes.filter(isMetaNode);

  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim() || !value) return;
    setAdding(true);
    try {
      await onAdd({ key: buildMetaKey(key.trim(), value) });
      setKey('');
      setValue('');
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
      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('luckperms.metaKeyPlaceholder')}
          list="lp-known-meta-keys"
          className="w-40 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
        />
        <datalist id="lp-known-meta-keys">
          {getKnownMetaKeys().map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('luckperms.metaValuePlaceholder')}
          className="min-w-[12rem] flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
        />
        <button
          type="submit"
          disabled={adding || !key.trim() || !value}
          className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {adding && <Spinner className="h-3 w-3 text-black" />}
          {t('luckperms.add')}
        </button>
      </form>

      {metaNodes.length === 0 ? (
        <p className="text-sm text-panel-muted">{t('luckperms.noMeta')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {metaNodes.map((n, i) => {
            const parsed = parseMetaKey(n.key);
            const label = parsed ? `${parsed.metaKey} = ${parsed.metaValue}` : n.key;
            return <NodeRow key={`${n.key}-${i}`} node={n} label={label} busy={removingKey === n.key} onRemove={() => handleRemove(n)} />;
          })}
        </div>
      )}
    </div>
  );
}
