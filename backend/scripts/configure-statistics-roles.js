/**
 * Configura los roles autorizados para el dashboard de Estadísticas.
 *
 * Vista previa: node scripts/configure-statistics-roles.js
 * Aplicar:      node scripts/configure-statistics-roles.js --apply
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
const ROLE_RULES = [
  { name: 'Administrador de Campus', permissions: ['estadisticas:view'] },
  { name: 'Pastor de Campus', permissions: ['estadisticas:view'] },
  { name: 'Pastor Ejecutivo', permissions: ['estadisticas:view', 'estadisticas:viewAll'] },
  { name: 'Pastor Ministro', permissions: ['estadisticas:view'] },
  { name: 'Ministro', permissions: ['estadisticas:view'] },
];

function normalized(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

async function main() {
  const snapshot = await db.collection('roles').get();
  const existing = snapshot.docs.map((doc) => ({ ref: doc.ref, ...doc.data() }));
  let nextId = Math.max(0, ...existing.map((role) => Number(role.id) || 0)) + 1;
  const changes = [];

  for (const rule of ROLE_RULES) {
    const role = existing.find((item) => normalized(item.name) === normalized(rule.name));
    if (!role) {
      changes.push({
        action: 'create',
        id: nextId++,
        name: rule.name,
        permissions: rule.permissions,
      });
      continue;
    }
    const current = role.permissions ?? [];
    const permissions = [...new Set([...current, ...rule.permissions])];
    changes.push({
      action: permissions.length === current.length ? 'unchanged' : 'update',
      id: role.id,
      ref: role.ref,
      name: role.name,
      permissions,
    });
  }

  for (const change of changes) {
    console.log(`${change.action.padEnd(9)} ${change.id} · ${change.name} · ${change.permissions.join(', ')}`);
  }

  if (!APPLY) {
    console.log('\nVista previa solamente. Ejecuta con --apply para guardar.');
    return;
  }

  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();
  for (const change of changes) {
    if (change.action === 'unchanged') continue;
    if (change.action === 'update') {
      batch.update(change.ref, { permissions: change.permissions, updatedAt: now });
      continue;
    }
    const ref = db.collection('roles').doc(String(change.id));
    batch.set(ref, {
      id: change.id,
      name: change.name,
      nameLower: change.name.toLowerCase(),
      description: 'Acceso al panel operativo de Estadísticas',
      isSystem: false,
      isActive: true,
      permissions: change.permissions,
      createdAt: now,
      updatedAt: now,
    });
  }
  batch.set(db.collection('_counters').doc('roles'), { next: nextId }, { merge: true });
  await batch.commit();
  console.log('\nRoles de Estadísticas configurados correctamente.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
