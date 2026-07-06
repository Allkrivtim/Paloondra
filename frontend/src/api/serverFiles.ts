import { api } from './client';
import { ServerFileKey } from '../types';

export interface ServerFileDocument {
  filename: string;
  raw: string;
  /** Known form fields actually present in the file, keyed by dotted path - absent keys just aren't in the file yet. */
  values: Record<string, unknown>;
}

export async function getServerFile(key: ServerFileKey): Promise<ServerFileDocument> {
  const res = await api.get(`/server-files/${key}`);
  return res.data;
}

/** Raw mode: full-file overwrite. */
export async function saveServerFileRaw(key: ServerFileKey, raw: string): Promise<ServerFileDocument> {
  const res = await api.put(`/server-files/${key}`, { raw });
  return res.data;
}

/** Form mode: only the given dotted-path fields are changed - everything else in the file is left untouched. */
export async function saveServerFileFields(
  key: ServerFileKey,
  updates: Record<string, unknown>,
): Promise<ServerFileDocument> {
  const res = await api.put(`/server-files/${key}`, { updates });
  return res.data;
}
