/**
 * Descubrimiento: Equipo de Producción
 * Muestra el team ID, membresías actuales y busca usuarios por nombre.
 * Uso: node scripts/discover-produccion.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

const relKey  = path.resolve(__dirname, '../', process.env.FIREBASE_KEY_FILE || './service-account.json');
const mainKey = '/Users/luisramirezbriones/Developer/ARM/intranet_arm/backend/service-account.json';
const keyFile = fs.existsSync(relKey) ? relKey : mainKey;

admin.initializeApp({ credential: admin.credential.cert(keyFile), projectId: process.env.FIREBASE_PROJECT_ID });
const db = admin.firestore();

// Personas que queremos agregar (solo primeros nombres para buscar)
const SEARCH_NAMES = [
  'Kengev', 'Naty', 'Benja', 'Saavedra',
  'Caro', 'Camilo', 'Camila', 'Edison', 'Carlos Contreras', 'Katy',
  'Alejandro Montero',
  'Pedro', 'Newman',
  'Andrés Zamorano', 'Abi', 'Bayron',
  'Andrea Pernia', 'Anderson',
  'Annie', 'Nico',
];

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  DESCUBRIMIENTO — Equipo de Producción');
  console.log('='.repeat(60) + '\n');

  // 1. Buscar área Producción
  const areasSnap = await db.collection('org_areas').get();
  console.log('ÁREAS:');
  areasSnap.docs.forEach(d => {
    const a = d.data();
    console.log(`  id=${a.id} | slug="${a.slug}" | name="${a.name}"`);
  });

  // 2. Buscar equipo Producción
  const teamsSnap = await db.collection('org_teams').get();
  console.log('\nEQUIPOS (que contengan "producc" en el nombre):');
  teamsSnap.docs
    .filter(d => d.data().name?.toLowerCase().includes('producc'))
    .forEach(d => {
      const t = d.data();
      console.log(`  id=${t.id} | name="${t.name}" | areaId=${t.areaId}`);
    });

  // 3. Membresías actuales del equipo de producción
  const prodTeams = teamsSnap.docs.filter(d => d.data().name?.toLowerCase().includes('producc'));
  for (const teamDoc of prodTeams) {
    const teamId = teamDoc.data().id;
    const membSnap = await db.collection('org_memberships').where('teamId', '==', teamId).get();
    console.log(`\nMEMBRESÍAS actuales del equipo id=${teamId} "${teamDoc.data().name}":`);
    if (membSnap.empty) {
      console.log('  (ninguna)');
    } else {
      membSnap.docs.forEach(d => {
        const m = d.data();
        console.log(`  membId=${m.id} | userId=${m.userId} | role=${m.role} | customTitle="${m.customTitle ?? ''}"`);
      });
    }
  }

  // 4. Buscar usuarios existentes por nombre (todos los users)
  const usersSnap = await db.collection('users').get();
  console.log('\nUSUARIOS EXISTENTES (todos):');
  usersSnap.docs.forEach(d => {
    const u = d.data();
    console.log(`  id=${u.id} | "${u.firstName} ${u.lastName}" | email=${u.email ?? 'null'} | status=${u.status}`);
  });

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
