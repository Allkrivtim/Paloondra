import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';

interface AuthContextValue {
  username: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUsername(res.data.username))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    const res = await api.post('/auth/login', { username: user, password });
    setToken(res.data.token);
    setUsername(res.data.username);
  }, []);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => undefined);
    clearToken();
    setUsername(null);
  }, []);

  const value = useMemo(
    () => ({ username, isAuthenticated: !!username, loading, login, logout }),
    [username, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
