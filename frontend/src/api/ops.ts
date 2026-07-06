import { api } from './client';
import { OpEntry } from '../types';

interface OpActionResult {
  message: string;
  entries: OpEntry[];
}

export async function listOps(): Promise<OpEntry[]> {
  const res = await api.get('/ops');
  return res.data;
}

export async function addOp(name: string): Promise<OpActionResult> {
  const res = await api.post('/ops/add', { name });
  return res.data;
}

export async function removeOp(name: string): Promise<OpActionResult> {
  const res = await api.post('/ops/remove', { name });
  return res.data;
}

export async function setOpLevel(uuid: string, level: number): Promise<{ entries: OpEntry[]; restartRequired: boolean }> {
  const res = await api.put(`/ops/${encodeURIComponent(uuid)}/level`, { level });
  return res.data;
}
