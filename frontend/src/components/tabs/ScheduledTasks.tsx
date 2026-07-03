import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createScheduledTask,
  deleteScheduledTask,
  listScheduledTasks,
  runScheduledTaskNow,
  updateScheduledTask,
} from '../../api/scheduler';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../context/ToastContext';
import { useDialog } from '../../context/DialogContext';
import { ScheduledTask, ScheduledTaskInput } from '../../types';
import Spinner from '../common/Spinner';
import TaskFormModal from '../scheduler/TaskFormModal';

export default function ScheduledTasks() {
  const { t } = useTranslation();
  const toast = useToast();
  const dialog = useDialog();

  function formatTime(ts: number | null) {
    if (!ts) return t('common.never');
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [modalTask, setModalTask] = useState<ScheduledTask | 'new' | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setTasks(await listScheduledTasks());
    } catch (err) {
      setLoadError(getErrorMessage(err, t('scheduler.failedToLoadTasks')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function withBusy(key: string, action: () => Promise<void>) {
    setBusy((prev) => new Set(prev).add(key));
    try {
      await action();
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  async function handleSubmit(input: ScheduledTaskInput) {
    if (modalTask && modalTask !== 'new') {
      const task = await updateScheduledTask(modalTask.id, input);
      toast.success(t('scheduler.updatedToast', { name: task.name }));
    } else {
      const task = await createScheduledTask(input);
      toast.success(t('scheduler.createdToast', { name: task.name }));
    }
    setModalTask(null);
    await refresh();
  }

  async function handleToggleEnabled(task: ScheduledTask) {
    await withBusy(task.id, async () => {
      try {
        await updateScheduledTask(task.id, {
          name: task.name,
          schedule: task.schedule,
          type: task.type,
          command: task.command,
          enabled: !task.enabled,
        });
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, t('scheduler.failedToUpdate')));
      }
    });
  }

  async function handleRunNow(task: ScheduledTask) {
    await withBusy(task.id, async () => {
      try {
        await runScheduledTaskNow(task.id);
        toast.success(t('scheduler.ranToast', { name: task.name }));
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, t('scheduler.failedToRun')));
      }
    });
  }

  async function handleDelete(task: ScheduledTask) {
    const confirmed = await dialog.confirm({
      title: t('scheduler.deleteTitle', { name: task.name }),
      confirmLabel: t('common.delete'),
      danger: true,
    });
    if (!confirmed) return;
    await withBusy(task.id, async () => {
      try {
        await deleteScheduledTask(task.id);
        toast.success(t('scheduler.deletedToast', { name: task.name }));
        await refresh();
      } catch (err) {
        toast.error(getErrorMessage(err, t('scheduler.failedToDelete')));
      }
    });
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold text-panel-text">{t('scheduler.title')}</h1>
        <button
          onClick={() => setModalTask('new')}
          className="rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent"
        >
          {t('scheduler.newTask')}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-panel-border bg-panel-surface">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-panel-muted">
            <Spinner /> {t('scheduler.loadingTasks')}
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-3xl">⚠️</span>
            <p className="max-w-sm text-sm text-panel-danger">{loadError}</p>
          </div>
        )}

        {!loading && !loadError && tasks.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-panel-muted">
            <span className="text-3xl">⏰</span>
            <p className="text-sm">{t('scheduler.noTasksTitle')}</p>
            <p className="text-xs">{t('scheduler.noTasksHint')}</p>
          </div>
        )}

        {!loading && !loadError && tasks.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel-surface2 text-xs uppercase tracking-wide text-panel-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t('scheduler.columnName')}</th>
                <th className="px-4 py-2 font-medium">{t('scheduler.columnSchedule')}</th>
                <th className="px-4 py-2 font-medium">{t('scheduler.columnAction')}</th>
                <th className="px-4 py-2 font-medium">{t('scheduler.columnLastRun')}</th>
                <th className="px-4 py-2 font-medium">{t('scheduler.columnEnabled')}</th>
                <th className="px-4 py-2 font-medium text-right">{t('scheduler.columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const isBusy = busy.has(task.id);
                return (
                  <tr
                    key={task.id}
                    className={`border-t border-panel-border transition hover:bg-panel-surface2 ${
                      isBusy ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-panel-text">
                      <div className="flex items-center gap-2">
                        {task.name}
                        {isBusy && <Spinner className="h-3 w-3" />}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-panel-muted">{task.schedule}</td>
                    <td className="px-4 py-2 text-panel-muted">
                      {task.type === 'restart' ? (
                        t('scheduler.restartServerAction')
                      ) : (
                        <code className="text-xs">{task.command}</code>
                      )}
                    </td>
                    <td className="px-4 py-2 text-panel-muted">
                      <div title={task.lastRunResult ?? undefined}>{formatTime(task.lastRunAt)}</div>
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => handleToggleEnabled(task)} disabled={isBusy}>
                        <span
                          className={`inline-block h-5 w-9 rounded-full transition ${
                            task.enabled ? 'bg-panel-accent2' : 'bg-panel-surface2'
                          }`}
                        >
                          <span
                            className={`block h-4 w-4 translate-y-0.5 rounded-full bg-black transition ${
                              task.enabled ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          onClick={() => handleRunNow(task)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                        >
                          {t('scheduler.runNow')}
                        </button>
                        <button
                          onClick={() => setModalTask(task)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-accent disabled:opacity-50"
                        >
                          {t('scheduler.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(task)}
                          disabled={isBusy}
                          className="text-panel-muted hover:text-panel-danger disabled:opacity-50"
                        >
                          {t('scheduler.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalTask && (
        <TaskFormModal
          initial={modalTask === 'new' ? undefined : modalTask}
          onCancel={() => setModalTask(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
