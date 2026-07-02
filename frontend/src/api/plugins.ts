import { api } from './client';
import { PluginInfo } from '../types';

export async function listPlugins(): Promise<PluginInfo[]> {
  const res = await api.get('/plugins');
  return res.data.plugins;
}

export async function togglePlugin(filename: string, enable: boolean): Promise<void> {
  await api.post('/plugins/toggle', { filename, enable });
}

export async function deletePlugin(filename: string): Promise<void> {
  await api.delete(`/plugins/${encodeURIComponent(filename)}`);
}

export async function installPluginFromUrl(url: string): Promise<PluginInfo> {
  const res = await api.post('/plugins/install-url', { url });
  return res.data.plugin;
}

export async function installPluginFromFile(file: File, onProgress?: (pct: number) => void): Promise<PluginInfo> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post('/plugins/install-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return res.data.plugin;
}
