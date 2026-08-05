import { useTranslation } from 'react-i18next';
import { LuckPermsNode } from '../../types';
import { formatExpiry, isExpired } from './nodeFormat';
import { ContextChips } from './ContextEditor';
import Spinner from '../common/Spinner';

interface Props {
  node: LuckPermsNode;
  /** How to render the node's identity - a permission string, a group name, "prefix (100)", "rank = vip", etc. */
  label: string;
  busy: boolean;
  onRemove: () => void;
}

export default function NodeRow({ node, label, busy, onRemove }: Props) {
  const { t } = useTranslation();
  const expiry = formatExpiry(node.expiry);
  const expired = isExpired(node.expiry);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel-surface2 px-3 py-2 text-sm ${busy ? 'opacity-50' : ''}`}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
            node.value ? 'bg-panel-accent2/20 text-panel-accent' : 'bg-panel-danger/20 text-panel-danger'
          }`}
        >
          {node.value ? t('luckperms.valueTrue') : t('luckperms.valueFalse')}
        </span>
        <span className="truncate font-mono text-panel-text">{label}</span>
        <ContextChips context={node.context} />
        {expiry && (
          <span className={`text-[11px] ${expired ? 'text-panel-danger' : 'text-panel-muted'}`}>
            {expired ? t('luckperms.expired', { date: expiry }) : t('luckperms.expires', { date: expiry })}
          </span>
        )}
      </div>
      <button
        onClick={onRemove}
        disabled={busy}
        className="flex shrink-0 items-center gap-1 text-xs text-panel-muted transition hover:text-panel-danger disabled:opacity-50"
      >
        {busy && <Spinner className="h-3 w-3" />}
        {t('luckperms.remove')}
      </button>
    </div>
  );
}
