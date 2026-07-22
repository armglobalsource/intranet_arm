/**
 * Carga el roster, los seis equipos y el calendario de líderes de voluntarios
 * de Santiago (julio 2026 a enero 2027). Es idempotente: actualiza los registros
 * del mismo campus/tipo/nombre/fecha en vez de duplicarlos.
 *
 * Uso (desde backend): npm run seed:santiago-lideres
 */
require('dotenv').config({ path: '.env' });
const admin = require('firebase-admin');
const path = require('path');

const keyFile = path.resolve(process.env.FIREBASE_KEY_FILE || './service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(keyFile),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const db = admin.firestore();
const now = () => admin.firestore.FieldValue.serverTimestamp();
const TIPO = 'lideres_voluntarios';

const EQUIPOS = [
  { numero: 1, modalidad: 'AM', lideres: ['Cesar', 'Anggerly'] },
  { numero: 2, modalidad: 'AM', lideres: ['Juan', 'Pamela'] },
  { numero: 3, modalidad: 'AM', lideres: ['Ivan', 'Nataly'] },
  { numero: 4, modalidad: 'AM', lideres: ['Jesus', 'Carla'] },
  { numero: 5, modalidad: 'PM', lideres: ['Jose', 'Lina'] },
  { numero: 6, modalidad: 'PM', lideres: ['Sergio', 'Jhoelix'] },
];

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function nextId(collection) {
  const ref = db.collection('_counters').doc(collection);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = snap.exists ? snap.data().next : 1;
    tx.set(ref, { next: next + 1 }, { merge: true });
    return next;
  });
}

async function findSantiago() {
  const exact = await db.collection('campuses').where('nameLower', '==', 'santiago').limit(1).get();
  if (!exact.empty) return exact.docs[0].data();

  const all = await db.collection('campuses').get();
  const found = all.docs.find((doc) => String(doc.data().name).trim().toLowerCase() === 'santiago');
  if (!found) throw new Error('No se encontró el campus Santiago');
  return found.data();
}

async function upsertLider(campusId, nombre, existing) {
  const match = existing.find((row) => String(row.nombre).trim().toLowerCase() === nombre.toLowerCase());
  if (match) {
    await match.ref.update({ nombre, isActive: true, updatedAt: now() });
    return Number(match.data.id);
  }

  const id = await nextId('campus_administradores');
  await db.collection('campus_administradores').doc(String(id)).set({
    id, campusId, tipo: TIPO, nombre, isActive: true, createdAt: now(), updatedAt: now(),
  });
  return id;
}

async function upsertEquipo(campusId, equipo, liderIds, existing) {
  const nombre = `Equipo ${equipo.numero} · ${equipo.lideres.join(' y ')}`;
  const nombreAnterior = `equipo ${equipo.numero}`;
  const match = existing.find((row) =>
    Number(row.data.numeroEquipo) === equipo.numero ||
    String(row.nombre).trim().toLowerCase() === nombreAnterior ||
    String(row.nombre).trim().toLowerCase().startsWith(`${nombreAnterior} ·`),
  );
  const data = {
    campusId, tipo: TIPO, nombre, numeroEquipo: equipo.numero, administradorIds: liderIds,
    modalidad: equipo.modalidad, isActive: true, updatedAt: now(),
  };
  if (match) {
    await match.ref.update(data);
    return Number(match.data.id);
  }

  const id = await nextId('campus_equipos');
  await db.collection('campus_equipos').doc(String(id)).set({ id, ...data, createdAt: now() });
  return id;
}

async function main() {
  const campus = await findSantiago();
  const campusId = Number(campus.id);
  console.log(`Campus Santiago encontrado (id: ${campusId})`);

  const [liderSnap, equipoSnap, turnoSnap] = await Promise.all([
    db.collection('campus_administradores').where('campusId', '==', campusId).get(),
    db.collection('campus_equipos').where('campusId', '==', campusId).get(),
    db.collection('campus_turnos').where('campusId', '==', campusId).get(),
  ]);
  const lideresExistentes = liderSnap.docs
    .filter((doc) => (doc.data().tipo ?? 'administradores') === TIPO)
    .map((doc) => ({ ref: doc.ref, data: doc.data(), nombre: doc.data().nombre }));
  const equiposExistentes = equipoSnap.docs
    .filter((doc) => (doc.data().tipo ?? 'administradores') === TIPO)
    .map((doc) => ({ ref: doc.ref, data: doc.data(), nombre: doc.data().nombre }));
  const turnosExistentes = turnoSnap.docs
    .filter((doc) => (doc.data().tipo ?? 'administradores') === TIPO)
    .map((doc) => ({ ref: doc.ref, data: doc.data() }));

  const liderIdByName = new Map();
  for (const nombre of [...new Set(EQUIPOS.flatMap((equipo) => equipo.lideres))]) {
    liderIdByName.set(nombre, await upsertLider(campusId, nombre, lideresExistentes));
  }

  const equipoIdByNumber = new Map();
  for (const equipo of EQUIPOS) {
    const ids = equipo.lideres.map((nombre) => liderIdByName.get(nombre));
    equipoIdByNumber.set(equipo.numero, await upsertEquipo(campusId, equipo, ids, equiposExistentes));
  }

  // La fecha almacenada es el lunes de la semana. AM cubre miércoles + domingo AM.
  // PM cubre el domingo PM. El patrón de la planilla inicia la semana 29-06-2026.
  const inicio = '2026-06-29';
  const semanas = 31;
  const rotacionAM = [3, 4, 1, 2];
  const rotacionPM = [5, 6];
  let creados = 0;
  let actualizados = 0;

  for (let i = 0; i < semanas; i++) {
    const fecha = addDays(inicio, i * 7);
    for (const [modalidad, rotacion] of [['AM', rotacionAM], ['PM', rotacionPM]]) {
      const numero = rotacion[i % rotacion.length];
      const equipoId = equipoIdByNumber.get(numero);
      const equipo = EQUIPOS.find((item) => item.numero === numero);
      const nombre = `Equipo ${numero} · ${equipo.lideres.join(' y ')}`;
      const matches = turnosExistentes.filter(
        (row) => row.data.fecha === fecha && (row.data.modalidad ?? null) === modalidad,
      );
      if (matches.length > 1) {
        throw new Error(`Hay ${matches.length} turnos duplicados para ${fecha} ${modalidad}; corrígelos antes de ejecutar el seed`);
      }
      const data = {
        campusId, tipo: TIPO, fecha, equipoId, modalidad,
        equipoNombreSnapshot: nombre, isManualOverride: false, updatedAt: now(),
      };
      if (matches.length === 1) {
        await matches[0].ref.update(data);
        actualizados++;
      } else {
        const id = await nextId('campus_turnos');
        await db.collection('campus_turnos').doc(String(id)).set({ id, ...data, createdAt: now() });
        creados++;
      }
    }
  }

  console.log(`Listo: 12 líderes, 6 equipos, ${creados} turnos creados y ${actualizados} actualizados.`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
