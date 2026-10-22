import { PoolConfig } from 'pg';
import { rootCertificates } from 'node:tls';
import { SUPABASE_ROOT_CA } from './supabase-ca';

export function buildPostgresOptions(connection: string, ca?: string): PoolConfig {
  let url: URL;
  try { url = new URL(connection); } catch { throw new Error('DATABASE_URL no es una conexión PostgreSQL válida'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.pathname.slice(1)) {
    throw new Error('DATABASE_URL debe incluir servidor, usuario y base PostgreSQL');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  const supabase = /^(db\.[a-z]{20}\.supabase\.co|[a-z0-9-]+\.pooler\.supabase\.com)$/.test(host);
  const certificate = ca ? ca.replace(/\\n/g, '\n') : supabase ? [...rootCertificates, SUPABASE_ROOT_CA] : undefined;
  if (!local && url.searchParams.get('sslmode') === 'disable') {
    throw new Error('La conexión PostgreSQL remota requiere TLS');
  }
  // Parse connection fields explicitly. pg otherwise lets sslmode in the URI
  // replace an SSL object, including its CA and certificate verification.
  try {
    return {
      host,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
      ssl: local ? false : { rejectUnauthorized: true, ...(certificate ? { ca: certificate } : {}) },
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      statement_timeout: 15000,
      query_timeout: 20000,
      application_name: 'ecosistema-arm-backend',
    };
  } catch { throw new Error('DATABASE_URL contiene caracteres codificados inválidos'); }
}
