import { api } from './client';
import { AuditLogEntry } from '../types';

export async function listAuditLog(limit = 20): Promise<AuditLogEntry[]> {
  const res = await api.get('/audit-log', { params: { limit } });
  return res.data.entries;
}
