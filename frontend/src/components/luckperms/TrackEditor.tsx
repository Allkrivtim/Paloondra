import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import Spinner from '../common/Spinner';

interface Props {
  groups: string[];
  allGroupNames: string[];
  onSetGroups: (groups: string[]) => Promise<void>;
}

/**
 * A track is just an ordered list of group names - there's no drag-reorder
 * here (unlike the File Manager's drag-and-drop move), just up/down/remove
 * buttons. Simpler and less error-prone than generic list DnD for what's
 * usually a short list, and every change sends the WHOLE list back (the
 * REST API has no separate insert/reorder endpoint - see
 * luckperms.service.ts's setTrackGroups).
 */
export default function TrackEditor({ groups, allGroupNames, onSetGroups }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const available = allGroupNames.filter((g) => !groups.includes(g));

  async function apply(next: string[]) {
    setBusy(true);
    try {
      await onSetGroups(next);
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToUpdateTrack')));
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    apply(next);
  }

  function remove(index: number) {
    apply(groups.filter((_, i) => i !== index));
  }

  async function add() {
    if (!selected) return;
    await apply([...groups, selected]);
    setSelected('');
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
          onClick={add}
          disabled={busy || !selected}
          className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
        >
          {busy && <Spinner className="h-3 w-3 text-black" />}
          {t('luckperms.addToTrack')}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-panel-muted">{t('luckperms.emptyTrack')}</p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {groups.map((g, i) => (
            <li key={g} className="flex items-center justify-between gap-2 rounded-lg bg-panel-surface2 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="text-xs text-panel-muted">{i + 1}.</span>
                <span className="font-mono text-panel-text">{g}</span>
              </span>
              <span className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={busy || i === 0} className="text-panel-muted hover:text-panel-accent disabled:opacity-30">
                  ↑
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={busy || i === groups.length - 1}
                  className="text-panel-muted hover:text-panel-accent disabled:opacity-30"
                >
                  ↓
                </button>
                <button onClick={() => remove(i)} disabled={busy} className="ml-2 text-xs text-panel-muted hover:text-panel-danger disabled:opacity-50">
                  {t('luckperms.remove')}
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
