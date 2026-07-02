import axios from 'axios';

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

const TOKEN_KEY = 'paloondra_token';

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

// A 401 means the token is missing/expired/invalid - there's no refresh
// flow, so bounce straight to login. This also stops any open WebSockets
// (RCON/SSH/metrics) from retrying forever with a token that will never
// become valid again; the full navigation tears them down.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && getToken()) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function wsUrl(path: string): string {
  const httpBase = new URL(API_BASE_URL);
  const protocol = httpBase.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = getToken() ?? '';
  return `${protocol}//${httpBase.host}${path}?token=${encodeURIComponent(token)}`;
}
