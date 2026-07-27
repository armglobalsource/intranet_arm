/**
 * Migración: eliminar rol team_leader
 * Convierte todas las membresías con role='team_leader' a role='member'
 *
 * Uso: node scripts/migrate-remove-team-leader.js [--dry-run]
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
  console.log(`  Migración: team_leader → member${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  const snap = await db.collection('org_memberships')
    .where('role', '==', 'team_leader')
    .get();

  if (snap.empty) {
    console.log('✅ No hay membresías con role=team_leader. Nada que hacer.\n');
    process.exit(0);
  }

  console.log(`Encontradas: ${snap.docs.length} membresías con role=team_leader\n`);

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    const d = doc.data();
    console.log(`  membresía id=${d.id} | userId=${d.userId} | teamId=${d.teamId} → member`);
    if (!DRY_RUN) {
      batch.update(doc.ref, { role: 'member', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  });

  if (!DRY_RUN) {
    await batch.commit();
    console.log(`\n✅ ${snap.docs.length} membresías actualizadas a role=member\n`);
  } else {
    console.log(`\n[dry-run] Se actualizarían ${snap.docs.length} membresías\n`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
