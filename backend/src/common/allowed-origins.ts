import { ConfigService } from '@nestjs/config';

/**
 * Orígenes permitidos de forma fija (además de los de FRONTEND_URL).
 * Incluye la PWA móvil de ARM (armglobal.web.app) y su dominio de dev.
 */
export const STATIC_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:5173',            // Vite dev (PWA móvil)
  'https://intranet-arm.web.app',
  'https://intranet-arm-dev.web.app',
  'https://ecosistema-arm.web.app',
  'https://ecosistema-arm-dev.web.app',
  'https://ecosistema.armglobal.org', // dominio propio (armglobal.org)
  'https://armglobal.web.app',        // PWA móvil ARM (prod, legado)
  'https://armglobal.firebaseapp.com',
  'https://ar-mobile-1.web.app',      // PWA móvil ARM (prod, proyecto Firebase nuevo)
  'https://ar-mobile-1.firebaseapp.com',
];

/** Lista completa de orígenes permitidos = FRONTEND_URL (CSV) ∪ STATIC_ALLOWED_ORIGINS. */
export function getAllowedOrigins(config: ConfigService): string[] {
  const fromEnv = (config.get<string>('FRONTEND_URL', 'http://localhost:3000'))
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return Array.from(new Set([...fromEnv, ...STATIC_ALLOWED_ORIGINS]));
}

/**
 * Valida un `return_to` (origen al que redirigir tras el login) contra la
 * allowlist. Devuelve el origen si es válido, o null. Previene open redirect.
 */
export function resolveReturnOrigin(
  returnTo: string | undefined,
  config: ConfigService,
): string | null {
  if (!returnTo) return null;
  try {
    const origin = new URL(returnTo).origin;
    return getAllowedOrigins(config).includes(origin) ? origin : null;
  } catch {
    return null;
  }
}
