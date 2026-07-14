/**
 * Backfill: rellena asistenciaCategoriaKeys / voluntarioCategoriaKeys / monedaCodes
 * en los documentos de `campuses` creados antes de existir el mantenedor de Catálogos ARM.
 *
 * Cada campus queda con TODAS las claves activas del catálogo correspondiente (mismo
 * default que usa CampusService.create() para campus nuevos) — preserva el comportamiento
 * actual (todo campus usa implícitamente todas las categorías) sin requerir acción manual.
 *
 * Uso: node scripts/backfill-campus-catalog-keys.js
 * Correr DESPUÉS de scripts/seed-arm-catalogos.js.
 * Es idempotente: solo toca campus a los que les falte alguno de los 3 campos.
 */
require('dotenv').config({ path: '.env' });
const admin = require('firebase-admin');
const path  = require('path');

const keyFile = path.resolve(process.env.FIREBASE_KEY_FILE || './service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(keyFile),
  projectId:  process.env.FIREBASE_PROJECT_ID,
});
const db = admin.firestore();

async function activeKeys(tipo) {
  const snap = await db.collection('arm_catalogos')
    .where('tipo', '==', tipo).where('isActive', '==', true).get();
  return snap.docs.map((d) => d.data().key);
}

async function main() {
  const [asistencia, voluntarios, moneda] = await Promise.all([
    activeKeys('asistencia'),
    activeKeys('voluntarios'),
    activeKeys('moneda'),
  ]);

  if (!asistencia.length && !voluntarios.length && !moneda.length) {
    console.error('❌  No hay entradas en arm_catalogos. Corre primero scripts/seed-arm-catalogos.js');
    process.exit(1);
  }

  const snap = await db.collection('campuses').get();
  let touched = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const missing = data.asistenciaCategoriaKeys === undefined
      || data.voluntarioCategoriaKeys === undefined
      || data.monedaCodes === undefined;
    if (!missing) continue;

    await doc.ref.update({
      asistenciaCategoriaKeys: data.asistenciaCategoriaKeys ?? asistencia,
      voluntarioCategoriaKeys: data.voluntarioCategoriaKeys ?? voluntarios,
      monedaCodes:             data.monedaCodes             ?? moneda,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    touched++;
    console.log(`  ✓ ${data.name} (id ${data.id})`);
  }

  console.log(`\n🎉  Backfill completado: ${touched}/${snap.size} campus actualizados.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Error:', err);
  process.exit(1);
});
