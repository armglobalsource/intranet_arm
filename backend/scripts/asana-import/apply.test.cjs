const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { validatePlan, sums } = require('./apply.cjs');
const raw = Buffer.from('fixture');
const sha = createHash('sha256').update(raw).digest('hex');
function fixture() {
  const records = [{ document_id: 'asana:1185873534171121:123', data: {
    campus: 'Santiago', tipo: 'encuentro', fecha: '2026-10-18', estado: 'enviado',
    asistencia: { auditorio: 10 }, voluntarios: { conexion: 2 }, presencial: {}, online: { espectadores: 3 },
    totalAsistencia: 10, totalVoluntarios: 2,
    source: { provider: 'asana', taskId: '123', csvSha256: sha },
  } }];
  return { version: 1, projectId: '1185873534171121', asOf: '2026-10-25', sourceSha256: sha,
    records, catalog: [{ name: 'Santiago' }], historicalCampuses: [],
    summary: { sourceRows: 1, ready: 1, review: 0, byCampus: sums(records) } };
}
test('accepts consistent plan and keeps online outside attendance', () => {
  const plan = fixture(); validatePlan(plan, raw);
  assert.equal(sums(plan.records).Santiago.attendance, 10);
});
test('rejects changed source', () => assert.throws(() => validatePlan(fixture(), Buffer.from('changed')), /SOURCE_HASH/));
test('rejects repeated task ids', () => {
  const plan = fixture(); plan.records.push(plan.records[0]); plan.summary.ready = plan.summary.sourceRows = 2;
  assert.throws(() => validatePlan(plan, raw), /BAD_SOURCE_ID/);
});
test('rejects corrupt totals and nonintegral metrics', () => {
  let plan = fixture(); plan.records[0].data.totalAsistencia = 100;
  assert.throws(() => validatePlan(plan, raw), /BAD_ATTENDANCE_TOTAL/);
  plan = fixture(); plan.records[0].data.voluntarios.conexion = 2.5;
  assert.throws(() => validatePlan(plan, raw), /BAD_METRIC/);
});
test('rejects invalid and future dates', () => {
  for (const day of ['2026-02-30', '2026-10-26']) {
    const plan = fixture(); plan.records[0].data.fecha = day;
    assert.throws(() => validatePlan(plan, raw), /BAD_DATE/);
  }
});
test('accepts month-only reports and rejects inconsistent precision', () => {
  const monthOnly = plan => Object.assign(plan.records[0].data, { fecha: '2021-09-01', fechaPrecision: 'mes', periodo: '2021-09' }) &&
    Object.assign(plan.records[0].data.source, { dateRule: 'month_from_section', originalDate: '2022-04-05' });
  let plan = fixture(); monthOnly(plan); validatePlan(plan, raw);
  plan = fixture(); monthOnly(plan); plan.records[0].data.periodo = '2021-10';
  assert.throws(() => validatePlan(plan, raw), /BAD_MONTH_ONLY/);
  plan = fixture(); monthOnly(plan); plan.records[0].data.fecha = '2021-09-15';
  assert.throws(() => validatePlan(plan, raw), /BAD_MONTH_ONLY/);
  plan = fixture(); monthOnly(plan); delete plan.records[0].data.source.dateRule;
  assert.throws(() => validatePlan(plan, raw), /BAD_MONTH_ONLY/);
  plan = fixture(); plan.records[0].data.fechaPrecision = 'semana';
  assert.throws(() => validatePlan(plan, raw), /BAD_DATE_PRECISION/);
  plan = fixture(); plan.records[0].data.periodo = '2026-10';
  assert.throws(() => validatePlan(plan, raw), /BAD_MONTH_ONLY/);
});
test('rejects wrong status or campus', () => {
  let plan = fixture(); plan.records[0].data.estado = 'pendiente';
  assert.throws(() => validatePlan(plan, raw), /BAD_STATUS/);
  plan = fixture(); plan.records[0].data.campus = 'Unknown';
  assert.throws(() => validatePlan(plan, raw), /BAD_SOURCE/);
});
