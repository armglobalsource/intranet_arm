// Exact URL replacements only, with optimistic concurrency and transaction.
// Default is rollback; pass --apply after reviewing aggregate dry-run counts.
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.runtime.local'), quiet: true });
require('ts-node/register/transpile-only');
const { Pool } = require('pg');
const { buildPostgresOptions } = require('../../src/common/database/postgres-options');
const quote = name => '"' + name.replace(/"/g, '""') + '"';
async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../migration-artifacts/storage-transfer-verified.json')));
  const mapping = new Map();
  for (const record of manifest) if (record.verified && record.newUrl) {
    for (const oldUrl of record.oldUrls) mapping.set(oldUrl, record.newUrl);
  }
  if (!mapping.size) throw Error('No verified public mappings');
  function replace(value) {
    if (typeof value === 'string') return mapping.get(value) ?? value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, replace(v)]));
    return value;
  }
  const pool = new Pool(buildPostgresOptions(process.env.DATABASE_URL));
  const client = await pool.connect();
  const changes = {};
  try {
    await client.query('BEGIN');
    const { rows: columns } = await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='arm_app' AND data_type IN ('text','character varying','json','jsonb') ORDER BY table_name,ordinal_position");
    for (const column of columns) {
      const table = `arm_app.${quote(column.table_name)}`;
      const field = quote(column.column_name);
      const json = column.data_type.startsWith('json');
      const { rows } = await client.query(`SELECT ctid::text AS locator, ${field} AS value FROM ${table} WHERE ${field} IS NOT NULL`);
      for (const row of rows) {
        const changed = replace(row.value);
        if (JSON.stringify(changed) === JSON.stringify(row.value)) continue;
        const type = json ? column.data_type : 'text';
        const oldValue = json ? JSON.stringify(row.value) : row.value;
        const newValue = json ? JSON.stringify(changed) : changed;
        const equality = json ? `${field}::jsonb=$3::jsonb` : `${field}::text=$3`;
        const result = await client.query(`UPDATE ${table} SET ${field}=$1::${type} WHERE ctid=$2::tid AND ${equality}`, [newValue, row.locator, oldValue]);
        if (result.rowCount !== 1) throw Error('Concurrent change; rolled back');
        changes[column.table_name] = (changes[column.table_name] ?? 0) + 1;
      }
    }
    const applied = process.argv.includes('--apply');
    await client.query(applied ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify({ applied, mappings: mapping.size, changedFieldsByTable: changes }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(() => { console.error('URL rewrite stopped and rolled back; no sensitive details printed.'); process.exitCode = 1; });
