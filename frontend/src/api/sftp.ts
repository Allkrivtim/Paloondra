import { api } from './client';
import { SftpEntry } from '../types';

export async function listDir(path: string): Promise<{ path: string; entries: SftpEntry[] }> {
  const res = await api.get('/sftp/list', { params: { path } });
  return res.data;
}

export async function mkdir(path: string): Promise<void> {
  await api.post('/sftp/mkdir', { path });
}

export async function renameItem(from: string, to: string): Promise<void> {
  await api.post('/sftp/rename', { from, to });
}

export async function moveItem(from: string, to: string): Promise<void> {
  await api.post('/sftp/move', { from, to });
}

export async function deleteItem(path: string): Promise<void> {
  await api.delete('/sftp/item', { params: { path } });
}

export async function uploadFiles(dir: string, files: File[]): Promise<void> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  await api.post('/sftp/upload', formData, {
    params: { path: dir },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await api.get('/sftp/download', { params: { path }, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function readFile(path: string): Promise<string> {
  const res = await api.get('/sftp/file', { params: { path } });
  return res.data.content;
}

export async function writeFile(path: string, content: string): Promise<void> {
  await api.put('/sftp/file', { path, content });
}
