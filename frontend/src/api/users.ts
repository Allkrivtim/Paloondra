import { api } from './client';
import { AppUser, PermissionKey, UserRole } from '../types';

export async function getUsers(): Promise<AppUser[]> {
  const res = await api.get('/users');
  return res.data;
}

export async function createUser(
  username: string,
  password: string,
  role: UserRole,
  permissions?: PermissionKey[],
): Promise<AppUser> {
  const res = await api.post('/users', { username, password, role, permissions });
  return res.data;
}

export async function setUserRole(id: string, role: UserRole): Promise<AppUser> {
  const res = await api.put(`/users/${id}/role`, { role });
  return res.data;
}

export async function setUserPermissions(id: string, permissions: PermissionKey[]): Promise<AppUser> {
  const res = await api.put(`/users/${id}/permissions`, { permissions });
  return res.data;
}

export async function resetUserPassword(id: string, password: string): Promise<AppUser> {
  const res = await api.put(`/users/${id}/password`, { password });
  return res.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
