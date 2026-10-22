// Credential provisioning is deliberately separate from schema migrations:
// generated passwords must never appear in migration history or terminal output.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env.supabase'), quiet: true });
require('ts-node/register/transpile-only');
const { Pool } = require('pg');
const { buildPostgresOptions } = require('../../src/common/database/postgres-options');

async function main() {
  const output = path.join(__dirname, '../../.env.runtime.local');
  if (fs.existsSync(output)) throw new Error('Credential file already exists; refusing to rotate');
  const admin = new Pool(buildPostgresOptions(process.env.DATABASE_URL));
  let runtime;
  try {
    const { rows } = await admin.query("SELECT rolcanlogin FROM pg_roles WHERE rolname='arm_api'");
    if (rows.length !== 1 || rows[0].rolcanlogin) throw new Error('Role must exist and must not already have login');
    const secret = randomBytes(48).toString('hex');
    const url = new URL(process.env.DATABASE_URL);
    url.username = 'arm_api'; url.password = secret;
    // Exclusive private file written before mutation so a credential is never lost.
    fs.writeFileSync(output, `DATABASE_URL=${url.toString()}\n`, { flag: 'wx', mode: 0o600 });
    // Hex generated above is SQL-safe; ALTER ROLE does not accept bind parameters.
    await admin.query(`ALTER ROLE arm_api LOGIN PASSWORD '${secret}'`);
    runtime = new Pool(buildPostgresOptions(url.toString()));
    const result = await runtime.query("SELECT current_user, has_schema_privilege(current_user,'arm_migration','USAGE') AS archive_access, (SELECT count(*)::int FROM arm_app.roles) AS roles");
    if (result.rows[0].current_user !== 'arm_api' || result.rows[0].archive_access) throw new Error('Unexpected runtime permissions');
    console.log('Runtime login verified; private archive inaccessible. Credential saved only in ignored .env.runtime.local.');
  } finally { await runtime?.end(); await admin.end(); }
}
main().catch(() => { console.error('Runtime credential setup failed. No secret printed; do not retry by rotating automatically.'); process.exitCode = 1; });
