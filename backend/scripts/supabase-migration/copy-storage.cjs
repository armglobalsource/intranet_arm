// Explicit source/destination, no deletions. Backups and manifest stay ignored.
// First run --backup-only. Transfer requires SUPABASE_URL/SUPABASE_SECRET_KEY.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');
const { Storage } = require('@google-cloud/storage');
const { createClient } = require('@supabase/supabase-js');
const hash = buffer => createHash('sha256').update(buffer).digest('hex');

async function main() {
  const { values } = parseArgs({ options: {
    'source-bucket': { type: 'string' }, 'target-bucket': { type: 'string' },
    credentials: { type: 'string' }, output: { type: 'string' },
    'backup-only': { type: 'boolean' },
  } });
  if (!values['source-bucket'] || !values.credentials || !values.output) throw new Error('Arguments required');
  const backupOnly = values['backup-only'];
  if (!backupOnly && (!values['target-bucket'] || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)) throw new Error('Destination required');
  const credentials = JSON.parse(await fs.readFile(path.resolve(values.credentials), 'utf8'));
  const storage = new Storage({ projectId: credentials.project_id, credentials });
  const supabase = backupOnly ? null : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const directory = path.resolve(values.output);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const [files] = await storage.bucket(values['source-bucket']).getFiles();
  const manifest = [];
  for (const file of files) {
    // Pin each read to the generation that was listed to detect source changes.
    const [buffer] = await file.bucket.file(file.name, { generation: file.metadata.generation }).download({ validation: 'crc32c' });
    const sha256 = hash(buffer);
    await fs.writeFile(path.join(directory, sha256), buffer, { mode: 0o600 });
    const record = { sourceBucket: values['source-bucket'], key: file.name, generation: file.metadata.generation,
      sha256, size: buffer.length, contentType: file.metadata.contentType ?? 'application/octet-stream', verified: false };
    if (supabase) {
      const target = supabase.storage.from(values['target-bucket']);
      let existing = await target.download(file.name);
      if (existing.error) {
        // Never overwrite an existing target object. Any real error fails upload.
        const uploaded = await target.upload(file.name, buffer, { contentType: record.contentType, upsert: false });
        if (uploaded.error) throw new Error('Storage upload failed');
        existing = await target.download(file.name);
      }
      if (existing.error || hash(Buffer.from(await existing.data.arrayBuffer())) !== sha256) throw new Error('Target verification failed');
      record.verified = true;
      record.targetBucket = values['target-bucket'];
    }
    manifest.push(record);
  }
  await fs.writeFile(path.join(directory, backupOnly ? 'backup-manifest.json' : 'verified-manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ files: manifest.length, bytes: manifest.reduce((n, f) => n + f.size, 0), transferred: !backupOnly, verified: manifest.filter(f => f.verified).length }));
}
main().catch(() => { console.error('Storage copy stopped; source files untouched. Check credentials, permissions and target integrity.'); process.exitCode = 1; });
