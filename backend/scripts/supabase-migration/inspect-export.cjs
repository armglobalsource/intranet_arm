const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { diagnose } = require('./export-lib.cjs');

async function inspectExport(input) {
  const directory = path.resolve(input);
  const manifest = JSON.parse(await fs.promises.readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'arm-firestore-export-v1') throw new Error('Unsupported export format');
  const filename = path.join(directory, 'documents.jsonl');
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  if (hash.digest('hex') !== manifest.sha256) throw new Error('Checksum mismatch; export has changed');
  const records = [];
  for await (const line of readline.createInterface({ input: fs.createReadStream(filename), crlfDelay: Infinity })) {
    const record = JSON.parse(line);
    if (typeof record.path !== 'string' || !record.path || record.path.split('/').length % 2 !== 0 ||
        record.path.split('/').some(part => !part) || typeof record.exists !== 'boolean' ||
        (record.exists && record.fields?.type !== 'map')) throw new Error('Malformed document record');
    records.push(record);
  }
  if (records.filter(record => record.exists).length !== manifest.documentCount ||
      records.filter(record => !record.exists).length !== manifest.missingParentCount) {
    throw new Error('Manifest counts do not match document records');
  }
  const report = { sourceProjectId: manifest.sourceProjectId, sha256: manifest.sha256,
    generatedAt: new Date().toISOString(), ...diagnose(records) };
  await fs.promises.writeFile(path.join(directory, 'readiness.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  return { report, documentCount: manifest.documentCount };
}

async function main() {
  const { values } = parseArgs({ options: { input: { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help) {
    console.log('node scripts/supabase-migration/inspect-export.cjs --input EXPORT_DIRECTORY');
    return;
  }
  if (!values.input) throw new Error('--input is required');
  const { report, documentCount } = await inspectExport(values.input);
  console.log(`Verified ${documentCount} documents. ${report.issueCount} findings; see readiness.json. Findings require review, not automatic deletion.`);
  if (report.issueCount) process.exitCode = 2;
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { inspectExport };
