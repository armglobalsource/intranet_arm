// Read-only inventory. Full URLs can contain signed tokens: save only in the
// ignored migration-artifacts directory and print aggregate counts, never URLs.
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.supabase'), quiet: true });
require('ts-node/register/transpile-only');
const { Pool } = require('pg');
const { buildPostgresOptions } = require('../../src/common/database/postgres-options');

async function main() {
  const pool = new Pool(buildPostgresOptions(process.env.DATABASE_URL));
  const urls = new Map();
  function visit(value, location) {
    if (typeof value === 'string' && /^https?:\/\//.test(value)) {
      let url; try { url = new URL(value); } catch { return; }
      if (!urls.has(value)) urls.set(value, { url: value, host: url.hostname, references: [] });
      urls.get(value).references.push(location);
    } else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${location}[${index}]`));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => visit(item, `${location}.${key}`));
  }
  try {
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='arm_app' ORDER BY tablename");
    for (const { tablename } of tables.rows) {
      if (!/^[a-z_]+$/.test(tablename)) throw new Error('Unexpected table identifier');
      const result = await pool.query(`SELECT to_jsonb(t) AS data FROM arm_app."${tablename}" t`);
      for (const { data } of result.rows) visit(data, `${tablename}:${data.id ?? data.document_id}`);
    }
    const output = path.resolve(__dirname, '../../../migration-artifacts/storage-inventory.json');
    fs.writeFileSync(output, JSON.stringify([...urls.values()], null, 2), { mode: 0o600 });
    const counts = {};
    for (const item of urls.values()) counts[item.host] = (counts[item.host] ?? 0) + 1;
    console.log(JSON.stringify({ uniqueUrls: urls.size, hosts: counts }));
  } finally { await pool.end(); }
}
main().catch(() => { console.error('Storage inventory failed; no sensitive details printed.'); process.exitCode = 1; });
