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

// En Vercel la API se sirve en el mismo dominio (src/pages/api/v1), así que se
// usa la URL relativa /api/v1. En desarrollo local, http://localhost:3001/api/v1.
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

// Rutas públicas que NO deben redirigir al login aunque un request colateral
// devuelva 401. Ej: la landing pública /agenda o la vista pública de una
// ficha compartida por link. Estos bundles pueden importar transitivamente
// hooks que usan `api`, y si alguno se dispara sin sesión, no queremos
// arrastrar a un visitante anónimo al login.
const PUBLIC_ROUTES = ['/agenda', '/ficha/', '/auth/', '/politicas'];

function isOnPublicRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return PUBLIC_ROUTES.some((prefix) => path === prefix || path.startsWith(prefix));
}

// Helper para redirigir al login (solo en cliente y desde rutas privadas)
function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (isOnPublicRoute()) return; // nunca desde una landing pública
  window.location.href = '/auth/login';
}

// Endpoints públicos de auth: un 401 aquí es un error de credenciales del propio
// endpoint, no una sesión expirada — no deben disparar el refresh/redirect.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

// Una sola renovación en curso para todas las peticiones que reciben 401 a la
// vez. El refresh token rota en cada uso y el backend trata su reutilización
// como robo de sesión: renovaciones en paralelo cerraban la sesión al vencer
// el access token.
let refreshing: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    const refreshToken = useAuthStore.getState().refreshToken;
    refreshing = (async () => {
      if (!refreshToken) throw new Error('Sin sesión');
      const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
      useAuthStore.getState().setTokens(data.accessToken, data.refreshToken);
      // El endpoint /auth/refresh también devuelve el user con permisos
      // frescos (por si el admin cambió el rol o los permisos del rol desde
      // el último login), para que la UI los refleje sin volver a entrar.
      if (data.user) useAuthStore.getState().updateUser(data.user);
      return data.accessToken as string;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => original?.url?.includes(p));
    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      if (!useAuthStore.getState().refreshToken) {
        useAuthStore.getState().logout();
        redirectToLogin();
        return Promise.reject(err);
      }
      try {
        const accessToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${accessToken}`;
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
