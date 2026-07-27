/**
 * Paso 1: Directores Musicales — AR Worship
 * - Crea usuarios nuevos para personas sin cuenta (solo para el organigrama)
 * - Reconstruye las membresías con una entrada individual por persona
 *
 * Uso: node scripts/fix-directores-musicales.js [--dry-run]
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

const DRY_RUN = process.argv.includes('--dry-run');

const relKey  = path.resolve(__dirname, '../', process.env.FIREBASE_KEY_FILE || './service-account.json');
const mainKey = path.resolve('/Users/luisramirezbriones/Developer/ARM/intranet_arm/backend/service-account.json');
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

// ── Personas a CREAR (no tienen cuenta en el sistema) ──────────────────────
// firstName, lastName
const NEW_USERS = [
  ['José',      'Gandía'],
  ['Elías',     'Quiroz'],
  ['Juan José', 'González'],
  ['Marco',     'Mella'],
  ['Daniel',    'Fabio'],
  ['Ronald',    'Romero'],
  ['Manuel',    'Córdova'],
  ['Víctor',    'Cárdenas'],   // "Victo Cárdenas" en el HTML
  ['Pablo',     'Encina'],
  ['Ezequiel',  'Cárdenas'],
  ['Israel',    'Videla'],
  ['Javier',    'Rosas'],
  ['Javier',    'Carvajal'],
  ['Rafael',    'Pérez'],
  ['Karina',    'Peralta'],    // "Ps. Karina Peralta" en el HTML (≠ Kari Álvarez id=12)
];

// ── Membresías de Directores Musicales — una por persona ──────────────────
// Nota: team id=51, área worship id=23
// Formato: [firstName, lastName, userId_existente_o_null, customTitle, sortOrder]
// userId_existente: ID si ya tiene cuenta; null si es nuevo usuario
const DIRECTORS = [
  // Campus Santiago y Puente Alto
  ['Ismael',    'González',   13, 'Campus Santiago y Puente Alto', 0],   // team_leader
  ['José',      'Gandía',    null,'Campus Santiago y Puente Alto', 1],
  ['Elías',     'Quiroz',    null,'Campus Santiago y Puente Alto', 2],
  ['Juan José', 'González',  null,'Campus Santiago y Puente Alto', 3],
  ['Marco',     'Mella',     null,'Campus Santiago y Puente Alto', 4],
  ['Daniel',    'Fabio',     null,'Campus Santiago y Puente Alto', 5],
  ['Ronald',    'Romero',    null,'Campus Santiago y Puente Alto', 6],
  ['Manuel',    'Córdova',   null,'Campus Santiago y Puente Alto', 7],
  ['Víctor',    'Cárdenas',  null,'Campus Santiago y Puente Alto', 8],
  ['Pablo',     'Encina',    null,'Campus Santiago y Puente Alto', 9],
  ['Rodrigo',   'Quiroz',      5, 'Campus Santiago y Puente Alto', 10],
  // Campus Montevideo
  ['Pablo',     'Ortiz',       8, 'Campus Montevideo',             11],
  ['Ezequiel',  'Cárdenas',  null,'Campus Montevideo',             12],
  ['Israel',    'Videla',    null,'Campus Montevideo',             13],
  // Campus Punta Arenas
  ['Newman',    'Guevara',     9, 'Campus Punta Arenas',           14],
  ['Javier',    'Rosas',    null, 'Campus Punta Arenas',           15],
  ['Javier',    'Carvajal', null, 'Campus Punta Arenas',           16],
  // Campus Concepción
  ['Samuel',    'Montalva',   10, 'Campus Concepción',             17],
  // Campus Maracaibo
  ['Anderson',  'León',       11, 'Campus Maracaibo',              18],
  ['Rafael',    'Pérez',     null,'Campus Maracaibo',              19],
  // Campus Katy
  ['Karina',    'Peralta',  null, 'Campus Katy',                   20],
  ['Nicolás',   'Burgos',     7,  'Campus Katy',                   21],
];

async function main() {
  log(`\n${'='.repeat(60)}`);
  log(`  Directores Musicales — fix individual memberships${DRY_RUN ? ' (DRY RUN)' : ''}`);
  log(`${'='.repeat(60)}\n`);

  // ── 1. Buscar el equipo Directores Musicales ───────────────────────────────
  const teamsSnap = await db.collection('org_teams')
    .where('name', '==', 'Directores Musicales').limit(1).get();
  if (teamsSnap.empty) { log('❌ Equipo "Directores Musicales" no encontrado'); process.exit(1); }
  const teamDoc = teamsSnap.docs[0].data();
  const TEAM_ID = teamDoc.id;
  log(`✓ Equipo encontrado: "${teamDoc.name}" (id=${TEAM_ID}, areaId=${teamDoc.areaId})\n`);

  // ── 2. Crear usuarios nuevos ───────────────────────────────────────────────
  log('1. Creando usuarios nuevos...');
  const newUserIdMap = {}; // "firstName:lastName" → userId

  for (const [firstName, lastName] of NEW_USERS) {
    const key = `${firstName}:${lastName}`;
    const uid = DRY_RUN ? 999 : await nextId('users');
    newUserIdMap[key] = uid;

    if (!DRY_RUN) {
      await db.collection('users').doc(String(uid)).set({
        id:          uid,
        email:       null,
        passwordHash: null,
        firstName,
        lastName,
        nameLower:   `${firstName} ${lastName}`.toLowerCase(),
        role:        null,
        campus:      null,
        jobTitles:   [],
        avatarUrl:   null,
        status:      'active',
        createdAt:   now(),
        updatedAt:   now(),
      });
    }
    log(`  ✓ [create user] ${firstName} ${lastName} (id=${uid})`);
  }

  // ── 3. Eliminar membresías actuales del equipo ─────────────────────────────
  log('\n2. Eliminando membresías actuales de Directores Musicales...');
  const existingMemb = await db.collection('org_memberships')
    .where('teamId', '==', TEAM_ID).get();
  if (!DRY_RUN) {
    await Promise.all(existingMemb.docs.map(d => d.ref.delete()));
  }
  log(`  ✓ ${existingMemb.docs.length} membresías eliminadas`);

  // ── 4. Insertar una membresía por persona ──────────────────────────────────
  log('\n3. Insertando membresías individuales...');
  let inserted = 0;

  for (const [firstName, lastName, existingUid, customTitle, sortOrder] of DIRECTORS) {
    const key = `${firstName}:${lastName}`;
    const userId = existingUid ?? newUserIdMap[key];

    if (!userId) {
      log(`  ⚠️  Sin userId para: ${firstName} ${lastName}`);
      continue;
    }

    const role = sortOrder === 0 ? 'team_leader' : 'member';

    if (!DRY_RUN) {
      const membId = await nextId('org_memberships');
      await db.collection('org_memberships').doc(String(membId)).set({
        id:          membId,
        userId,
        areaId:      null,
        teamId:      TEAM_ID,
        role,
        customTitle,
        sortOrder,
        createdAt:   now(),
        updatedAt:   now(),
      });
    }
    log(`  ✓ ${firstName} ${lastName} (uid=${userId}) → ${customTitle} [${role}]`);
    inserted++;
  }

  log(`\n✅ ${DRY_RUN ? '[dry-run] ' : ''}${NEW_USERS.length} usuarios creados, ${inserted} membresías insertadas\n`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
