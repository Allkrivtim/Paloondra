import cron, { ScheduledTask as CronTask } from 'node-cron';
import { randomUUID } from 'crypto';
import { readJsonFile, writeJsonFile } from './jsonStore';
import { scriptsService } from './scripts.service';
import { rconService } from './rcon.service';
import { auditLogService } from './auditLog.service';
import { ScheduledTask, ScheduledTaskInput } from '../types';

const FILE = 'scheduled-tasks.json';

/**
 * Cron-scheduled restarts or RCON commands (nightly restart, timed
 * announcements, etc.), persisted locally and re-armed on startup. Cron
 * expressions are evaluated in this backend's local timezone and use
 * node-cron's syntax (5 fields, or 6 with an optional leading seconds
 * field) - validated via node-cron's own `validate()` rather than a
 * hand-rolled check.
 */
class SchedulerService {
  private tasks: ScheduledTask[] = [];
  private handles = new Map<string, CronTask>();
  private loaded: Promise<void> | null = null;

  private ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      this.loaded = (async () => {
        this.tasks = await readJsonFile<ScheduledTask[]>(FILE, []);
        for (const task of this.tasks) {
          if (task.enabled) this.armHandle(task);
        }
      })();
    }
    return this.loaded;
  }

  async start(): Promise<void> {
    await this.ensureLoaded();
  }

  async list(): Promise<ScheduledTask[]> {
    await this.ensureLoaded();
    return [...this.tasks].sort((a, b) => a.createdAt - b.createdAt);
  }

  private validate(input: ScheduledTaskInput): void {
    if (!input.name?.trim()) throw new Error('Name is required');
    if (!input.schedule?.trim() || !cron.validate(input.schedule.trim())) {
      throw new Error(`"${input.schedule}" is not a valid cron expression`);
    }
    if (input.type === 'rcon' && !input.command?.trim()) {
      throw new Error('An RCON command is required for this task type');
    }
  }

  async create(input: ScheduledTaskInput): Promise<ScheduledTask> {
    await this.ensureLoaded();
    this.validate(input);

    const task: ScheduledTask = {
      id: randomUUID(),
      name: input.name.trim(),
      schedule: input.schedule.trim(),
      type: input.type,
      command: input.type === 'rcon' ? (input.command ?? '').trim() : null,
      enabled: input.enabled,
      createdAt: Date.now(),
      lastRunAt: null,
      lastRunResult: null,
    };
    this.tasks.push(task);
    if (task.enabled) this.armHandle(task);
    await this.persist();
    return task;
  }

  async update(id: string, input: ScheduledTaskInput): Promise<ScheduledTask> {
    await this.ensureLoaded();
    this.validate(input);

    const existing = this.tasks.find((t) => t.id === id);
    if (!existing) throw new Error('Scheduled task not found');

    this.disarmHandle(id);
    existing.name = input.name.trim();
    existing.schedule = input.schedule.trim();
    existing.type = input.type;
    existing.command = input.type === 'rcon' ? (input.command ?? '').trim() : null;
    existing.enabled = input.enabled;
    if (existing.enabled) this.armHandle(existing);
    await this.persist();
    return existing;
  }

  async delete(id: string): Promise<void> {
    await this.ensureLoaded();
    this.disarmHandle(id);
    this.tasks = this.tasks.filter((t) => t.id !== id);
    await this.persist();
  }

  async runNow(id: string): Promise<ScheduledTask> {
    await this.ensureLoaded();
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new Error('Scheduled task not found');
    await this.execute(task);
    return task;
  }

  private armHandle(task: ScheduledTask): void {
    this.disarmHandle(task.id);
    const handle = cron.schedule(task.schedule, () => void this.execute(task), { name: task.id });
    this.handles.set(task.id, handle);
  }

  private disarmHandle(id: string): void {
    const handle = this.handles.get(id);
    if (handle) {
      handle.stop();
      this.handles.delete(id);
    }
  }

  private async execute(task: ScheduledTask): Promise<void> {
    let result: string;
    try {
      if (task.type === 'restart') {
        scriptsService.run('restart');
        result = 'Triggered the restart script (see Dashboard for live output)';
      } else {
        const { response } = await rconService.execute(task.command ?? '');
        result = response.trim() || '(empty response)';
      }
    } catch (err) {
      result = `Failed: ${err instanceof Error ? err.message : String(err)}`;
    }

    task.lastRunAt = Date.now();
    task.lastRunResult = result;
    await this.persist();
    await auditLogService.record('scheduler', `Ran scheduled task "${task.name}"`, result);
  }

  private async persist(): Promise<void> {
    await writeJsonFile(FILE, this.tasks);
  }
}

export const schedulerService = new SchedulerService();
