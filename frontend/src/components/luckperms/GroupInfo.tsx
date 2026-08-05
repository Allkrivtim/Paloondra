import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuckPermsNewNode, LuckPermsNode } from '../../types';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { buildDisplayNameKey, buildWeightKey, parseDisplayNameKey, parseWeightKey } from './nodeFormat';
import Spinner from '../common/Spinner';

interface Props {
  nodes: LuckPermsNode[];
  onAdd: (node: LuckPermsNewNode) => Promise<void>;
  onRemove: (node: LuckPermsNode) => Promise<void>;
}

/**
 * Weight and display name are each a single node (weight.<n> / displayname.<name>)
 * that behaves like a "set" rather than a list - editing means removing
 * whichever one currently exists (if any) and adding the new one, done here
 * as one user action even though it's two API calls underneath.
 */
export default function GroupInfo({ nodes, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const weightNode = nodes.find((n) => parseWeightKey(n.key) !== null) ?? null;
  const displayNameNode = nodes.find((n) => parseDisplayNameKey(n.key) !== null) ?? null;

  const [weightInput, setWeightInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setWeightInput(weightNode ? String(parseWeightKey(weightNode.key)) : '');
  }, [weightNode]);
  useEffect(() => {
    setNameInput(displayNameNode ? (parseDisplayNameKey(displayNameNode.key) ?? '') : '');
  }, [displayNameNode]);

  async function saveWeight() {
    setSavingWeight(true);
    try {
      if (weightNode) await onRemove(weightNode);
      if (weightInput.trim()) {
        const n = parseInt(weightInput, 10);
        if (!Number.isNaN(n)) await onAdd({ key: buildWeightKey(n) });
      }
      toast.success(t('luckperms.weightSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToSave')));
    } finally {
      setSavingWeight(false);
    }
  }

  async function saveDisplayName() {
    setSavingName(true);
    try {
      if (displayNameNode) await onRemove(displayNameNode);
      if (nameInput.trim()) await onAdd({ key: buildDisplayNameKey(nameInput.trim()) });
      toast.success(t('luckperms.displayNameSaved'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('luckperms.failedToSave')));
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-panel-muted">{t('luckperms.weightLabel')}</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder={t('luckperms.weightPlaceholder')}
            className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
          <button
            onClick={saveWeight}
            disabled={savingWeight}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {savingWeight && <Spinner className="h-3 w-3 text-black" />}
            {t('luckperms.save')}
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-panel-muted">{t('luckperms.displayNameLabel')}</label>
        <div className="flex gap-2">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder={t('luckperms.displayNamePlaceholder')}
            className="w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-1.5 text-sm text-panel-text outline-none focus:border-panel-accent"
          />
          <button
            onClick={saveDisplayName}
            disabled={savingName}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {savingName && <Spinner className="h-3 w-3 text-black" />}
            {t('luckperms.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
