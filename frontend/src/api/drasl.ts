import { api } from './client';
import { DraslCreateUserRequest, DraslInvite, DraslUpdateUserRequest, DraslUser } from '../types';

export async function getHealth(): Promise<{ configured: boolean; ok: boolean }> {
  const res = await api.get('/drasl/health');
  return res.data;
}

// --- Users -----------------------------------------------------------------

export async function listUsers(): Promise<DraslUser[]> {
  const res = await api.get('/drasl/users');
  return res.data.users;
}

export async function getUser(uuid: string): Promise<DraslUser> {
  const res = await api.get(`/drasl/users/${encodeURIComponent(uuid)}`);
  return res.data;
}

export async function createUser(req: DraslCreateUserRequest): Promise<DraslUser> {
  const res = await api.post('/drasl/users', req);
  return res.data;
}

export async function updateUser(uuid: string, req: DraslUpdateUserRequest): Promise<DraslUser> {
  const res = await api.patch(`/drasl/users/${encodeURIComponent(uuid)}`, req);
  return res.data;
}

export async function deleteUser(uuid: string): Promise<void> {
  await api.delete(`/drasl/users/${encodeURIComponent(uuid)}`);
}

// --- Invites -----------------------------------------------------------------

export async function listInvites(): Promise<DraslInvite[]> {
  const res = await api.get('/drasl/invites');
  return res.data.invites;
}

export async function createInvite(): Promise<DraslInvite> {
  const res = await api.post('/drasl/invites');
  return res.data;
}

export async function deleteInvite(code: string): Promise<void> {
  await api.delete(`/drasl/invites/${encodeURIComponent(code)}`);
}
