import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuckPermsContext } from '../../types';

/** Read-only chip display for a node's context - existing nodes don't have their context edited in place (LuckPerms treats a different context as a different node entirely; remove and re-add via the add-form to change it). */
export function ContextChips({ context }: { context: LuckPermsContext[] }) {
  if (context.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {context.map((c, i) => (
        <span
          key={i}
          className="rounded bg-panel-surface2 px-1.5 py-0.5 font-mono text-[11px] text-panel-muted"
          title={`${c.key}=${c.value}`}
        >
          {c.key}={c.value}
        </span>
      ))}
    </span>
  );
}

/** Editable context list for the add-node forms - "server=survival" style key=value pairs. */
export function ContextInput({ value, onChange }: { value: LuckPermsContext[]; onChange: (next: LuckPermsContext[]) => void }) {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [val, setVal] = useState('');

  function add() {
    if (!key.trim() || !val.trim()) return;
    onChange([...value, { key: key.trim(), value: val.trim() }]);
    setKey('');
    setVal('');
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((c, i) => (
        <span key={i} className="flex items-center gap-1 rounded bg-panel-surface2 px-1.5 py-0.5 font-mono text-[11px] text-panel-text">
          {c.key}={c.value}
          <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-panel-muted hover:text-panel-danger">
            &times;
          </button>
        </span>
      ))}
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={t('luckperms.contextKeyPlaceholder')}
        className="w-24 rounded border border-panel-border bg-panel-surface2 px-1.5 py-0.5 text-[11px] text-panel-text outline-none focus:border-panel-accent"
      />
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={t('luckperms.contextValuePlaceholder')}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        className="w-24 rounded border border-panel-border bg-panel-surface2 px-1.5 py-0.5 text-[11px] text-panel-text outline-none focus:border-panel-accent"
      />
      <button
        type="button"
        onClick={add}
        disabled={!key.trim() || !val.trim()}
        className="rounded border border-panel-border px-1.5 py-0.5 text-[11px] text-panel-muted transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-50"
      >
        {t('luckperms.addContext')}
      </button>
    </div>
  );
}
