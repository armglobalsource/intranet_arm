/**
 * Fix: Equipo de Producción (areaId=24, teamId=55)
 * - Crea usuarios nuevos para los que no tienen cuenta
 * - Agrega membresías faltantes sin borrar las existentes
 *
 * Uso: node scripts/fix-equipo-produccion.js [--dry-run]
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

const TEAM_ID = 55;
const AREA_ID = 24;

function now() { return admin.firestore.FieldValue.serverTimestamp(); }

async function nextId(col) {
  const ref = db.collection('_counters').doc(col);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const next = snap.exists ? snap.data().next : 1;
    tx.set(ref, { next: next + 1 });
    return next;
  });
}

// ── Usuarios a CREAR (no tienen cuenta en el sistema) ──────────────────────
// [firstName, lastName]
const NEW_USERS = [
  ['Carlos',  'Villalobos'],   // Campus Santiago
  ['Camilo',  ''],             // Campus Puente Alto
  ['Camila',  ''],             // Campus Puente Alto
  ['Edison',  ''],             // Campus Puente Alto
  ['Carlos',  'Contreras'],    // Campus Puente Alto
  ['Katy',    ''],             // Campus Puente Alto
  ['Pedro',   ''],             // Campus Punta Arenas
  ['Abi',     ''],             // Campus Concepción
  ['Andrea',  'Pernia'],       // Campus Maracaibo
  ['Annie',   'Stephens'],     // Campus Katy
];

// ── Membresías a AGREGAR ───────────────────────────────────────────────────
// [firstName, lastName, userId_existente_o_null, customTitle, sortOrder]
// userId_existente: ID si ya tiene cuenta; null si es usuario nuevo
const TO_ADD = [
  // Campus Santiago
  ['Carlos',  'Villalobos',  null, 'Campus Santiago',    10],

  // Campus Puente Alto
  ['Carolina','Cepeda',       26,  'Campus Puente Alto', 11],  // "Caro"
  ['Camilo',  '',            null, 'Campus Puente Alto', 12],
  ['Camila',  '',            null, 'Campus Puente Alto', 13],
  ['Edison',  '',            null, 'Campus Puente Alto', 14],
  ['Carlos',  'Contreras',   null, 'Campus Puente Alto', 15],
  ['Katy',    '',            null, 'Campus Puente Alto', 16],

  // Campus Punta Arenas
  ['Pedro',   '',            null, 'Campus Punta Arenas',17],

  // Campus Concepción
  ['Abi',     '',            null, 'Campus Concepción',  18],
  ['Bayron',  'González',     25,  'Campus Concepción',  19],

  // Campus Maracaibo
  ['Andrea',  'Pernia',      null, 'Campus Maracaibo',   20],

  // Campus Katy
  ['Annie',   'Stephens',    null, 'Campus Katy',        21],
];

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Fix: Equipo de Producción${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  // ── 1. Verificar membresías existentes ────────────────────────────────────
  const existingSnap = await db.collection('org_memberships').where('teamId', '==', TEAM_ID).get();
  const existingUserIds = new Set(existingSnap.docs.map(d => d.data().userId));
  console.log(`Membresías existentes: ${existingSnap.docs.length} (userIds: ${[...existingUserIds].join(', ')})\n`);

  // ── 2. Crear usuarios nuevos ───────────────────────────────────────────────
  console.log('1. Creando usuarios nuevos...');
  const newUserIdMap = {}; // "firstName:lastName" → userId

  for (const [firstName, lastName] of NEW_USERS) {
    const key = `${firstName}:${lastName}`;
    const uid = DRY_RUN ? 999 : await nextId('users');
    newUserIdMap[key] = uid;

    const displayName = [firstName, lastName].filter(Boolean).join(' ');

    if (!DRY_RUN) {
      await db.collection('users').doc(String(uid)).set({
        id:           uid,
        email:        null,
        passwordHash: null,
        firstName,
        lastName:     lastName || null,
        nameLower:    displayName.toLowerCase(),
        role:         null,
        campus:       null,
        jobTitles:    [],
        avatarUrl:    null,
        status:       'active',
        createdAt:    now(),
        updatedAt:    now(),
      });
    }
    console.log(`  ✓ [crear] ${displayName || firstName} (id=${uid})`);
  }

  // ── 3. Insertar membresías faltantes ──────────────────────────────────────
  console.log('\n2. Insertando membresías...');
  let added = 0, skipped = 0;

  for (const [firstName, lastName, existingUid, customTitle, sortOrder] of TO_ADD) {
    const key    = `${firstName}:${lastName}`;
    const userId = existingUid ?? newUserIdMap[key];

    if (!userId) {
      console.log(`  ⚠️  Sin userId para: ${firstName} ${lastName}`);
      continue;
    }

    // Omitir si ya está en el equipo
    if (existingUserIds.has(userId)) {
      console.log(`  ↩  Ya existe: ${firstName} ${lastName} (userId=${userId})`);
      skipped++;
      continue;
    }

    const displayName = [firstName, lastName].filter(Boolean).join(' ');

    if (!DRY_RUN) {
      const membId = await nextId('org_memberships');
      await db.collection('org_memberships').doc(String(membId)).set({
        id:         membId,
        userId,
        areaId:     null,
        teamId:     TEAM_ID,
        role:       'member',
        customTitle,
        sortOrder,
        createdAt:  now(),
        updatedAt:  now(),
      });
    }
    console.log(`  ✓ ${displayName || firstName} (uid=${userId}) → "${customTitle}"`);
    added++;
  }

  console.log(`\n✅ ${DRY_RUN ? '[dry-run] ' : ''}${NEW_USERS.length} usuarios creados, ${added} membresías agregadas, ${skipped} omitidas (ya existían)\n`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
