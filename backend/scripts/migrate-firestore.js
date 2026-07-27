/**
 * Migra todas las colecciones de Firestore dev → producción.
 * Uso: node backend/scripts/migrate-firestore.js
 */
const admin = require('firebase-admin');

const DEV_SA  = require('../service-account.json');
const PROD_SA = require('../service-account-prod.json');

const devApp  = admin.initializeApp({ credential: admin.credential.cert(DEV_SA),  projectId: DEV_SA.project_id  }, 'dev');
const prodApp = admin.initializeApp({ credential: admin.credential.cert(PROD_SA), projectId: PROD_SA.project_id }, 'prod');

const devDb  = devApp.firestore();
const prodDb = prodApp.firestore();

const BATCH_SIZE = 400; // Firestore max es 500 por batch

async function migrateCollection(colName) {
  console.log(`\n📦 Migrando colección: ${colName}`);
  const snap = await devDb.collection(colName).get();

  if (snap.empty) {
    console.log(`   ⚠️  Vacía, saltando.`);
    return;
  }

  const docs = snap.docs;
  console.log(`   📄 ${docs.length} documentos encontrados`);

  // Procesar en lotes de BATCH_SIZE
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = prodDb.batch();
    const chunk = docs.slice(i, i + BATCH_SIZE);

    for (const doc of chunk) {
      const ref = prodDb.collection(colName).doc(doc.id);
      batch.set(ref, doc.data());
    }

    await batch.commit();
    console.log(`   ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs escritos`);
  }
}

async function migrate() {
  console.log(`🚀 Iniciando migración`);
  console.log(`   Dev:  ${DEV_SA.project_id}`);
  console.log(`   Prod: ${PROD_SA.project_id}`);

  // Listar todas las colecciones del proyecto dev
  const collections = await devDb.listCollections();
  const colNames = collections.map(c => c.id);
  console.log(`\n📚 Colecciones encontradas: ${colNames.join(', ')}`);

  for (const colName of colNames) {
    await migrateCollection(colName);
  }

  console.log('\n🎉 Migración completa.');
}

migrate().catch(err => {
  console.error('❌ Error en migración:', err);
  process.exit(1);
}).finally(() => setTimeout(() => process.exit(0), 500));
