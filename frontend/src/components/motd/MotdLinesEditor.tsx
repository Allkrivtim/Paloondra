import { useTranslation } from 'react-i18next';

interface Props {
  lines: string[];
  onChange: (lines: string[]) => void;
  addLabel: string;
  linePlaceholder?: string;
}

/** Add/remove/reorder/edit editor for a list of MOTD/hover-text lines (each a raw MiniMessage string). */
export default function MotdLinesEditor({ lines, onChange, addLabel, linePlaceholder }: Props) {
  const { t } = useTranslation();

  function updateLine(index: number, value: string) {
    onChange(lines.map((line, i) => (i === index ? value : line)));
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  function moveLine(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function addLine() {
    onChange([...lines, '']);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <input
            value={line}
            onChange={(e) => updateLine(index, e.target.value)}
            placeholder={linePlaceholder}
            className="flex-1 rounded-lg border border-panel-border bg-panel-surface2 px-2.5 py-1.5 font-mono text-xs text-panel-text outline-none focus:border-panel-accent"
          />
          <button
            type="button"
            onClick={() => moveLine(index, -1)}
            disabled={index === 0}
            title={t('motd.moveUp')}
            className="rounded-md border border-panel-border px-1.5 py-1 text-xs text-panel-muted transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => moveLine(index, 1)}
            disabled={index === lines.length - 1}
            title={t('motd.moveDown')}
            className="rounded-md border border-panel-border px-1.5 py-1 text-xs text-panel-muted transition hover:border-panel-accent hover:text-panel-accent disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => removeLine(index)}
            title={t('motd.removeLine')}
            className="rounded-md border border-panel-border px-1.5 py-1 text-xs text-panel-muted transition hover:border-panel-danger hover:text-panel-danger"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addLine}
        className="self-start rounded-lg border border-dashed border-panel-border px-2.5 py-1 text-xs text-panel-muted transition hover:border-panel-accent hover:text-panel-accent"
      >
        + {addLabel}
      </button>
    </div>
  );
}
