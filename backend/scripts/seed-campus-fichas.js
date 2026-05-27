/**
 * Seed: carga los 8 campus de ARM Global en Firestore con su configuración de fichas.
 * Uso: node scripts/seed-campus-fichas.js
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

const CAMPUS_DATA = [
  {
    name: 'Santiago',
    address: 'Santiago, Chile',
    fichaType: 'both',
    encuentrosConfig: [
      { dia: 'Miércoles', tipo: 'unico', encuentros: [{ id: 'unico', label: 'Miércoles', time: '20:00', isLive: true, color: '#7F77DD' }] },
      { dia: 'Domingo',   tipo: 'multi', encuentros: [
        { id: 'e1', label: 'Domingo AM', time: '10:00', isLive: true,  color: '#7F77DD' },
        { id: 'e2', label: 'Domingo PM', time: '12:30', isLive: false, color: '#1D9E75' },
      ]},
    ],
  },
  {
    name: 'Puente Alto',
    address: 'Puente Alto, Chile',
    fichaType: 'both',
    encuentrosConfig: [
      { dia: 'Domingo', tipo: 'multi', encuentros: [
        { id: 'e1', label: 'Domingo AM', time: '10:00', isLive: true,  color: '#7F77DD' },
        { id: 'e2', label: 'Domingo PM', time: '12:30', isLive: false, color: '#1D9E75' },
      ]},
      { dia: 'Jueves', tipo: 'unico', encuentros: [{ id: 'unico', label: 'Jueves', time: '20:00', isLive: false, color: '#7F77DD' }] },
    ],
  },
  {
    name: 'Concepción',
    address: 'Concepción, Chile',
    fichaType: 'unico',
    encuentrosConfig: [
      { dia: 'Sábado', tipo: 'unico', encuentros: [{ id: 'unico', label: 'Sábado', time: '19:00', isLive: true, color: '#7F77DD' }] },
    ],
  },
  {
    name: 'Punta Arenas',
    address: 'Punta Arenas, Chile',
    fichaType: 'both',
    encuentrosConfig: [
      { dia: 'Domingo', tipo: 'multi', encuentros: [
        { id: 'e1', label: 'Domingo AM', time: '10:00', isLive: true,  color: '#7F77DD' },
        { id: 'e2', label: 'Domingo PM', time: '12:30', isLive: false, color: '#1D9E75' },
      ]},
      { dia: 'Jueves', tipo: 'unico', encuentros: [{ id: 'unico', label: 'Jueves', time: '20:00', isLive: false, color: '#7F77DD' }] },
    ],
  },
  {
    name: 'La Plata',
    address: 'La Plata, Argentina',
    fichaType: 'unico',
    encuentrosConfig: [
      { dia: 'Domingo', tipo: 'unico', encuentros: [{ id: 'unico', label: 'Domingo', time: '11:00', isLive: true, color: '#7F77DD' }] },
    ],
  },
  {
    name: 'Montevideo',
    address: 'Montevideo, Uruguay',
    fichaType: 'both',
    encuentrosConfig: [
      { dia: 'Domingo', tipo: 'multi', encuentros: [
        { id: 'e1', label: 'Domingo AM', time: '10:00', isLive: true,  color: '#7F77DD' },
        { id: 'e2', label: 'Domingo PM', time: '12:30', isLive: false, color: '#1D9E75' },
      ]},
      { dia: 'Jueves', tipo: 'unico', encuentros: [{ id: 'unico', label: 'Jueves', time: '20:00', isLive: false, color: '#7F77DD' }] },
    ],
  },
  {
    name: 'Katy',
    address: 'Katy, Texas, USA',
    fichaType: 'unico',
    encuentrosConfig: [
      { dia: 'Domingo', tipo: 'unico', encuentros: [{ id: 'unico', label: 'Domingo', time: '10:30', isLive: true, color: '#7F77DD' }] },
    ],
  },
  {
    name: 'Maracaibo',
    address: 'Maracaibo, Venezuela',
    fichaType: 'multi',
    encuentrosConfig: [
      { dia: 'Domingo', tipo: 'multi', encuentros: [
        { id: 'e1', label: 'Domingo AM', time: '09:00', isLive: true,  color: '#7F77DD' },
        { id: 'e2', label: 'Domingo PM', time: '11:30', isLive: false, color: '#1D9E75' },
      ]},
    ],
  },
];

async function getNextId(collection) {
  const ref = db.collection('_counters').doc(collection);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const next = snap.exists ? snap.data().next : 1;
    tx.set(ref, { next: next + 1 }, { merge: true });
    return next;
  });
}

async function main() {
  console.log('🌱 Seeding campus...');
  let creados = 0, omitidos = 0;

  for (const campus of CAMPUS_DATA) {
    // Verificar si ya existe
    const existing = await db.collection('campuses')
      .where('nameLower', '==', campus.name.toLowerCase()).limit(1).get();

    if (!existing.empty) {
      console.log(`  ⏭  ${campus.name} ya existe — actualizando fichaType`);
      const docId = existing.docs[0].id;
      await db.collection('campuses').doc(docId).update({
        fichaType:        campus.fichaType,
        encuentrosConfig: campus.encuentrosConfig,
        updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
      });
      omitidos++;
      continue;
    }

    const id = await getNextId('campuses');
    await db.collection('campuses').doc(String(id)).set({
      id,
      name:             campus.name,
      nameLower:        campus.name.toLowerCase(),
      address:          campus.address,
      isActive:         true,
      fichaType:        campus.fichaType,
      encuentrosConfig: campus.encuentrosConfig,
      createdAt:        admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✅ ${campus.name} (id: ${id})`);
    creados++;
  }

  console.log(`\n✔ Seed completado — ${creados} creados, ${omitidos} actualizados`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
