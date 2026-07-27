/**
 * Migración: eliminar campo 'icon' de todos los equipos
 * El ícono emoji de equipos ya no se usa en la UI — este script
 * lo borra de todos los documentos en la colección org_teams.
 *
 * Uso: node scripts/migrate-remove-team-icon.js [--dry-run]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

const DRY_RUN = process.argv.includes('--dry-run');

const relKey  = path.resolve(__dirname, '../', process.env.FIREBASE_KEY_FILE || './service-account.json');
const mainKey = '/Users/luisramirezbriones/Developer/ARM/intranet_arm/backend/service-account.json';
const keyFile = fs.existsSync(relKey) ? relKey : mainKey;

admin.initializeApp({ credential: admin.credential.cert(keyFile), projectId: process.env.FIREBASE_PROJECT_ID });
const db = admin.firestore();

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Migración: eliminar campo icon de org_teams${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  const snap = await db.collection('org_teams').get();

  if (snap.empty) {
    console.log('✅ No hay equipos. Nada que hacer.\n');
    process.exit(0);
  }

  const withIcon = snap.docs.filter((doc) => doc.data().icon !== undefined);

  if (withIcon.length === 0) {
    console.log('✅ Ningún equipo tiene campo icon. Nada que hacer.\n');
    process.exit(0);
  }

  console.log(`Equipos con campo icon: ${withIcon.length} de ${snap.docs.length} totales\n`);
  withIcon.forEach((doc) => {
    const d = doc.data();
    console.log(`  id=${d.id} | name="${d.name}" | icon="${d.icon}"`);
  });

  if (!DRY_RUN) {
    // Firestore batch tiene límite de 500 ops; hacemos lotes si hace falta
    const BATCH_SIZE = 400;
    for (let i = 0; i < withIcon.length; i += BATCH_SIZE) {
      const batch = db.batch();
      withIcon.slice(i, i + BATCH_SIZE).forEach((doc) => {
        batch.update(doc.ref, {
          icon:      admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      console.log(`\n  Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${Math.min(BATCH_SIZE, withIcon.length - i)} documentos actualizados`);
    }
    console.log(`\n✅ Campo icon eliminado de ${withIcon.length} equipos\n`);
  } else {
    console.log(`\n[dry-run] Se eliminaría icon de ${withIcon.length} equipos\n`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
