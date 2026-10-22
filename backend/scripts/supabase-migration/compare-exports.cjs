const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { values } = parseArgs({ options: { before: { type: 'string' }, after: { type: 'string' } } });
function load(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const data = fs.readFileSync(path.join(directory, 'documents.jsonl'));
  if (createHash('sha256').update(data).digest('hex') !== manifest.sha256) throw new Error('Export checksum mismatch');
  const rows = data.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  // Snapshot read timestamps differ on every export; compare actual data only.
  return { manifest, rows: new Map(rows.map(row => [row.path, JSON.stringify({ exists: row.exists, fields: row.fields })])) };
}
try {
  if (!values.before || !values.after) throw new Error('Both directories required');
  const before = load(values.before), after = load(values.after);
  if (before.manifest.sourceProjectId !== after.manifest.sourceProjectId) throw new Error('Different source projects');
  const counts = {};
  const changes = [];
  for (const key of new Set([...before.rows.keys(), ...after.rows.keys()])) {
    const type = !before.rows.has(key) ? 'added' : !after.rows.has(key) ? 'removed' : before.rows.get(key) !== after.rows.get(key) ? 'changed' : null;
    if (!type) continue;
    const collection = key.split('/')[0];
    counts[collection] ??= { added: 0, removed: 0, changed: 0 };
    counts[collection][type]++;
    changes.push({ path: key, type });
  }
  fs.writeFileSync(path.join(values.after, 'changes.json'), JSON.stringify(changes, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ source: after.manifest.sourceProjectId, changes: changes.length, collections: counts }));
} catch { console.error('Comparison failed; verify directories, manifests and source project.'); process.exitCode = 1; }
