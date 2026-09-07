import axios from 'axios';
import { useAuthStore } from './store/auth.store';

/** Extrae un mensaje de error legible de una respuesta de API */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if ((err as any)?.response?.status === 429) {
    return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
  }
  const msg = (err as any)?.response?.data?.message;
  if (!msg) return fallback;
  if (Array.isArray(msg)) return msg[0] ?? fallback;
  if (typeof msg === 'string') return msg;
  return fallback;
}

// En ambientes desplegados (Firebase Hosting) se usa URL relativa /api/v1
// y Firebase Hosting enruta al backend correcto según el dominio (dev o prod).
// En desarrollo local se usa http://localhost:3001/api/v1.
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api/v1' : 'http://localhost:3001/api/v1');

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

// Attach access token on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Helper para redirigir al login (solo en cliente)
function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = '/auth/login';
  }
}

// Endpoints públicos de auth: un 401 aquí es un error de credenciales del propio
// endpoint, no una sesión expirada — no deben disparar el refresh/redirect.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => original?.url?.includes(p));
    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        redirectToLogin();
        return Promise.reject(err);
      }
      try {
        const { data } = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken },
        );
        useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
        // El endpoint /auth/refresh también devuelve el user con permisos
        // frescos leídos de Firestore (por si el admin cambió el rol o
        // los permisos del rol desde el último login). Actualizamos el
        // store para que la UI refleje los permisos actuales sin requerir
        // logout+login manual.
        if (data.user) {
          useAuthStore.getState().updateUser(data.user);
        }
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        useAuthStore.getState().logout();
        redirectToLogin();
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(err);
  },
);
