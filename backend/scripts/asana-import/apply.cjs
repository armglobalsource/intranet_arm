// Append-only historical import. Dry-run by default; all writes share one transaction.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
require('dotenv').config({ path: path.join(__dirname, '../../.env.supabase'), quiet: true });
require('ts-node/register/transpile-only');
const { Pool } = require('pg');
const { buildPostgresOptions } = require('../../src/common/database/postgres-options');

const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
function check(condition, code) { if (!condition) throw new Error(code); }
function sums(records) {
  const result = {};
  for (const { data: d } of records) {
    const r = result[d.campus] ??= { records: 0, attendance: 0, volunteers: 0, decisions: 0, onlineViewers: 0 };
    r.records++; r.attendance += d.totalAsistencia; r.volunteers += d.totalVoluntarios;
    r.decisions += (d.presencial.acepto ?? 0) + (d.online.acepto ?? 0);
    r.onlineViewers += d.online.espectadores ?? 0;
  }
  return result;
}
function validatePlan(plan, rawSource) {
  check(plan.version === 1 && plan.projectId === '1185873534171121', 'WRONG_SOURCE_PROJECT');
  check(hash(rawSource) === plan.sourceSha256, 'SOURCE_HASH_MISMATCH');
  check(plan.records.length === plan.summary.ready && plan.summary.sourceRows === plan.summary.ready + plan.summary.review, 'COUNT_MISMATCH');
  const ids = new Set();
  const known = new Set([...plan.catalog, ...plan.historicalCampuses].map(c => c.name));
  for (const { document_id: id, data: d } of plan.records) {
    check(id === `asana:${plan.projectId}:${d.source.taskId}` && /^\d+$/.test(d.source.taskId) && !ids.has(id), 'BAD_SOURCE_ID'); ids.add(id);
    check(d.source.provider === 'asana' && d.source.csvSha256 === plan.sourceSha256 && known.has(d.campus), 'BAD_SOURCE');
    check(d.estado === 'enviado' && ['encuentro', 'evento'].includes(d.tipo), 'BAD_STATUS');
    check(/^\d{4}-\d{2}-\d{2}$/.test(d.fecha) && new Date(`${d.fecha}T00:00:00Z`).toISOString().slice(0, 10) === d.fecha && d.fecha <= plan.asOf, 'BAD_DATE');
    // Reportes de solo mes: la fecha es el primer día del período y nunca se usa como día real.
    check(d.fechaPrecision === undefined || d.fechaPrecision === 'mes', 'BAD_DATE_PRECISION');
    if (d.fechaPrecision === 'mes') {
      check(/^\d{4}-\d{2}$/.test(d.periodo) && d.fecha === `${d.periodo}-01` && d.source.dateRule === 'month_from_section' && /^\d{4}-\d{2}-\d{2}$/.test(d.source.originalDate), 'BAD_MONTH_ONLY');
    } else {
      check(d.periodo === undefined && d.source.dateRule === undefined, 'BAD_MONTH_ONLY');
    }
    for (const group of ['asistencia', 'voluntarios', 'presencial', 'online']) {
      for (const value of Object.values(d[group])) check(Number.isSafeInteger(value) && value >= 0, 'BAD_METRIC');
    }
    check(d.totalAsistencia === Object.values(d.asistencia).reduce((a,b) => a+b, 0), 'BAD_ATTENDANCE_TOTAL');
    check(d.totalVoluntarios === Object.values(d.voluntarios).reduce((a,b) => a+b, 0), 'BAD_VOLUNTEER_TOTAL');
  }
  assert.deepStrictEqual(sums(plan.records), plan.summary.byCampus);
}
async function main() {
  const args = process.argv.slice(2);
  const file = args[0];
  check(file, 'PLAN_REQUIRED');
  const bytes = fs.readFileSync(file), sha = hash(bytes), plan = JSON.parse(bytes);
  const apply = args.includes('--apply');
  const shaIndex = args.indexOf('--sha256');
  check(!apply || (shaIndex >= 0 && args[shaIndex+1] === sha), 'REVIEWED_PLAN_HASH_REQUIRED');
  validatePlan(plan, fs.readFileSync(path.join(path.dirname(file), 'source.csv')));
  check(process.env.DATABASE_URL, 'DATABASE_URL_MISSING');
  const connection = new URL(process.env.DATABASE_URL);
  check(`${connection.hostname}/${connection.username}`.includes('kqqufmijfvrgzrfrqsby'), 'WRONG_TARGET_PROJECT');
  // Offline reconciliation can read the whole historical batch; keep API timeouts unchanged.
  // Con un enlace lento a la base (decenas de KB/s) la lectura completa del histórico supera 60 s:
  // ASANA_IMPORT_TIMEOUT_MS lo amplía. Sin la variable el límite sigue siendo de 60 s.
  const timeout = Math.max(60000, Number(process.env.ASANA_IMPORT_TIMEOUT_MS) || 0);
  const pool = new Pool({ ...buildPostgresOptions(process.env.DATABASE_URL, process.env.DATABASE_CA_CERT),
    statement_timeout: timeout, query_timeout: timeout + 5000 });
  pool.on('error', () => {});
  const client = await pool.connect();
  try {
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
    if (apply) {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query('LOCK TABLE arm_app.campuses, arm_app.encuentros IN SHARE ROW EXCLUSIVE MODE');
    }
    const catalog = (await client.query('SELECT id,name,country,"isActive" FROM arm_app.campuses')).rows;
    for (const expected of plan.catalog) {
      const actual = catalog.find(c => Number(c.id) === expected.id);
      check(actual && actual.name === expected.name && actual.country === expected.country, 'CAMPUS_CATALOG_CHANGED');
    }
    const created = [];
    for (const c of plan.historicalCampuses) {
      check(c.isActive === false && ['Miami','Oriente','Virtual'].includes(c.name), 'BAD_HISTORICAL_CAMPUS');
      const matches = catalog.filter(x => normalize(x.name) === normalize(c.name));
      check(matches.length <= 1, 'AMBIGUOUS_CAMPUS');
      if (matches.length) {
        // A campus can be reactivated after import. Preserve its current operational status.
        check(matches[0].country === c.country, 'HISTORICAL_CAMPUS_CHANGED');
      } else if (apply) {
        const row = (await client.query(`WITH identity AS (SELECT nextval(pg_get_serial_sequence('arm_app.campuses','id')) AS id)
          INSERT INTO arm_app.campuses (id,document_id,name,"nameLower",country,"isActive",description,"createdAt","updatedAt")
          SELECT id,id::text,$1,$2,$3,false,'Campus histórico importado desde Asana',now(),now() FROM identity
          RETURNING id,name,country,"isActive"`, [c.name, normalize(c.name), c.country])).rows[0];
        catalog.push(row); created.push(row);
      } else {
        catalog.push({ ...c, id: null }); created.push(c);
      }
    }
    const existing = (await client.query('SELECT document_id,data FROM arm_app.encuentros')).rows;
    const index = new Map(existing.map(r => [r.document_id, r.data]));
    const eventKey = d => [normalize(d.campus), String(d.fecha).slice(0,10), normalize(d.encuentro)].join('|');
    // Los reportes de solo mes comparten primer día y nombre: se identifican por su tarea, no por campus/fecha/nombre.
    const existingKeys = new Map(existing.filter(r => r.data.fechaPrecision !== 'mes').map(r => [eventKey(r.data), r.document_id]));
    const toInsert = [], target = [];
    for (const row of plan.records) {
      const matches = catalog.filter(c => c.name === row.data.campus);
      check(matches.length === 1, 'CAMPUS_NOT_RESOLVED');
      const mapped = { ...row, data: { ...row.data, campusId: matches[0].id == null ? null : Number(matches[0].id) } };
      target.push(mapped);
      if (index.has(row.document_id)) {
        assert.deepStrictEqual(index.get(row.document_id), mapped.data, 'EXISTING_RECORD_CHANGED');
      } else {
        check(mapped.data.fechaPrecision === 'mes' || !existingKeys.has(eventKey(mapped.data)), 'POSSIBLE_EXISTING_DUPLICATE');
        toInsert.push(mapped);
      }
    }
    // Save a local rollback baseline before any record insertion, never commit private data to Git.
    if (apply) {
      const baseline = path.join(path.dirname(file), `before-${sha.slice(0,12)}.json`);
      if (!fs.existsSync(baseline)) fs.writeFileSync(baseline, JSON.stringify({ existing, created }), { flag: 'wx' });
      for (let i = 0; i < toInsert.length; i += 200) {
        await client.query(`INSERT INTO arm_app.encuentros (document_id,data)
          SELECT document_id,data FROM jsonb_to_recordset($1::jsonb) AS x(document_id text,data jsonb)`, [JSON.stringify(toInsert.slice(i,i+200))]);
      }
      const actual = (await client.query('SELECT document_id,data FROM arm_app.encuentros WHERE document_id=ANY($1::text[])', [target.map(r => r.document_id)])).rows;
      check(actual.length === target.length, 'RECONCILIATION_COUNT_FAILED');
      const actualById = new Map(actual.map(r => [r.document_id, r.data]));
      for (const row of target) assert.deepStrictEqual(actualById.get(row.document_id), row.data, 'RECONCILIATION_DATA_FAILED');
      assert.deepStrictEqual(sums(actual), plan.summary.byCampus, 'RECONCILIATION_TOTALS_FAILED');
      const count = Number((await client.query('SELECT count(*) AS n FROM arm_app.encuentros')).rows[0].n);
      check(count === existing.length + toInsert.length, 'UNEXPECTED_RECORD_COUNT');
    }
    await client.query('COMMIT');
    const result = { mode: apply ? 'applied' : 'dry-run', planSha256: sha, sourceRows: plan.summary.sourceRows,
      prepared: target.length, inserted: apply ? toInsert.length : 0, wouldInsert: toInsert.length,
      alreadyPresent: target.length - toInsert.length, heldForReview: plan.summary.review, historicalCampuses: created,
      totals: plan.summary.byCampus };
    fs.writeFileSync(path.join(path.dirname(file), apply ? 'applied.json' : 'dry-run.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); await pool.end(); }
}
module.exports = { validatePlan, sums };
if (require.main === module) main().catch(error => {
  // Never emit credentials, SQL parameters or full rows from an assertion failure.
  const code = /^[A-Z_0-9]+$/.test(error.message ?? '') ? error.message : /^[A-Z_0-9]+$/.test(error.code ?? '') ? error.code : 'IMPORT_FAILED';
  console.error(code); process.exitCode = 1;
});
