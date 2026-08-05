import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuckPermsNewNode, LuckPermsNode } from '../../types';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { buildPrefixSuffixKey, isChatMetaNode, parsePrefixSuffixKey } from './nodeFormat';
import NodeRow from './NodeRow';
import Spinner from '../common/Spinner';

interface Props {
  nodes: LuckPermsNode[];
  onAdd: (node: LuckPermsNewNode) => Promise<void>;
  onRemove: (node: LuckPermsNode) => Promise<void>;
}

/** Prefix and suffix are the same node "shape" (priority + text) so they share one panel/add-form, distinguished by a kind selector. Higher priority wins when a player is in more than one group granting one. */
export default function ChatMetaPanel({ nodes, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const chatMetaNodes = [...nodes.filter(isChatMetaNode)].sort((a, b) => {
    const pa = parsePrefixSuffixKey(a.key)?.priority ?? 0;
    const pb = parsePrefixSuffixKey(b.key)?.priority ?? 0;
    return pb - pa;
  });

  const [kind, setKind] = useState<'prefix' | 'suffix'>('prefix');
  const [priority, setPriority] = useState('100');
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const p = parseInt(priority, 10);
    if (Number.isNaN(p) || !text) return;
    setAdding(true);
    try {
      await onAdd({ key: buildPrefixSuffixKey(kind, p, text) });
      setText('');
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
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as 'prefix' | 'suffix')}
          className="rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
        >
          <option value="prefix">{t('luckperms.prefix')}</option>
          <option value="suffix">{t('luckperms.suffix')}</option>
        </select>
        <input
          type="number"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          title={t('luckperms.priorityLabel')}
          className="w-20 rounded-lg border border-panel-border bg-panel-surface2 px-2 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('luckperms.chatMetaTextPlaceholder')}
          className="min-w-[14rem] flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
        />
        <button
          type="submit"
          disabled={adding || !text}
          className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {adding && <Spinner className="h-3 w-3 text-black" />}
          {t('luckperms.add')}
        </button>
      </form>
      <p className="text-xs text-panel-muted">{t('luckperms.priorityHint')}</p>

      {chatMetaNodes.length === 0 ? (
        <p className="text-sm text-panel-muted">{t('luckperms.noChatMeta')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {chatMetaNodes.map((n, i) => {
            const parsed = parsePrefixSuffixKey(n.key);
            const label = parsed
              ? `[${n.type === 'prefix' ? t('luckperms.prefix') : t('luckperms.suffix')} ${parsed.priority}] ${parsed.text}`
              : n.key;
            return <NodeRow key={`${n.key}-${i}`} node={n} label={label} busy={removingKey === n.key} onRemove={() => handleRemove(n)} />;
          })}
        </div>
      )}
    </div>
  );
}
