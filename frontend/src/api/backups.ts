import { api } from './client';
import { BackupInfo } from '../types';

export async function listBackups(): Promise<BackupInfo[]> {
  const res = await api.get('/backups');
  return res.data.backups;
}

export async function deleteBackup(filename: string): Promise<void> {
  await api.delete(`/backups/${encodeURIComponent(filename)}`);
}

export async function runBackup(): Promise<void> {
  await api.post('/server/backup');
}
