import { api } from './client';

export interface ServerPropertiesDocument {
  raw: string;
  properties: Record<string, string>;
}

export async function getServerProperties(): Promise<ServerPropertiesDocument> {
  const res = await api.get('/server-properties');
  return res.data;
}

export async function saveServerProperties(properties: Record<string, string>): Promise<ServerPropertiesDocument> {
  const res = await api.put('/server-properties', { properties });
  return res.data;
}

export async function saveServerPropertiesRaw(raw: string): Promise<ServerPropertiesDocument> {
  const res = await api.put('/server-properties', { raw });
  return res.data;
}
