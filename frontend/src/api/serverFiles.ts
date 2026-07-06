import { api } from './client';
import { ServerFileKey } from '../types';

export interface ServerFileDocument {
  filename: string;
  raw: string;
}

export async function getServerFile(key: ServerFileKey): Promise<ServerFileDocument> {
  const res = await api.get(`/server-files/${key}`);
  return res.data;
}

export async function saveServerFile(key: ServerFileKey, raw: string): Promise<ServerFileDocument> {
  const res = await api.put(`/server-files/${key}`, { raw });
  return res.data;
}
