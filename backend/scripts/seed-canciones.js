/**
 * Seed: importa las canciones desde Google Sheets a la colección Firestore `canciones`.
 * Uso: node scripts/seed-canciones.js
 *
 * Es idempotente: usa el título normalizado como ID, por lo que puede ejecutarse
 * varias veces sin crear duplicados.
 */
require('dotenv').config({ path: '.env' });
const admin  = require('firebase-admin');
const https  = require('https');
const path   = require('path');

// ── Firebase init ──────────────────────────────────────────────────────────────
const keyFile = path.resolve(process.env.FIREBASE_KEY_FILE || './service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(keyFile),
  projectId:  process.env.FIREBASE_PROJECT_ID,
});
const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeTitle(titulo) {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function slugify(titulo) {
  return normalizeTitle(titulo)
    .replace(/[^a-z0-9\s\/]/g, '')
    .replace(/\s+/g, '-')
    .replace(/\//g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function fetchCSV(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Seguir redirecciones
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchCSV(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseCSV(csv) {
  const lines  = csv.split('\n').map(l => l.trim()).filter(Boolean);
  const header = lines[0];
  const rows   = lines.slice(1);

  return rows.map(line => {
    // Manejo básico de CSV con comillas (para BPMs con coma decimal como "88,5")
    const cols = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1mm3UWfWt9JzNfFUQ2cQQP2HqQuHZmF73yO8sv-KTx9M/export?format=csv&gid=0';

  console.log('📥  Descargando spreadsheet...');
  const csv  = await fetchCSV(SHEET_URL);
  const rows = parseCSV(csv);

  // Columnas: Nombre(0), Tipo(1), ?(2), ?(3), BPM(4), Compas(5)
  const canciones = rows
    .filter(r => r[0] && r[0] !== 'Nombre')  // saltar filas vacías o header duplicado
    .map(r => {
      const titulo  = r[0].trim();
      const tipo    = r[1] ? r[1].replace(/[⚡✨]/g, '').trim() : '';
      const bpmRaw  = r[4] ? r[4].replace(',', '.') : '';
      const bpm     = bpmRaw ? parseFloat(bpmRaw) : null;
      const compas  = r[5] ? r[5].trim() : '';

      return {
        cancionId:  slugify(titulo) || normalizeTitle(titulo).replace(/\s/g, '-'),
        titulo,
        tituloNorm: normalizeTitle(titulo),
        tonalidad:  '',
        tipo:       tipo || null,
        bpm:        bpm  || null,
        compas:     compas || null,
        usageCount: 0,
        createdAt:  admin.firestore.FieldValue.serverTimestamp(),
      };
    })
    .filter(c => c.titulo.length > 0);

  console.log(`📋  ${canciones.length} canciones parseadas`);

  // Verificar cuáles ya existen
  const colRef = db.collection('canciones');
  const snap   = await colRef.get();
  const existing = new Set(snap.docs.map(d => d.id));
  const toInsert = canciones.filter(c => !existing.has(c.cancionId));
  const toSkip   = canciones.length - toInsert.length;

  console.log(`⏭️   ${toSkip} ya existen, ${toInsert.length} nuevas a insertar`);

  if (!toInsert.length) {
    console.log('✅  Nada que insertar. Colección ya está actualizada.');
    process.exit(0);
  }

  // Batch write (Firestore permite máx 500 por batch)
  const BATCH_SIZE = 400;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toInsert.slice(i, i + BATCH_SIZE);
    for (const c of chunk) {
      batch.set(colRef.doc(c.cancionId), c);
    }
    await batch.commit();
    inserted += chunk.length;
    console.log(`  ✓ ${inserted}/${toInsert.length} insertadas`);
  }

  console.log(`\n🎉  Seed completado: ${inserted} canciones insertadas en Firestore.`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌  Error:', err);
  process.exit(1);
});
