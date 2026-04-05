import { Platform } from 'react-native';
import { supabase } from './supabase';

// Android emulator uses 10.0.2.2 to reach the host machine's localhost
const DEFAULT_API_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001'
  : 'http://localhost:3001';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData (let browser set it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const message = (errorBody as { error?: string }).error ?? res.statusText ?? 'Request failed';
      throw new Error(message);
    }

    return res.json();
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('Pedido expirou. Verifica a tua ligação.');
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
