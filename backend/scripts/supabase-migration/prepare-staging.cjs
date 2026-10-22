const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { inspectExport } = require('./inspect-export.cjs');

const sha256 = text => createHash('sha256').update(text).digest('hex');
// E-strings escape backslashes independently of standard_conforming_strings.
const literal = text => "E'" + text.replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";

function batchSql(runHash, rows, offset = 0) {
  const payload = rows.map((raw, index) => {
    const data = JSON.parse(raw);
    return { path: data.path, source_ordinal: offset + index, source_exists: data.exists, raw_record: raw, record_sha256: sha256(raw) };
  });
  return `begin;
select run_sha256 from arm_migration.runs where run_sha256 = '${runHash}' for update;
insert into arm_migration.source_documents (run_sha256, path, source_ordinal, source_exists, raw_record, record_sha256)
select '${runHash}', path, source_ordinal, source_exists, raw_record, record_sha256
from jsonb_to_recordset(${literal(JSON.stringify(payload))}::jsonb)
as batch(path text, source_ordinal integer, source_exists boolean, raw_record text, record_sha256 text)
on conflict (run_sha256, path) do nothing;
commit;\n`;
}

function verificationSql(hash) {
  return `do $verify$
declare
  expected arm_migration.runs%rowtype;
  actual_documents bigint;
  actual_missing bigint;
  actual_hash text;
begin
  select * into strict expected from arm_migration.runs where run_sha256 = '${hash}' for update;
  select count(*) filter (where source_exists), count(*) filter (where not source_exists)
    into actual_documents, actual_missing from arm_migration.source_documents where run_sha256 = '${hash}';
  if actual_documents <> expected.expected_documents or actual_missing <> expected.expected_missing_parents then
    raise exception 'Source and staging counts differ';
  end if;
  if exists (select 1 from arm_migration.source_documents
    where run_sha256 = '${hash}' and record_sha256 <> encode(sha256(convert_to(raw_record, 'UTF8')), 'hex')) then
    raise exception 'Staging record checksum mismatch';
  end if;
  select encode(sha256(convert_to(coalesce(string_agg(raw_record || E'\\n', '' order by source_ordinal), ''), 'UTF8')), 'hex')
    into actual_hash from arm_migration.source_documents where run_sha256 = '${hash}';
  if actual_hash <> expected.run_sha256 then
    raise exception 'Full export checksum mismatch';
  end if;
  update arm_migration.runs set status = 'verified', verified_at = now() where run_sha256 = '${hash}';
end $verify$;
select status, expected_documents, expected_missing_parents from arm_migration.runs where run_sha256 = '${hash}';\n`;
}

async function prepareStaging(input, targetRef) {
  if (!/^[a-z]{20}$/.test(targetRef)) throw new Error('Invalid Supabase project ref');
  await inspectExport(input);
  const directory = path.resolve(input);
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const output = path.join(directory, 'staging');
  await fs.mkdir(output, { mode: 0o700 });
  const hash = manifest.sha256;
  const begin = `insert into arm_migration.runs
(run_sha256, source_project_id, target_project_ref, expected_documents, expected_missing_parents, manifest)
values ('${hash}', ${literal(manifest.sourceProjectId)}, '${targetRef}', ${manifest.documentCount}, ${manifest.missingParentCount}, ${literal(JSON.stringify(manifest))}::jsonb)
on conflict (run_sha256) do nothing;\n`;
  const steps = [];
  async function writeStep(name, sql, records = 0) {
    await fs.writeFile(path.join(output, name), sql, { flag: 'wx', mode: 0o600 });
    steps.push({ file: name, sha256: sha256(sql), records });
  }
  await writeStep('begin.sql', begin);
  const rows = (await fs.readFile(path.join(directory, 'documents.jsonl'), 'utf8')).trimEnd().split('\n').filter(Boolean);
  let batch = [];
  let bytes = 0;
  let index = 0;
  let offset = 0;
  for (const raw of rows) {
    if (batch.length && bytes + Buffer.byteLength(raw) > 48000) {
      await writeStep(`batch-${String(index++).padStart(5, '0')}.sql`, batchSql(hash, batch, offset), batch.length);
      offset += batch.length;
      batch = []; bytes = 0;
    }
    batch.push(raw); bytes += Buffer.byteLength(raw);
  }
  if (batch.length) await writeStep(`batch-${String(index).padStart(5, '0')}.sql`, batchSql(hash, batch, offset), batch.length);
  await writeStep('verify.sql', verificationSql(hash));
  const plan = { sourceProjectId: manifest.sourceProjectId, targetProjectRef: targetRef, runSha256: hash,
    expectedDocuments: manifest.documentCount, expectedMissingParents: manifest.missingParentCount, steps };
  await fs.writeFile(path.join(output, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return plan;
}

async function main() {
  const { values } = parseArgs({ options: { input: { type: 'string' }, target: { type: 'string' } } });
  if (!values.input || !values.target) throw new Error('--input and --target are required');
  const plan = await prepareStaging(values.input, values.target);
  console.log(JSON.stringify({ target: plan.targetProjectRef, documents: plan.expectedDocuments, steps: plan.steps.length }));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { literal, batchSql, verificationSql, prepareStaging };
