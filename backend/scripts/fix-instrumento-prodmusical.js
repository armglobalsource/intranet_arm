/**
 * Fix: Enc. por Instrumento + Equipo Prod. Musical — AR Worship
 *
 * Enc. por Instrumento (team 52):
 *   - Crea José Candia y Matias Batias (no existen)
 *   - Reemplaza las 2 membresías actuales por 5 individuales
 *
 * Equipo Prod. Musical (team 53):
 *   - Agrega segunda entrada de Nicolás Burgos → Composición
 *     (ya tiene Ingeniero de Mezcla; la de Composición fue deduplicada)
 *
 * Uso: node scripts/fix-instrumento-prodmusical.js [--dry-run]
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

async function nextId(col) {
  const ref = db.collection('_counters').doc(col);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const next = snap.exists ? snap.data().next : 1;
    tx.set(ref, { next: next + 1 });
    return next;
  });
}
function now() { return admin.firestore.FieldValue.serverTimestamp(); }
function log(m) { console.log(m); }

async function createUser(firstName, lastName) {
  const uid = DRY_RUN ? 999 : await nextId('users');
  if (!DRY_RUN) {
    await db.collection('users').doc(String(uid)).set({
      id: uid, email: null, passwordHash: null,
      firstName, lastName,
      nameLower: `${firstName} ${lastName}`.toLowerCase(),
      role: null, campus: null, jobTitles: [], avatarUrl: null,
      status: 'active', createdAt: now(), updatedAt: now(),
    });
  }
  log(`  ✓ [create user] ${firstName} ${lastName} (id=${uid})`);
  return uid;
}

async function addMembership(userId, teamId, role, customTitle, sortOrder) {
  if (!DRY_RUN) {
    const id = await nextId('org_memberships');
    await db.collection('org_memberships').doc(String(id)).set({
      id, userId, areaId: null, teamId,
      role, customTitle, sortOrder,
      createdAt: now(), updatedAt: now(),
    });
  }
  log(`  ✓ uid=${userId} → ${customTitle} [${role}]`);
}

async function main() {
  log(`\n${'='.repeat(60)}`);
  log(`  Fix: Enc. por Instrumento + Equipo Prod. Musical${DRY_RUN ? ' (DRY RUN)' : ''}`);
  log(`${'='.repeat(60)}\n`);

  // ══════════════════════════════════════════════════════════
  // A. ENC. POR INSTRUMENTO (team 52)
  // ══════════════════════════════════════════════════════════
  const TEAM_INSTR = 52;
  log('── A. Enc. por Instrumento (team 52) ──────────────────────\n');

  // 1. Crear usuarios faltantes
  log('1. Creando usuarios nuevos...');
  const candiaId  = await createUser('José',   'Candia');   // Guitarras
  const batiasId  = await createUser('Matias', 'Batias');   // Bateristas

  // IDs ya existentes
  const JuanJoseId   = 59;  // Juan José González
  const MarcoMellaId = 60;  // Marco Mella
  const TreicyId     = 14;  // Treicy Aceitón

  // 2. Eliminar membresías actuales
  log('\n2. Eliminando membresías actuales...');
  const instrSnap = await db.collection('org_memberships')
    .where('teamId', '==', TEAM_INSTR).get();
  if (!DRY_RUN) await Promise.all(instrSnap.docs.map(d => d.ref.delete()));
  log(`  ✓ ${instrSnap.docs.length} membresías eliminadas`);

  // 3. Insertar 5 membresías individuales
  log('\n3. Insertando membresías individuales...');
  await addMembership(candiaId,    TEAM_INSTR, 'team_leader', 'Guitarras',  0);
  await addMembership(batiasId,    TEAM_INSTR, 'member',      'Bateristas', 1);
  await addMembership(JuanJoseId,  TEAM_INSTR, 'member',      'Bajistas',   2);
  await addMembership(MarcoMellaId,TEAM_INSTR, 'member',      'Pianistas',  3);
  await addMembership(TreicyId,    TEAM_INSTR, 'member',      'Voces',      4);

  // ══════════════════════════════════════════════════════════
  // B. EQUIPO PROD. MUSICAL (team 53)
  // ══════════════════════════════════════════════════════════
  const TEAM_PROD = 53;
  log('\n── B. Equipo Prod. Musical (team 53) ──────────────────────\n');

  // Verificar que no exista ya la entrada de Nico con Composición
  const nicosSnap = await db.collection('org_memberships')
    .where('teamId', '==', TEAM_PROD)
    .where('userId', '==', 7).get();
  const titles = nicosSnap.docs.map(d => d.data().customTitle);
  log(`  Entradas actuales de Nicolás Burgos: [${titles.join(', ')}]`);

  const alreadyHasComp = titles.includes('Composición');
  if (alreadyHasComp) {
    log('  (ya tiene Composición — sin cambios)');
  } else {
    log('\n  Agregando Nicolás Burgos → Composición...');
    // sort_order: después de las entradas existentes de Prod. Musical
    const prodSnap = await db.collection('org_memberships')
      .where('teamId', '==', TEAM_PROD).get();
    const maxSort = Math.max(...prodSnap.docs.map(d => d.data().sortOrder ?? 0));
    await addMembership(7, TEAM_PROD, 'member', 'Composición', maxSort + 1);
  }

  log(`\n✅ ${DRY_RUN ? '[dry-run] ' : ''}Completado\n`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
