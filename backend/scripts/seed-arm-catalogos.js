/**
 * Seed: crea las entradas iniciales de los catálogos ARM (asistencia, voluntarios, moneda)
 * en la colección Firestore `arm_catalogos`, usando exactamente las claves ya hardcodeadas
 * hoy en AsistenciaDto/VoluntariosDto (backend) y currencies.ts (PWA arm-mobile).
 *
 * Uso: node scripts/seed-arm-catalogos.js
 *
 * Es idempotente: si una entrada (tipo, key) ya existe, se salta.
 */
require('dotenv').config({ path: '.env' });
const admin = require('firebase-admin');
const path  = require('path');

const keyFile = path.resolve(process.env.FIREBASE_KEY_FILE || './service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(keyFile),
  projectId:  process.env.FIREBASE_PROJECT_ID,
});
const db  = admin.firestore();
const COL = 'arm_catalogos';

async function nextId(collection) {
  const ref = db.collection('_counters').doc(collection);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = snap.exists ? snap.data().next : 1;
    tx.set(ref, { next: next + 1 });
    return next;
  });
}

// ── Datos a sembrar (key = valor persistido, label = texto visible) ────────────

const ASISTENCIA = [
  ['auditorio', 'Auditorio'],
  ['kids',      'Kids'],
  ['tweens',    'Tweens'],
  ['bebe',      'Bebé'],
  ['sensorial', 'Sensorial'],
  ['cambios',   'Cambios'],
];

const VOLUNTARIOS = [
  ['servicio',   'Servicio'],
  ['tecnica',    'Técnica'],
  ['kids',       'Kids'],
  ['tweens',     'Tweens'],
  ['worship',    'Worship'],
  ['cocina',     'Cocina'],
  ['rrss',       'RRSS'],
  ['seguridad',  'Seguridad'],
  ['sala_bebes', 'Sala de bebés'],
  ['conexion',   'Conexión'],
  ['oracion',    'Oración'],
  ['merch',      'Merch'],
  ['amor',       'Amor'],
  ['sensorial',  'Sensorial'],
  ['siembra',    'Siembra'],
  ['cambios',    'Cambios'],
];

const MONEDAS = [
  ['CLP', 'Peso chileno'],
  ['USD', 'Dólar'],
  ['ARS', 'Peso argentino'],
  ['UYU', 'Peso uruguayo'],
  ['VES', 'Bolívar'],
];

async function seed(tipo, entries) {
  const existing = await db.collection(COL).where('tipo', '==', tipo).get();
  const existingKeys = new Set(existing.docs.map((d) => d.data().keyLower));

  let inserted = 0;
  for (let i = 0; i < entries.length; i++) {
    const [key, label] = entries[i];
    const keyLower = key.toLowerCase();
    if (existingKeys.has(keyLower)) continue;

    const id = await nextId(COL);
    await db.collection(COL).doc(String(id)).set({
      id, tipo, key, keyLower, label,
      sortOrder: i,
      isActive:  true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    inserted++;
  }
  console.log(`  ✓ ${tipo}: ${inserted} insertadas, ${entries.length - inserted} ya existían`);
}

async function main() {
  console.log('📥  Sembrando catálogos ARM...');
  await seed('asistencia',  ASISTENCIA);
  await seed('voluntarios', VOLUNTARIOS);
  await seed('moneda',      MONEDAS);
  console.log('🎉  Seed completado.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Error:', err);
  process.exit(1);
});
