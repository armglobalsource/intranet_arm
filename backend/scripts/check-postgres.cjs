const path = require('node:path');
require('dotenv').config({ path: [path.join(__dirname, '../.env.supabase'), path.join(__dirname, '../.env')], quiet: true });
require('ts-node/register/transpile-only');
const { Pool } = require('pg');
const { buildPostgresOptions } = require('../src/common/database/postgres-options');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_MISSING');
  const pool = new Pool(buildPostgresOptions(process.env.DATABASE_URL, process.env.DATABASE_CA_CERT));
  pool.on('error', () => {});
  try {
    await pool.query('select 1');
    console.log('PostgreSQL connection: OK (read-only check)');
  } finally { await pool.end(); }
}

main().catch(error => {
  // Never print a URL, password, query parameters or driver error messages.
  const code = typeof error.code === 'string' && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'CONNECTION_FAILED';
  console.error(`PostgreSQL connection failed (${code}). Check backend configuration, network and TLS certificate.`);
  process.exitCode = 1;
});
