/**
 * Sincroniza áreas, equipos y membresías con el organigrama-arm-5.0.html
 * Uso: node scripts/sync-orgchart-firestore.js
 *      node scripts/sync-orgchart-firestore.js --dry-run
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const admin = require('firebase-admin');
const path  = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// Busca el service-account en el directorio del script primero, luego en el principal
const relKey = path.resolve(__dirname, '../', process.env.FIREBASE_KEY_FILE || './service-account.json');
const mainKey = path.resolve('/Users/luisramirezbriones/Developer/ARM/intranet_arm/backend/service-account.json');
const keyFile = require('fs').existsSync(relKey) ? relKey : mainKey;
admin.initializeApp({
  credential: admin.credential.cert(keyFile),
  projectId:  process.env.FIREBASE_PROJECT_ID,
});
const db = admin.firestore();

const AREAS_COL       = 'org_areas';
const TEAMS_COL       = 'org_teams';
const MEMBERSHIPS_COL = 'org_memberships';
const COUNTERS_COL    = '_counters';

// ── Auto-increment (idéntico a FirebaseService.nextId) ──────────────────────
async function nextId(collection) {
  const ref = db.collection(COUNTERS_COL).doc(collection);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = snap.exists ? snap.data().next : 1;
    tx.set(ref, { next: next + 1 });
    return next;
  });
}

function now() { return admin.firestore.FieldValue.serverTimestamp(); }
function log(msg) { console.log(msg); }

// ══════════════════════════════════════════════════════════════════════════════
// DATOS CANÓNICOS — extraídos directamente del organigrama-arm-5.0.html
// ══════════════════════════════════════════════════════════════════════════════

const AREAS_DEF = [
  { slug:'worship',    name:'AR Worship',         color:'#D97706', icon:'🎵', sortOrder:0,
    desc:'Lideran el ministerio musical de adoración con foco en el desarrollo espiritual' },
  { slug:'produccion', name:'Producción',          color:'#0D9488', icon:'⚙️',  sortOrder:1,
    desc:'Coordinan la parte técnica y logística de todos los encuentros y eventos' },
  { slug:'media',      name:'Media',               color:'#2563EB', icon:'📸', sortOrder:2,
    desc:'Crean y gestionan los contenidos integrando fotografía, audiovisual y redes sociales' },
  { slug:'creativa',   name:'Dirección Creativa',  color:'#DB2777', icon:'🎨', sortOrder:3,
    desc:'Entregan soluciones creativas y dirección artística a los distintos equipos' },
  { slug:'marketing',  name:'Marketing Digital',   color:'#7C3AED', icon:'📱', sortOrder:4,
    desc:'Impulsan el crecimiento de las plataformas digitales a través de campañas pagadas' },
];

// (areaSlug, name, icon, colPosition, sortOrder, desc)
const TEAMS_DEF = [
  // ── WORSHIP ────────────────────────────────────────────────────────────────
  ['worship', 'Enc. de Worship', '📍', 1, 0,
   'Dirigen el equipo de forma local, siendo el puente entre su campus y los directores generales, y ejecutando tareas específicas de su contexto.'],
  ['worship', 'Directores Musicales', '🎼', 1, 1,
   '• Es quien lidera al equipo en escena.\n• Indica a través de la plataforma Play List, la lista de canciones completa que lleva un encuentro o un evento.\n• Carga las canciones en plataforma y además se preocupa de las transiciones entre canción.\n• Dirige al equipo en la estructura de las canciones.'],
  ['worship', 'Enc. por Instrumento', '🎸', 2, 0,
   'Dan soporte musical y alineación técnica a cada instrumento, velando por la calidad y cohesión del equipo en su área específica. De manera global o local.'],
  ['worship', 'Equipo Prod. Musical', '🎛️', 3, 0,
   'Se encarga de procesos como mastering, edición, creación de playlists para eventos y coordinación de grabaciones y proyectos musicales del área.'],
  ['worship', 'Finanzas del Área', '📊', 4, 0,
   'Gestiona y da seguimiento a los recursos económicos del área, velando por una administración ordenada y responsable.'],
  ['worship', 'Equipo ARW', '🎤', 1, 2,
   'La banda de voluntarios que sirve musicalmente en los encuentros regulares y eventos especiales de la organización.'],

  // ── PRODUCCIÓN ─────────────────────────────────────────────────────────────
  ['produccion', 'Equipo de Producción', '📍', 1, 0,
   'Llevan la producción de los encuentros y eventos de su campus, entregando dirección local y ejecutando las tareas específicas que cada contexto requiere.'],
  ['produccion', 'Equipo de Visuales', '🎬', 1, 1,
   'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción. Solo en algunos campus estos equipos cuentan con apoyo de encargados que lideran el área específica con tareas concretas y seguimiento directo a su equipo.'],
  ['produccion', 'Equipo de Iluminación', '💡', 1, 2,
   'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción. Solo en algunos campus estos equipos cuentan con apoyo de encargados que lideran el área específica con tareas concretas y seguimiento directo a su equipo.'],
  ['produccion', 'Equipo de Sonido', '🔊', 1, 3,
   'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción. Solo en algunos campus estos equipos cuentan con apoyo de encargados que lideran el área específica con tareas concretas y seguimiento directo a su equipo.'],
  ['produccion', 'Equipo de Stage', '🎭', 1, 4,
   'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción. Solo en algunos campus estos equipos cuentan con apoyo de encargados que lideran el área específica con tareas concretas y seguimiento directo a su equipo.'],
  ['produccion', 'Equipo de Dirección', '📋', 1, 5,
   'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del equipo de producción. Solo en algunos campus estos equipos cuentan con apoyo de encargados que lideran el área específica con tareas concretas y seguimiento directo a su equipo.'],
  ['produccion', 'Productores Específicos', '🎯', 2, 0, null],
  ['produccion', 'Soporte Técnico Global', '🔧', 3, 0,
   'Personas con roles en otras áreas que prestan apoyo especializado ante problemáticas técnicas complejas o situaciones imprevistas que el equipo necesite resolver.'],

  // ── MEDIA ──────────────────────────────────────────────────────────────────
  ['media', 'Enc. de Media', '📍', 1, 0,
   'Coordinan el área de forma local, gestionando los requerimientos del equipo, administrando el calendario y velando por el buen funcionamiento del voluntariado en su campus.'],
  ['media', 'Equipo Audiovisual', '🎥', 1, 1,
   'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del encargado de media. Solo en algunos campus estos equipos cuentan con apoyo de encargados que lideran el área específica con tareas concretas y seguimiento directo a su equipo.'],
  ['media', 'Equipo de Fotografía', '📷', 1, 2,
   'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del encargado de media. Solo en algunos campus estos equipos cuentan con apoyo de encargados que lideran el área específica con tareas concretas y seguimiento directo a su equipo.'],
  ['media', 'Equipo de Stories', '✨', 1, 3,
   'Sirven de forma presencial en los encuentros y eventos, siendo las manos operativas del área en cada campus. Reciben directrices del encargado de media. Solo en algunos campus estos equipos cuentan con apoyo de encargados que lideran el área específica con tareas concretas y seguimiento directo a su equipo.'],
  ['media', 'Enc. de Cuentas', '📱', 2, 0,
   'Gestionan la grilla de contenido y mantienen activas las cuentas de Instagram de cada campus, asegurando publicaciones consistentes y alineadas con la comunicación de la organización.'],
  ['media', 'Equipo Focalizado', '🌐', 3, 0,
   'Equipo 100% focalizado en generar contenido específico para la cuenta central y página web.'],

  // ── CREATIVA ───────────────────────────────────────────────────────────────
  ['creativa', 'Equipo Creativo', '✨', 1, 0,
   'Trabaja junto al Director Creativo en eventos especiales, proyectos de alto impacto y desafíos comunicacionales que requieren un desarrollo creativo más profundo.'],
  ['creativa', 'Diseño Gráfico', '🎨', 2, 0,
   'Responsables del branding de la organización y de responder a los requerimientos gráficos que surgen desde los distintos equipos y proyectos.'],
  ['creativa', 'Streaming Global', '📡', 3, 0,
   'Lideran el despliegue técnico y creativo de las transmisiones en vivo, cubriendo todos los eventos y encuentros de la organización que requieran streaming.'],
  ['creativa', 'Desarrollo Web', '💻', 4, 0,
   'Gestionan áreas específicas que requieren dirección creativa para su desarrollo, asegurando que cada plataforma comunique con coherencia y propósito.'],

  // ── MARKETING ──────────────────────────────────────────────────────────────
  ['marketing', 'Equipo de Marketing', '📣', 1, 0,
   'Creativos especializados que ejecutan tareas específicas de producción para las campañas, incluyendo video y ajustes de diseño orientados al marketing.'],
  ['marketing', 'Asesores de Estrategia', '💡', 2, 0,
   'Aportan perspectiva externa y proponen mejoras a las estrategias del área, colaborando con el director para afinar el enfoque de cada campaña.'],
];

// Mapeo nombre → user_id (IDs tal como están en Firestore users)
const NAME_TO_ID = {
  'patricia burgos':    3,
  'patricio burgos':    4,
  'rodrigo quiroz':     5,
  'priscilla fabio':    6,
  'pri fabio':          6,
  'nicolás burgos':     7,
  'nicolas burgos':     7,
  'nico burgos':        7,
  'pablo ortiz':        8,
  'newman guevara':     9,
  'samuel montalva':   10,
  'anderson león':     11,
  'anderson leon':     11,
  'kari alvarez':      12,
  'karina álvarez':    12,
  'karina alvarez':    12,
  'ismael gonzález':   13,
  'ismael gonzalez':   13,
  'isma gonzález':     13,
  'isma gonzalez':     13,
  'treicy aceitón':    14,
  'treicy aceito':     14,
  'kika muñoz':        15,
  'kika munoz':        15,
  'paola ortiz':       16,
  'kengev peña':       17,
  'kengev pena':       17,
  'naty delfín':       18,
  'naty delfin':       18,
  'benjamín saavedra': 19,
  'benjamin saavedra': 19,
  'benja saavedra':    19,
  'alejandro montero': 20,
  'andrés zamorano':   21,
  'andres zamorano':   21,
  'josué ferrer':      22,
  'josue ferrer':      22,
  'fer herrera':       23,
  'fernanda herrera':  23,
  'mateo quiroz':      24,
  'bayron gonzález':   25,
  'bayron gonzalez':   25,
  'carolina cepeda':   26,
  'caro cepeda':       26,
  'adriana oliveros':  27,
  'adri oliveros':     27,
  'patricia alarcón':  28,
  'patricia alarcon':  28,
  'naty segura':       29,
  'aileen gonzález':   30,
  'aileen gonzalez':   30,
  'mariangela morin':  31,
  'marianyela morin':  31,
  'bastián oyarzo':    32,
  'bastian oyarzo':    32,
  'paulina vásquez':   33,
  'paulina vasquez':   33,
  'pauli vasquez':     33,
  'carlos labarca':    34,
  'gabriela rojas':    35,
  'gaby rojas':        35,
  'gabi rojas':        35,
  'césar osses':       36,
  'cesar osses':       36,
  'jo osses':          36,
  'sara montero':      37,
  'claudio navea':     38,
};

// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  log(`\n${'='.repeat(60)}`);
  log(`  Sincronizando organigrama en Firestore${DRY_RUN ? ' (DRY RUN)' : ''}`);
  log(`  Proyecto: ${process.env.FIREBASE_PROJECT_ID}`);
  log(`${'='.repeat(60)}\n`);

  // ── 1. ÁREAS ──────────────────────────────────────────────────────────────
  log('1. Sincronizando áreas...');

  const areasSnap = await db.collection(AREAS_COL).get();
  const existingAreas = {};
  areasSnap.docs.forEach(d => {
    const data = d.data();
    existingAreas[data.slug] = { id: data.id, docId: d.id, ...data };
  });

  const areaIdMap = {}; // slug → numeric id

  for (const area of AREAS_DEF) {
    const existing = existingAreas[area.slug];
    if (existing) {
      areaIdMap[area.slug] = existing.id;
      const update = {
        name: area.name, color: area.color, icon: area.icon,
        desc: area.desc, sortOrder: area.sortOrder, isActive: true,
        updatedAt: now(),
      };
      if (!DRY_RUN) {
        await db.collection(AREAS_COL).doc(String(existing.id)).update(update);
      }
      log(`  ✓ [update] ${area.name} (id=${existing.id})`);
    } else {
      const id = DRY_RUN ? 999 : await nextId(AREAS_COL);
      areaIdMap[area.slug] = id;
      const doc = {
        id, slug: area.slug, name: area.name, color: area.color,
        icon: area.icon, desc: area.desc, sortOrder: area.sortOrder,
        isActive: true, iconUrl: null, createdAt: now(), updatedAt: now(),
      };
      if (!DRY_RUN) {
        await db.collection(AREAS_COL).doc(String(id)).set(doc);
      }
      log(`  ✓ [create] ${area.name} (id=${id})`);
    }
  }

  // ── 2. EQUIPOS ────────────────────────────────────────────────────────────
  log('\n2. Sincronizando equipos...');

  const teamsSnap = await db.collection(TEAMS_COL).get();
  const existingTeams = {}; // "areaId:nameLower" → { id, docId }
  const canonicalTeamKeys = new Set();

  teamsSnap.docs.forEach(d => {
    const data = d.data();
    const key = `${data.areaId}:${data.name.toLowerCase()}`;
    existingTeams[key] = { id: data.id, docId: d.id, ...data };
  });

  const teamIdMap = {}; // "areaSlug:teamName" → numeric id

  for (const [areaSlug, name, icon, colPosition, sortOrder, desc] of TEAMS_DEF) {
    const areaId = areaIdMap[areaSlug];
    if (!areaId) { log(`  ⚠️  Área no encontrada: ${areaSlug}`); continue; }

    const key = `${areaId}:${name.toLowerCase()}`;
    canonicalTeamKeys.add(key);
    const existing = existingTeams[key];

    if (existing) {
      teamIdMap[`${areaSlug}:${name}`] = existing.id;
      const update = {
        name, icon, colPosition, sortOrder,
        desc: desc ?? null, isActive: true, updatedAt: now(),
      };
      if (!DRY_RUN) {
        await db.collection(TEAMS_COL).doc(String(existing.id)).update(update);
      }
      log(`  ✓ [update] [${areaSlug}] ${name} (id=${existing.id})`);
    } else {
      const id = DRY_RUN ? 999 : await nextId(TEAMS_COL);
      teamIdMap[`${areaSlug}:${name}`] = id;
      const doc = {
        id, areaId, name, icon, colPosition, sortOrder,
        desc: desc ?? null, isActive: true, iconUrl: null,
        createdAt: now(), updatedAt: now(),
      };
      if (!DRY_RUN) {
        await db.collection(TEAMS_COL).doc(String(id)).set(doc);
      }
      log(`  ✓ [create] [${areaSlug}] ${name} (id=${id})`);
    }
  }

  // Desactivar equipos que ya no están en la lista canónica
  let deactivated = 0;
  for (const [key, team] of Object.entries(existingTeams)) {
    if (!canonicalTeamKeys.has(key) && team.isActive) {
      if (!DRY_RUN) {
        await db.collection(TEAMS_COL).doc(String(team.id)).update({ isActive: false, updatedAt: now() });
      }
      log(`  ✗ [deactivate] ${team.name} (id=${team.id})`);
      deactivated++;
    }
  }
  if (deactivated === 0) log('  (sin equipos a desactivar)');

  // ── 3. MEMBRESÍAS ─────────────────────────────────────────────────────────
  log('\n3. Reconstruyendo membresías...');

  // Eliminar todas las membresías existentes
  if (!DRY_RUN) {
    const membSnap = await db.collection(MEMBERSHIPS_COL).get();
    const deleteOps = [];
    membSnap.docs.forEach(d => deleteOps.push(d.ref.delete()));
    await Promise.all(deleteOps);
    log(`  ✓ ${membSnap.docs.length} membresías eliminadas`);
  } else {
    log('  (dry-run: skip delete memberships)');
  }

  // Construir lista canónica de membresías
  // (userId, areaId|null, teamId|null, role, customTitle|null, sortOrder)
  const memberships = [];

  const wId  = areaIdMap['worship'];
  const pId  = areaIdMap['produccion'];
  const mId  = areaIdMap['media'];
  const cId  = areaIdMap['creativa'];
  const mkId = areaIdMap['marketing'];

  function tid(areaSlug, teamName) { return teamIdMap[`${areaSlug}:${teamName}`] ?? null; }
  function push(userId, areaId, teamId, role, customTitle, sortOrder) {
    if (!userId) return;
    memberships.push({ userId, areaId: areaId ?? null, teamId: teamId ?? null, role, customTitle: customTitle ?? null, sortOrder });
  }

  // ── WORSHIP — líderes del área
  for (const uid of [3, 4, 5, 6]) push(uid, wId, null, 'area_leader', null, 0);

  // Enc. de Worship
  const encW = tid('worship', 'Enc. de Worship');
  [
    [6,  'Campus Santiago'],
    [5,  'Campus Santiago'],
    [6,  'Campus Puente Alto'],
    [8,  'Campus Montevideo'],
    [9,  'Campus Punta Arenas'],
    [10, 'Campus Concepción'],
    [11, 'Campus Maracaibo'],
    [12, 'Campus Katy'],
    [8,  'Campus La Plata'],
  ].forEach(([uid, title], i) => push(uid, null, encW, i === 0 ? 'team_leader' : 'member', title, i));

  // Directores Musicales
  const dirM = tid('worship', 'Directores Musicales');
  [
    [13, 'Campus Santiago y Puente Alto'],
    [5,  'Campus Santiago y Puente Alto'],
    [6,  'Campus Santiago y Puente Alto'],
    [7,  'Campus Katy'],
    [8,  'Campus Montevideo'],
    [9,  'Campus Punta Arenas'],
    [10, 'Campus Concepción'],
    [11, 'Campus Maracaibo'],
    [12, 'Campus Katy'],
  ].forEach(([uid, title], i) => push(uid, null, dirM, i === 0 ? 'team_leader' : 'member', title, i));

  // Enc. por Instrumento
  const encI = tid('worship', 'Enc. por Instrumento');
  [
    [14, 'Voces'],
    [13, 'Bajistas'],
  ].forEach(([uid, title], i) => push(uid, null, encI, i === 0 ? 'team_leader' : 'member', title, i));

  // Equipo Prod. Musical
  const prodM = tid('worship', 'Equipo Prod. Musical');
  [
    [13, 'Productor Musical'],
    [7,  'Ingeniero de Mezcla'],
    [5,  'Composición'],
    [6,  'Composición'],
    [7,  'Composición'],
  ].forEach(([uid, title], i) => push(uid, null, prodM, i === 0 ? 'team_leader' : 'member', title, i));

  // Finanzas del Área
  const fin = tid('worship', 'Finanzas del Área');
  [
    [15, 'Encargada Chile'],
    [16, 'Encargada Montevideo'],
  ].forEach(([uid, title], i) => push(uid, null, fin, i === 0 ? 'team_leader' : 'member', title, i));

  // Equipo ARW — voluntarios, sin usuarios concretos

  // ── PRODUCCIÓN — líderes del área
  for (const uid of [4, 5]) push(uid, pId, null, 'area_leader', null, 0);

  // Equipo de Producción
  const eqP = tid('produccion', 'Equipo de Producción');
  [
    [17, 'Campus Santiago'],
    [18, 'Campus Santiago'],
    [19, 'Campus Santiago'],
    [20, 'Campus Montevideo'],
    [9,  'Campus Punta Arenas'],
    [21, 'Campus Concepción'],
    [11, 'Campus Maracaibo'],
    [7,  'Campus Katy'],
  ].forEach(([uid, title], i) => push(uid, null, eqP, i === 0 ? 'team_leader' : 'member', title, i));

  // Equipo de Visuales
  const eqV = tid('produccion', 'Equipo de Visuales');
  [
    [25, 'Encargado campus Stgo'],
    [26, 'Encargada campus Pte'],
    [31, 'Encargada campus Montevideo'],
  ].forEach(([uid, title], i) => push(uid, null, eqV, i === 0 ? 'team_leader' : 'member', title, i));

  // Equipo de Iluminación
  const eqIl = tid('produccion', 'Equipo de Iluminación');
  [
    [27, 'Encargada campus Pte'],
    // Rubén Albornoz / Elkin Traspalacio — no están en DB
  ].forEach(([uid, title], i) => push(uid, null, eqIl, 'team_leader', title, i));

  // Equipo de Sonido
  const eqS = tid('produccion', 'Equipo de Sonido');
  [
    [19, 'Encargado campus Stgo'],
    [21, 'Encargado campus Concepción'],
    [11, 'Encargado campus Maracaibo'],
  ].forEach(([uid, title], i) => push(uid, null, eqS, i === 0 ? 'team_leader' : 'member', title, i));

  // Equipo de Stage
  const eqSt = tid('produccion', 'Equipo de Stage');
  [
    [19, 'Encargado campus Stgo'],
  ].forEach(([uid, title], i) => push(uid, null, eqSt, 'team_leader', title, i));

  // Equipo de Dirección — sin asignar, skip

  // Productores Específicos
  const prodE = tid('produccion', 'Productores Específicos');
  [
    [24, 'Prod. Experiencias Virtual'],
    [22, 'Prod. de Oración Global'],
    [23, 'Prod. Programación Global'],
  ].forEach(([uid, title], i) => push(uid, null, prodE, i === 0 ? 'team_leader' : 'member', title, i));

  // Soporte Técnico Global
  const sop = tid('produccion', 'Soporte Técnico Global');
  [
    [25, 'Visuales'],
    [27, 'Iluminación'],
    [19, 'Sonido'],
  ].forEach(([uid, title], i) => push(uid, null, sop, 'member', title, i));

  // ── MEDIA — líderes del área
  for (const uid of [28, 29]) push(uid, mId, null, 'area_leader', null, 0);

  // Enc. de Media
  const encM = tid('media', 'Enc. de Media');
  [
    [30, 'Campus Santiago'],
    [29, 'Campus Puente Alto'],
    [31, 'Campus Montevideo'],
    [32, 'Campus Punta Arenas'],
    [33, 'Campus Concepción'],
    [34, 'Campus Maracaibo'],
  ].forEach(([uid, title], i) => push(uid, null, encM, i === 0 ? 'team_leader' : 'member', title, i));

  // Equipo Audiovisual
  const eqAv = tid('media', 'Equipo Audiovisual');
  [
    [35, 'Encargada campus Stgo'],
    [31, 'Encargada campus Montevideo'],
  ].forEach(([uid, title], i) => push(uid, null, eqAv, i === 0 ? 'team_leader' : 'member', title, i));

  // Equipo de Fotografía — "Por confirmar" / Rotatorio, sin usuarios

  // Equipo de Stories — Javiera Burgos / Donella San Martín, sin usuarios en DB

  // Enc. de Cuentas
  const encC = tid('media', 'Enc. de Cuentas');
  [
    [30, 'Campus Santiago'],
    [26, 'Campus Puente Alto'],
    [37, 'Campus Montevideo'],
    [33, 'Campus Concepción'],
    [7,  'Campus Katy'],
    [37, 'Campus La Plata'],
    [26, 'Campus La Plata'],
    [29, 'Campus La Plata'],
  ].forEach(([uid, title], i) => push(uid, null, encC, i === 0 ? 'team_leader' : 'member', title, i));

  // Equipo Focalizado
  const eqF = tid('media', 'Equipo Focalizado');
  [
    [35, 'Encargada'],
  ].forEach(([uid, title], i) => push(uid, null, eqF, 'team_leader', title, i));

  // ── CREATIVA — líder del área
  push(7, cId, null, 'area_leader', 'Director Creativo y Pastor Campus Virtual', 0);

  // Equipo Creativo
  const eqCr = tid('creativa', 'Equipo Creativo');
  [
    [23, 'Creativo'],
    [38, 'Creativo'],
  ].forEach(([uid, title], i) => push(uid, null, eqCr, i === 0 ? 'team_leader' : 'member', title, i));

  // Diseño Gráfico
  const disG = tid('creativa', 'Diseño Gráfico');
  [
    [37, 'Encargada de Diseño'],
  ].forEach(([uid, title], i) => push(uid, null, disG, 'team_leader', title, i));

  // Streaming Global
  const strG = tid('creativa', 'Streaming Global');
  [
    [36, 'Productor de Streaming'],
  ].forEach(([uid, title], i) => push(uid, null, strG, 'team_leader', title, i));

  // Desarrollo Web
  const desW = tid('creativa', 'Desarrollo Web');
  [
    [26, 'Páginas Web'],
    [19, 'Admin YouTube'],
    [24, 'Experiencias Zoom'],
  ].forEach(([uid, title], i) => push(uid, null, desW, i === 0 ? 'team_leader' : 'member', title, i));

  // ── MARKETING — líder del área
  push(38, mkId, null, 'area_leader', 'Director de Marketing Digital', 0);

  // Equipo de Marketing
  const eqMk = tid('marketing', 'Equipo de Marketing');
  [
    [19, 'Audiovisual'],
  ].forEach(([uid, title], i) => push(uid, null, eqMk, 'team_leader', title, i));

  // Asesores de Estrategia — Isa Zambrano, Marco Mella, Victor Reyes, sin usuarios en DB

  // Deduplicar
  const seen = new Set();
  const unique = memberships.filter(m => {
    const key = `${m.userId}:${m.areaId}:${m.teamId}:${m.role}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  log(`  Total membresías a insertar: ${unique.length}`);

  if (!DRY_RUN) {
    // Insertar en lotes de 500 (límite Firestore batch)
    const BATCH_SIZE = 490;
    let inserted = 0;
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = unique.slice(i, i + BATCH_SIZE);
      for (const m of chunk) {
        const id = await nextId(MEMBERSHIPS_COL);
        const ref = db.collection(MEMBERSHIPS_COL).doc(String(id));
        batch.set(ref, { id, ...m, createdAt: now(), updatedAt: now() });
        inserted++;
      }
      await batch.commit();
    }
    log(`  ✓ ${inserted} membresías insertadas`);
  } else {
    unique.forEach((m, i) => log(`  [dry] (${i+1}) uid=${m.userId} team=${m.teamId} area=${m.areaId} role=${m.role} title=${m.customTitle}`));
  }

  // ── VERIFICACIÓN FINAL ────────────────────────────────────────────────────
  log('\n4. Verificación...');
  const [aFinal, tFinal, mFinal] = await Promise.all([
    db.collection(AREAS_COL).where('isActive', '==', true).get(),
    db.collection(TEAMS_COL).where('isActive', '==', true).get(),
    db.collection(MEMBERSHIPS_COL).get(),
  ]);
  log(`  Áreas activas:    ${aFinal.size}`);
  log(`  Equipos activos:  ${tFinal.size}`);
  log(`  Membresías:       ${mFinal.size}`);

  log(`\n✅ Sincronización completada\n`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
