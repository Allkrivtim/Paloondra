import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuckPermsNewNode, LuckPermsNode } from '../../types';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { buildInheritanceKey, isParentNode, parseInheritanceKey } from './nodeFormat';
import NodeRow from './NodeRow';
import Spinner from '../common/Spinner';

interface Props {
  nodes: LuckPermsNode[];
  /** Every group name known to the server, so the add-form can offer a dropdown instead of freeform typing (a mistyped group name here would silently create a "parent" that no group actually has). */
  allGroupNames: string[];
  /** Excluded from the dropdown when editing a group's own parents - a group can't inherit from itself. */
  excludeName?: string;
  onAdd: (node: LuckPermsNewNode) => Promise<void>;
  onRemove: (node: LuckPermsNode) => Promise<void>;
}

export default function ParentsPanel({ nodes, allGroupNames, excludeName, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const parentNodes = nodes.filter(isParentNode);
  const currentParents = new Set(parentNodes.map((n) => parseInheritanceKey(n.key)).filter((g): g is string => !!g));
  const available = allGroupNames.filter((g) => g !== excludeName && !currentParents.has(g));

  const [selected, setSelected] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  async function handleAdd() {
    if (!selected) return;
    setAdding(true);
    try {
      await onAdd({ key: buildInheritanceKey(selected) });
      setSelected('');
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToAddParent')));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(node: LuckPermsNode) {
    setRemovingKey(node.key);
    try {
      await onRemove(node);
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToRemoveParent')));
    } finally {
      setRemovingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="min-w-[12rem] rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
        >
          <option value="">{t('luckperms.selectGroupPlaceholder')}</option>
          {available.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={adding || !selected}
          className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {adding && <Spinner className="h-3 w-3 text-black" />}
          {t('luckperms.addParent')}
        </button>
      </div>

      {parentNodes.length === 0 ? (
        <p className="text-sm text-panel-muted">{t('luckperms.noParents')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {parentNodes.map((n, i) => (
            <NodeRow
              key={`${n.key}-${i}`}
              node={n}
              label={parseInheritanceKey(n.key) ?? n.key}
              busy={removingKey === n.key}
              onRemove={() => handleRemove(n)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
