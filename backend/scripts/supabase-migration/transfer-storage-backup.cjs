// Copy a verified local backup; publish only referenced objects already readable
// anonymously at their original unsigned Google URL. Never overwrite objects.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '../../.env.storage.local'), quiet: true });
const hash = value => createHash('sha256').update(value).digest('hex');
async function main() {
  const root = path.resolve(__dirname, '../../../migration-artifacts');
  const backup = path.join(root, 'storage-production-2026-10-21');
  const files = JSON.parse(await fs.readFile(path.join(backup, 'backup-manifest.json'), 'utf8'));
  const inventory = JSON.parse(await fs.readFile(path.join(root, 'storage-inventory.json'), 'utf8'));
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const results = [];
  const sourceBucket = 'intranet-arm.firebasestorage.app';
  for (const file of files) {
    if (file.sourceBucket !== sourceBucket) throw Error('Unexpected source bucket');
    const bytes = await fs.readFile(path.join(backup, file.sha256));
    if (hash(bytes) !== file.sha256 || bytes.length !== file.size) throw Error('Backup integrity');
    const sourcePath = `/${sourceBucket}/${file.key}`;
    const refs = inventory.filter(item => {
      const url = new URL(item.url);
      return url.hostname === 'storage.googleapis.com' && decodeURIComponent(url.pathname) === sourcePath;
    });
    let publiclyReadable = false;
    if (refs.length) {
      // Strip signed query parameters and verify the actual anonymous content.
      const unsigned = new URL(refs[0].url); unsigned.search = ''; unsigned.hash = '';
      const response = await fetch(unsigned, { signal: AbortSignal.timeout(30000) });
      publiclyReadable = response.ok && hash(Buffer.from(await response.arrayBuffer())) === file.sha256;
    }
    const targetBucket = publiclyReadable ? 'arm-public' : 'arm-documents';
    const targetKey = publiclyReadable ? file.key : `legacy-backup/${file.key}`;
    const target = client.storage.from(targetBucket);
    let download = await target.download(targetKey);
    if (download.error) {
      const uploaded = await target.upload(targetKey, bytes, { contentType: file.contentType, upsert: false });
      if (uploaded.error) throw Error('Upload failed');
      download = await target.download(targetKey);
    }
    if (download.error || hash(Buffer.from(await download.data.arrayBuffer())) !== file.sha256) throw Error('Destination integrity');
    results.push({ ...file, targetBucket, targetKey, verified: true,
      oldUrls: refs.map(item => item.url),
      newUrl: publiclyReadable ? target.getPublicUrl(targetKey).data.publicUrl : null });
    await fs.writeFile(path.join(root, 'storage-transfer-verified.json'), JSON.stringify(results, null, 2), { mode: 0o600 });
  }
  console.log(JSON.stringify({ copied: results.length, public: results.filter(r => r.newUrl).length,
    private: results.filter(r => !r.newUrl).length,
    referencedPrivate: results.filter(r => !r.newUrl && r.oldUrls.length).length }));
}
main().catch(() => { console.error('Transfer stopped; source untouched. Inspect configuration and integrity without printing credentials.'); process.exitCode = 1; });
