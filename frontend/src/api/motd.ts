import { api } from './client';
import { MotdDocument } from '../types';

export async function getMotdConfig(): Promise<MotdDocument> {
  const res = await api.get('/motd');
  return res.data;
}

export async function saveMotdConfigRaw(raw: string): Promise<MotdDocument> {
  const res = await api.put('/motd', { raw });
  return res.data;
}

export async function saveMotdConfigFields(updates: Record<string, unknown>): Promise<MotdDocument> {
  const res = await api.put('/motd', { updates });
  return res.data;
}

export async function reloadMotd(): Promise<{ message: string }> {
  const res = await api.post('/motd/reload');
  return res.data;
}
