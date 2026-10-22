const fs = require('node:fs/promises');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { exportDatabase } = require('./export-lib.cjs');

async function main() {
  const { values } = parseArgs({ options: {
    project: { type: 'string' }, output: { type: 'string' },
    credentials: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('node scripts/supabase-migration/export-firestore.cjs --project FIREBASE_PROJECT_ID --output DIRECTORY [--credentials FILE]');
    return;
  }
  if (!values.project || !values.output) throw new Error('--project and --output are required; no implicit source project');
  if (process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Unset FIRESTORE_EMULATOR_HOST before a migration export');
  const admin = require('firebase-admin');
  const credential = values.credentials
    ? admin.credential.cert(JSON.parse(await fs.readFile(path.resolve(values.credentials), 'utf8')))
    : admin.credential.applicationDefault();
  const app = admin.initializeApp({ projectId: values.project, credential }, 'supabase-migration-export');
  let output;
  try {
    const directory = path.resolve(values.output);
    // Refuse to overwrite even an incomplete earlier export.
    await fs.mkdir(directory, { mode: 0o700 });
    output = await fs.open(path.join(directory, 'documents.jsonl'), 'wx', 0o600);
    const startedAt = new Date().toISOString();
    console.log(`Reading Firestore project ${values.project}. Keep source writes paused for a consistent final export.`);
    const summary = await exportDatabase(admin.firestore(app), line => output.writeFile(line), admin.firestore);
    await output.close();
    output = undefined;
    const manifest = { format: 'arm-firestore-export-v1', sourceProjectId: values.project,
      startedAt, completedAt: new Date().toISOString(), consistency: 'live-traversal', ...summary };
    // A complete manifest is written only after all reads and data writes succeed.
    await fs.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.log(`Export complete: ${summary.documentCount} documents, ${summary.missingParentCount} missing parents. Run db:inspect before import.`);
  } finally {
    if (output) await output.close();
    await app.delete();
  }
}

main().catch(() => {
  // SDK errors can include connection or document details; avoid printing them.
  console.error('Export failed. Verify arguments, output directory, Firebase credentials and read access. Any directory without a manifest is incomplete.');
  process.exitCode = 1;
});
