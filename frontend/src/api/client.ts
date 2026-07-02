import axios from 'axios';

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

const TOKEN_KEY = 'mc_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function wsUrl(path: string): string {
  const httpBase = new URL(API_BASE_URL);
  const protocol = httpBase.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = getToken() ?? '';
  return `${protocol}//${httpBase.host}${path}?token=${encodeURIComponent(token)}`;
}
