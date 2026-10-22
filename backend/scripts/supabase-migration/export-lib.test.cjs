const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { encode, plain, exportDatabase, diagnose } = require('./export-lib.cjs');
const { inspectExport } = require('./inspect-export.cjs');
const { literal, prepareStaging } = require('./prepare-staging.cjs');

class Timestamp {
  constructor(seconds, nanoseconds) { Object.assign(this, { seconds, nanoseconds }); }
}

test('preserves nanoseconds, byte values, special numbers and user maps without tag collisions', () => {
  const result = encode({ at: new Timestamp(1700000000, 123456789),
    nested: [{ type: 'timestamp', value: 'user content' }],
    bytes: Buffer.from([0, 255]), nan: NaN, infinity: Infinity, zero: -0 }, { Timestamp });
  assert.deepEqual(result.value.at, { type: 'timestamp', seconds: 1700000000, nanoseconds: 123456789 });
  assert.deepEqual(plain(result).nested, [{ type: 'timestamp', value: 'user content' }]);
  assert.equal(result.value.bytes.base64, 'AP8=');
  assert.equal(result.value.nan.value, 'NaN');
  assert.equal(result.value.infinity.value, 'Infinity');
  assert.equal(result.value.zero.value, '-0');
  assert.throws(() => encode(new Date()), /Unsupported/);
});

function record(documentPath, fields) {
  return { path: documentPath, exists: true, fields: encode(fields) };
}

test('exports descendants of missing parents and hashes the exact JSONL bytes', async () => {
  function ref(documentPath, data, children = []) {
    const doc = { path: documentPath, listCollections: async () => children };
    doc.snapshot = { ref: doc, exists: data !== undefined, data: () => data };
    return doc;
  }
  const change = ref('fichas/missing/changelog/entry1', { note: 'retained' });
  const missing = ref('fichas/missing', undefined, [
    { path: 'fichas/missing/changelog', listDocuments: async () => [change] },
  ]);
  const live = ref('fichas/existing', { title: 'Live ficha' });
  const db = { listCollections: async () => [{ path: 'fichas', listDocuments: async () => [missing, live] }],
    getAll: async (...refs) => refs.map(item => item.snapshot) };
  let output = '';
  const summary = await exportDatabase(db, async line => { output += line; });
  assert.equal(summary.documentCount, 2);
  assert.equal(summary.missingParentCount, 1);
  assert.equal(summary.sha256, createHash('sha256').update(output).digest('hex'));
  assert.equal(JSON.parse(output.trim().split('\n')[1]).path, change.path);
});

test('flags normalized email duplicates, mixed field types and unresolved references', () => {
  const result = diagnose([
    record('users/1', { email: 'USER@example.org', campusId: 5 }),
    record('users/2', { email: ' user@example.org ', campusId: '5', roleId: 9 }),
    record('campuses/5', { name: 'Campus' }),
  ]);
  assert.equal(result.issues.filter(issue => issue.kind === 'duplicate_business_key').length, 1);
  assert.deepEqual(result.collections.users.fields.campusId, { number: 1, string: 1 });
  assert.equal(result.issues.filter(issue => issue.kind === 'unresolved_reference').length, 1);
  assert.equal(JSON.stringify(result).includes('USER@example.org'), false);
});

test('availability keys include campus; missing key fields are not mistaken for duplicates', () => {
  const result = diagnose([
    record('users/1', {}), record('campuses/5', {}), record('campuses/6', {}),
    record('disponibilidades/1', { userId: 1, campusId: 5, weekLabel: '2026-W43', scheduleKey: 'sun' }),
    record('disponibilidades/2', { userId: 1, campusId: 6, weekLabel: '2026-W43', scheduleKey: 'sun' }),
    record('disponibilidades/3', { userId: '1', campusId: '5', weekLabel: '2026-W43', scheduleKey: 'sun' }),
    record('disponibilidades/4', { userId: 1 }),
  ]);
  assert.equal(result.issues.filter(issue => issue.kind === 'duplicate_business_key').length, 1);
  assert.equal(result.issues.filter(issue => issue.kind === 'incomplete_unique_key').length, 2); // users email + incomplete slot
  assert.throws(() => diagnose([record('users/1', {}), record('users/1', {})]), /Repeated/);
});

test('inspector accepts an intact export and rejects modified data before writing a report', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-migration-test-'));
  try {
    const data = JSON.stringify(record('campuses/1', { name: 'Test' })) + '\n';
    const manifest = { format: 'arm-firestore-export-v1', sourceProjectId: 'test-project',
      documentCount: 1, missingParentCount: 0, sha256: createHash('sha256').update(data).digest('hex') };
    await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    await fs.writeFile(path.join(directory, 'documents.jsonl'), data);
    assert.equal((await inspectExport(directory)).documentCount, 1);
    assert.equal(JSON.parse(await fs.readFile(path.join(directory, 'readiness.json'), 'utf8')).issueCount, 0);
    const plan = await prepareStaging(directory, 'kqqufmijfvrgzrfrqsby');
    assert.equal(plan.expectedDocuments, 1);
    assert.equal(plan.steps.reduce((count, step) => count + step.records, 0), 1);
    const batch = await fs.readFile(path.join(directory, 'staging', 'batch-00000.sql'), 'utf8');
    assert.match(batch, /source_ordinal/);
    const verification = await fs.readFile(path.join(directory, 'staging', 'verify.sql'), 'utf8');
    assert.match(verification, /Full export checksum mismatch/);
    await assert.rejects(prepareStaging(directory, 'not-a-project'), /Invalid/);
    await fs.writeFile(path.join(directory, 'documents.jsonl'), data + '\n');
    await assert.rejects(inspectExport(directory), /Checksum mismatch/);
  } finally {
    // Only remove the exact directory created by mkdtemp in this test.
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith('arm-migration-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('SQL literals escape both quotes and backslashes including attempted statement injection', () => {
  assert.equal(literal("a'b\\c"), "E'a''b\\\\c'");
  assert.equal(literal("'); drop table users; --"), "E'''); drop table users; --'");
});
