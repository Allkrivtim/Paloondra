import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScheduledTask, ScheduledTaskInput, ScheduledTaskType } from '../../types';
import Spinner from '../common/Spinner';

interface Props {
  initial?: ScheduledTask;
  onCancel: () => void;
  onSubmit: (input: ScheduledTaskInput) => Promise<void>;
}

export default function TaskFormModal({ initial, onCancel, onSubmit }: Props) {
  const { t } = useTranslation();

  const PRESETS: Array<{ label: string; value: string }> = [
    { label: t('taskForm.presetCustom'), value: '' },
    { label: t('taskForm.presetHourly'), value: '0 * * * *' },
    { label: t('taskForm.presetMidnight'), value: '0 0 * * *' },
    { label: t('taskForm.preset4am'), value: '0 4 * * *' },
    { label: t('taskForm.preset30min'), value: '*/30 * * * *' },
    { label: t('taskForm.presetSunday3am'), value: '0 3 * * 0' },
  ];

  const [name, setName] = useState(initial?.name ?? '');
  const [schedule, setSchedule] = useState(initial?.schedule ?? '');
  const [type, setType] = useState<ScheduledTaskType>(initial?.type ?? 'restart');
  const [command, setCommand] = useState(initial?.command ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), schedule: schedule.trim(), type, command: command.trim() || null, enabled });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? t('taskForm.failedToSave'));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="dialog-enter w-full max-w-md rounded-xl border border-panel-border bg-panel-surface p-5 shadow-2xl"
      >
        <h2 className="mb-4 text-sm font-semibold text-panel-text">
          {initial ? t('taskForm.editTitle') : t('taskForm.newTitle')}
        </h2>

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-panel-muted">{t('taskForm.nameLabel')}</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('taskForm.namePlaceholder')}
          className="mb-3 w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
        />

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-panel-muted">{t('taskForm.presetLabel')}</label>
        <select
          onChange={(e) => e.target.value && setSchedule(e.target.value)}
          defaultValue=""
          className="mb-3 w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
        >
          {PRESETS.map((p) => (
            <option key={p.label} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-panel-muted">
          {t('taskForm.cronLabel')}
        </label>
        <input
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="0 4 * * *"
          className="mb-1 w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
        />
        <p className="mb-3 text-xs text-panel-muted">{t('taskForm.cronHint')}</p>

        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-panel-muted">{t('taskForm.actionLabel')}</label>
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setType('restart')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
              type === 'restart'
                ? 'border-panel-accent text-panel-accent'
                : 'border-panel-border text-panel-muted hover:text-panel-text'
            }`}
          >
            {t('taskForm.restartServer')}
          </button>
          <button
            type="button"
            onClick={() => setType('rcon')}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
              type === 'rcon'
                ? 'border-panel-accent text-panel-accent'
                : 'border-panel-border text-panel-muted hover:text-panel-text'
            }`}
          >
            {t('taskForm.rconCommand')}
          </button>
        </div>

        {type === 'rcon' && (
          <>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-panel-muted">
              {t('taskForm.rconCommand')}
            </label>
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={t('taskForm.rconCommandPlaceholder')}
              className="mb-3 w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 font-mono text-sm text-panel-text outline-none focus:border-panel-accent"
            />
          </>
        )}

        <label className="mb-4 flex items-center gap-2 text-sm text-panel-text">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-panel-border accent-panel-accent2"
          />
          {t('taskForm.enabledLabel')}
        </label>

        {error && (
          <div className="mb-4 rounded-lg border border-panel-danger/40 bg-panel-danger/10 px-3 py-2 text-sm text-panel-danger">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-muted"
          >
            {t('taskForm.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !schedule.trim() || (type === 'rcon' && !command.trim())}
            className="flex items-center gap-1.5 rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
          >
            {submitting && <Spinner className="h-3 w-3 text-black" />}
            {initial ? t('taskForm.save') : t('taskForm.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
