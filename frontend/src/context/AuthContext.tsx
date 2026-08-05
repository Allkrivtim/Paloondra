import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';
import { PermissionKey, UserRole } from '../types';

interface AuthContextValue {
  username: string | null;
  role: UserRole | null;
  permissions: PermissionKey[];
  /** Further restricts the `sftp` permission to one directory subtree - null means unrestricted (also always null for admins). */
  sftpRootPath: string | null;
  /** Convenience for `role === 'admin'` - gates the Users tab and its nav entry. */
  isAdmin: boolean;
  /** True for admins regardless of `permissions` (always bypassed), or when the key is present in `permissions`. */
  hasPermission: (key: PermissionKey) => boolean;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [sftpRootPath, setSftpRootPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUsername(res.data.username);
        setRole(res.data.role);
        setPermissions(res.data.permissions ?? []);
        setSftpRootPath(res.data.sftpRootPath ?? null);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const res = await api.post('/auth/login', { username: user, password });
    setToken(res.data.token);
    setUsername(res.data.username);
    setRole(res.data.role);
    setPermissions(res.data.permissions ?? []);
    setSftpRootPath(res.data.sftpRootPath ?? null);
  }, []);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => undefined);
    clearToken();
    setUsername(null);
    setRole(null);
    setPermissions([]);
    setSftpRootPath(null);
  }, []);

  const isAdmin = role === 'admin';
  const hasPermission = useCallback(
    (key: PermissionKey) => isAdmin || permissions.includes(key),
    [isAdmin, permissions],
  );

  const value = useMemo(
    () => ({
      username,
      role,
      permissions,
      sftpRootPath,
      isAdmin,
      hasPermission,
      isAuthenticated: !!username,
      loading,
      login,
      logout,
    }),
    [username, role, permissions, sftpRootPath, isAdmin, hasPermission, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
