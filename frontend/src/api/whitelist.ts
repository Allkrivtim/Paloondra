import { api } from './client';
import { WhitelistDocument } from '../types';

interface WhitelistActionResult {
  message: string;
  document: WhitelistDocument;
}

export async function getWhitelist(): Promise<WhitelistDocument> {
  const res = await api.get('/whitelist');
  return res.data;
}

export async function addToWhitelist(name: string): Promise<WhitelistActionResult> {
  const res = await api.post('/whitelist/add', { name });
  return res.data;
}

export async function removeFromWhitelist(name: string): Promise<WhitelistActionResult> {
  const res = await api.post('/whitelist/remove', { name });
  return res.data;
}

export async function reloadWhitelist(): Promise<WhitelistActionResult> {
  const res = await api.post('/whitelist/reload');
  return res.data;
}

export async function setWhitelistEnabled(enabled: boolean): Promise<WhitelistActionResult> {
  const res = await api.put('/whitelist/enabled', { enabled });
  return res.data;
}
