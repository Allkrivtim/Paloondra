import { api } from './client';
import { ScheduledTask, ScheduledTaskInput } from '../types';

export async function listScheduledTasks(): Promise<ScheduledTask[]> {
  const res = await api.get('/scheduler/tasks');
  return res.data.tasks;
}

export async function createScheduledTask(input: ScheduledTaskInput): Promise<ScheduledTask> {
  const res = await api.post('/scheduler/tasks', input);
  return res.data.task;
}

export async function updateScheduledTask(id: string, input: ScheduledTaskInput): Promise<ScheduledTask> {
  const res = await api.put(`/scheduler/tasks/${encodeURIComponent(id)}`, input);
  return res.data.task;
}

export async function deleteScheduledTask(id: string): Promise<void> {
  await api.delete(`/scheduler/tasks/${encodeURIComponent(id)}`);
}

export async function runScheduledTaskNow(id: string): Promise<ScheduledTask> {
  const res = await api.post(`/scheduler/tasks/${encodeURIComponent(id)}/run`);
  return res.data.task;
}
