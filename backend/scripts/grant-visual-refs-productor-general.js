/**
 * Agrega el permiso `visual-references:manage` al rol "Productor General".
 * Idempotente: si ya lo tiene, no hace nada.
 *
 * Vista previa: node scripts/grant-visual-refs-productor-general.js
 * Aplicar:      node scripts/grant-visual-refs-productor-general.js --apply
 */
require('dotenv').config({ path: '.env' });
const admin = require('firebase-admin');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const keyFile = path.resolve(process.env.FIREBASE_KEY_FILE || './service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(keyFile),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

const ROLE_NAME    = 'Productor General';
const NEW_PERM     = 'visual-references:manage';
const OPTIONAL_VIEW = 'visual-references:view'; // agregar view también, es prerequisito lógico

function normalized(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

async function main() {
  const snapshot = await db.collection('roles').get();
  const role = snapshot.docs
    .map((doc) => ({ ref: doc.ref, ...doc.data() }))
    .find((r) => normalized(r.name) === normalized(ROLE_NAME));

  if (!role) {
    console.error(`❌ No se encontró un rol llamado "${ROLE_NAME}" en Firestore.`);
    console.error('   Roles disponibles:');
    snapshot.docs.forEach((d) => console.error(`   · ${d.data().name}`));
    process.exit(1);
  }

  const current = role.permissions ?? [];
  const toAdd = [NEW_PERM, OPTIONAL_VIEW].filter((p) => !current.includes(p));
  const next = [...current, ...toAdd];

  console.log(`Rol: ${role.name} (id ${role.id})`);
  console.log(`Permisos actuales (${current.length}):`);
  current.forEach((p) => console.log(`  · ${p}`));

  if (toAdd.length === 0) {
    console.log('\n✓ Ya tiene los permisos requeridos. Nada que hacer.');
    return;
  }

  console.log(`\nPermisos a agregar:`);
  toAdd.forEach((p) => console.log(`  + ${p}`));

  if (!APPLY) {
    console.log('\nVista previa. Ejecuta con --apply para guardar.');
    return;
  }

  await role.ref.update({
    permissions: next,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  console.log(`\n✓ Rol "${role.name}" actualizado con ${toAdd.length} permiso(s) nuevo(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
