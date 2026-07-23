/**
 * Crea las fichas publicadas de prueba del Campus Santiago para la semana
 * 27-07-2026 — 02-08-2026.
 *
 * Vista previa: node scripts/seed-santiago-test-week-2026-07-27.js
 * Aplicar:      node scripts/seed-santiago-test-week-2026-07-27.js --apply
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

const REGULAR_SECTIONS = [
  'pastoral', 'escena', 'produccion', 'media', 'streaming',
  'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit',
];
const PRAYER_SECTIONS = [
  'pastoral', 'escena', 'produccion', 'media',
  'streaming', 'setList', 'horarios', 'outfit',
];

const REGULAR_ROWS = {
  pastoral: [
    ['p1', 'Bienvenida', 'person', false, true],
    ['p2', 'Predicación', 'person', false, true],
    ['p3', 'Siembra', 'person', false, false],
    ['p4', 'Despedida y Oración', 'person', false, false],
  ],
  escena: [
    ['esc1', 'VIO', 'text', true],
    ['esc2', 'Encargado Armonías', 'person', true],
    ['esc3', 'Voz 1', 'person', true],
    ['esc4', 'Voz 2', 'person', true],
    ['esc5', 'Voz 3', 'person', true],
    ['esc6', 'Gtr Eléctrica / MD', 'person', true],
    ['esc7', 'Piano', 'person', true],
    ['esc8', 'Bajo', 'person', true],
    ['esc9', 'Batería', 'person', true],
    ['esc10', 'Posición Izquierda', 'person', true],
    ['esc11', 'Posición Centro', 'person', true],
    ['esc12', 'Posición Derecha', 'person', true],
    ['esc_comment', 'Comentarios del Productor', 'text', true],
  ],
  produccion: [
    ['pr1', 'Productor General', 'person', true, true],
    ['pr2', 'Encargado Técnico', 'person', true],
    ['pr3', 'Productor del Encuentro', 'person', true, true],
    ['pr4', 'Sonido', 'person', true, true],
    ['pr5', 'Asistente Sonido', 'person', true],
    ['pr6', 'Stage', 'person', true],
    ['pr7', 'Iluminación', 'person', true],
    ['pr8', 'Visuales', 'person', true],
    ['pr9', 'ProPresenter', 'person', true],
    ['pr10', 'Broadcast', 'person', true],
    ['pr11', 'RRSS', 'person', true],
  ],
  media: [
    ['media1', 'Historias', 'person', true],
    ['media2', 'Fotografía', 'person', true],
    ['media3', 'Edición', 'person', true],
    ['media4', 'Registro Audiovisual', 'person', true],
  ],
  streaming: [
    ['st1', 'Director / Wirecast', 'person', true, true],
    ['st2', 'Cam 1', 'person', true],
    ['st3', 'Cam 2', 'person', true],
    ['st4', 'Cam 3 / Pluma', 'person', true],
    ['st5', 'Cam 4 / Móvil', 'person', true],
  ],
  setList: [
    ['sl1', 'Canción 1', 'song', false],
    ['sl2', 'Canción 2', 'song', false],
    ['sl3', 'Canción 3', 'song', false],
    ['sl4', 'Canción 4', 'song', false],
    ['sl5', 'Canción 5', 'song', false],
    ['sl6', 'Canción 6', 'song', false],
  ],
  horarios: [
    ['h1', 'Preparación sala', 'text', true],
    ['h2', 'Apertura puertas', 'text', false],
    ['h3', 'Ensayo', 'text', false],
    ['h4', 'Inicio Encuentro', 'text', false],
    ['h5', 'Inicio Worship', 'text', false],
    ['h6', 'Predicación', 'text', false],
    ['h7', 'Tiempo de Respuesta', 'text', false],
    ['h8', 'Cierre / Despedida', 'text', false],
  ],
  anuncios: [
    ['an1', 'Info Bienvenida', 'text', true],
    ['an2', 'Info Despedida 1', 'text', true],
    ['an3', 'Info Despedida 2', 'text', true],
    ['an4', 'Info Despedida 3', 'text', true],
    ['an5', 'Próximo evento', 'text', true],
  ],
  voluntarios: [
    ['v1', 'Encargado', 'person', true],
    ['v2', 'Carteles 1', 'person', true],
    ['v3', 'Carteles 2', 'person', true],
    ['v4', 'AR Kids', 'person', true],
    ['v5', 'AR Tweens', 'person', true],
    ['v6', 'Cafetería', 'person', true],
    ['v7', 'Ingreso Auditorio', 'person', true],
    ['v8', 'Auditorio', 'person', true],
    ['v9', 'Siembra', 'person', true],
    ['v10', 'Sala bebés', 'person', true],
  ],
  outfit: [
    ['outfit_palette', 'Paleta', 'text', true],
  ],
};

const PRAYER_ROWS = {
  pastoral: [
    ['or_p1', 'Orador 1', 'person', true, true],
    ['or_p2', 'Orador 2', 'person', true],
    ['or_p3', 'Orador 3', 'person', true],
  ],
  escena: [
    ['or_e1', 'Vox / Gtr', 'person', true],
    ['or_e2', 'Vox / Piano', 'person', true],
    ['or_e3', 'Gtr / MD', 'person', true],
  ],
  produccion: [
    ['or_pr1', 'Prod. Responsable', 'person', true, true],
    ['or_pr2', 'Productor', 'person', true],
    ['or_pr3', 'Sala', 'person', true],
    ['or_pr4', 'Asist. Sonido', 'person', true],
    ['or_pr5', 'Broadcast', 'person', true],
    ['or_pr6', 'Stage', 'person', true],
    ['or_pr7', 'Visual / ProPresenter', 'person', true],
    ['or_pr8', 'Visual / Arena', 'person', true],
    ['or_pr10', 'Iluminación', 'person', true],
  ],
  media: REGULAR_ROWS.media,
  streaming: [
    ['or_st1', 'Responsable', 'person', true, true],
    ['or_st2', 'Dir. TV', 'person', true],
    ['or_st3', 'Cam 1', 'person', true],
    ['or_st4', 'Cam 2', 'person', true],
    ['or_st5', 'Cam 3', 'person', true],
    ['or_st6', 'Cam 4 (Móvil)', 'person', true],
  ],
  setList: [
    ['or_sl1', 'Bienvenida — Canción', 'song', true],
    ['or_sl2', 'Gratitud — Canción', 'song', true],
    ['or_sl3', 'Testimonios — Canción', 'song', true],
    ['or_sl4', 'Peticiones — Canción 1', 'song', true],
    ['or_sl5', 'Peticiones — Canción 2', 'song', true],
    ['or_sl6', 'Oración Presencial — Canción 1', 'song', true],
    ['or_sl7', 'Oración Presencial — Canción 2', 'song', true],
  ],
  horarios: [
    ['or_h1', '05:00 — Llegada de Equipo', 'text', true],
    ['or_h2', '05:10-05:40 — Preparativos', 'text', true],
    ['or_h3', '05:25-05:35 — Link de Prueba', 'text', true],
    ['or_h4', '05:40-05:50 — VIO (Tiempo de ajustes)', 'text', true],
    ['or_h5', '05:55 — Ingreso Auditorio', 'text', true],
    ['or_h6', '06:00 — Counter', 'text', true],
    ['or_h7', '06:05-06:08 — Bienvenida', 'person', true],
    ['or_h8', '06:12-06:17 — Gratitud', 'person', true],
    ['or_h9', '06:20-06:26 — Testimonios', 'person', true],
    ['or_h10', '06:29-06:40 — Peticiones Campus Virtual', 'person', true],
    ['or_h11', '06:43-06:55 — Oración Peticiones', 'person', true],
    ['or_h12', '07:00 — Despedida y Agradecimiento', 'person', true],
  ],
  outfit: REGULAR_ROWS.outfit,
};

const SONGS = [
  'Glorioso Día (G)',
  'La Pasión (D)',
  'Jesús en el Centro (G)',
  'Miles de Aleluyas (C)',
  'King of Kings (C)',
  'Tu Fidelidad (G)',
  'En Tu Presencia (G)',
];

function testValue(label, type, index, encounter) {
  if (label === 'Paleta') return 'Negro · Blanco · Gris';
  if (type === 'song') return `${SONGS[index % SONGS.length]} · Equipo de prueba`;
  if (type === 'text') {
    if (label.includes('Comentarios')) return 'Ficha completa creada para validar la visualización móvil.';
    if (label.startsWith('Info')) return `${label}: información de prueba confirmada`;
    if (label === 'Próximo evento') return 'Próxima semana · programación habitual';
    if (label.includes('Inicio Encuentro')) return `${encounter.time} · Inicio confirmado`;
    return `${label} · Configurado`;
  }
  return `${label} · Responsable de prueba`;
}

function buildRows(definitions, encuentros) {
  return definitions.map(([id, label, type, shared, required = false], index) => ({
    id,
    label,
    type,
    shared,
    required,
    order: index,
    values: shared
      ? { shared: testValue(label, type, index, encuentros[0]) }
      : Object.fromEntries(
          encuentros.map((encuentro) => [
            encuentro.id,
            testValue(label, type, index, encuentro),
          ]),
        ),
  }));
}

function buildSections(type, encuentros, now) {
  const isPrayer = type === 'oracion';
  const sectionNames = isPrayer ? PRAYER_SECTIONS : REGULAR_SECTIONS;
  const definitions = isPrayer ? PRAYER_ROWS : REGULAR_ROWS;
  return Object.fromEntries(sectionNames.map((name) => [
    name,
    {
      revision: 1,
      assignedTo: null,
      assignedName: `Responsable de prueba · ${name}`,
      isCompleted: true,
      completedBy: 0,
      completedAt: now,
      rows: buildRows(definitions[name], encuentros),
    },
  ]));
}

function buildFicha(config, campus, now) {
  const sectionNames = config.type === 'oracion' ? PRAYER_SECTIONS : REGULAR_SECTIONS;
  return {
    testSeedKey: config.key,
    campusId: String(campus.id),
    campusName: campus.name,
    type: config.type,
    title: config.title,
    date: admin.firestore.Timestamp.fromDate(new Date(`${config.date}T12:00:00Z`)),
    encuentros: config.encuentros,
    descripcion: 'Ficha completa de prueba para validar el módulo móvil Sirviendo.',
    ubicacion: 'Campus Santiago',
    sections: buildSections(config.type, config.encuentros, now),
    completionStatus: Object.fromEntries(sectionNames.map((name) => [name, true])),
    hiddenSections: [],
    sectionLayout: config.type === 'oracion'
      ? { left: ['pastoral', 'produccion', 'streaming', 'horarios'], right: ['worship', 'media'] }
      : { left: ['pastoral', 'produccion', 'streaming', 'horarios'], right: ['worship', 'media', 'voluntarios', 'anuncios'] },
    status: 'complete',
    published: true,
    publishedBy: 0,
    publishedByName: 'Prueba automatizada',
    publishedAt: now,
    archived: false,
    createdBy: 0,
    createdByName: 'Prueba automatizada',
    createdAt: now,
    lastModifiedBy: 0,
    lastModifiedByName: 'Prueba automatizada',
    lastModifiedAt: now,
  };
}

const FICHAS = [
  {
    key: 'test-santiago-2026-07-29-oracion',
    type: 'oracion',
    title: '[PRUEBA] Encuentro de Oración · 29 Jul 2026',
    date: '2026-07-29',
    encuentros: [
      { id: 'unico', label: 'Encuentro Oración', time: '06:00', isLive: true, color: '#8b5cf6' },
    ],
  },
  {
    key: 'test-santiago-2026-07-29-global',
    type: 'unico',
    title: '[PRUEBA] Miércoles Global · 29 Jul 2026',
    date: '2026-07-29',
    encuentros: [
      { id: 'unico', label: 'Miércoles Global', time: '20:00', isLive: true, color: '#6366f1' },
    ],
  },
  {
    key: 'test-santiago-2026-08-02-am',
    type: 'multi',
    title: '[PRUEBA] Domingo Bloque AM · 2 Ago 2026',
    date: '2026-08-02',
    encuentros: [
      { id: 'e1', label: 'Encuentro I · 09:00', time: '09:00', isLive: false, color: '#6366f1' },
      { id: 'e2', label: 'Encuentro II · 11:00', time: '11:00', isLive: true, color: '#f59e0b' },
      { id: 'e3', label: 'Encuentro III · 13:00', time: '13:00', isLive: false, color: '#10b981' },
    ],
  },
  {
    key: 'test-santiago-2026-08-02-pm',
    type: 'multi',
    title: '[PRUEBA] Domingo Bloque PM · 2 Ago 2026',
    date: '2026-08-02',
    encuentros: [
      { id: 'e1', label: 'Encuentro IV · 17:00', time: '17:00', isLive: false, color: '#ef4444' },
      { id: 'e2', label: 'Encuentro V · 19:00', time: '19:00', isLive: false, color: '#8b5cf6' },
    ],
  },
];

function assertComplete(ficha) {
  for (const [sectionName, section] of Object.entries(ficha.sections)) {
    for (const row of section.rows) {
      const values = Object.values(row.values ?? {});
      if (values.length === 0 || values.some((value) => !String(value).trim())) {
        throw new Error(`${ficha.title}: falta completar ${sectionName}/${row.label}`);
      }
    }
  }
}

async function main() {
  const campusQuery = await db.collection('campuses')
    .where('nameLower', '==', 'santiago')
    .limit(1)
    .get();
  if (campusQuery.empty) throw new Error('Campus Santiago no encontrado');

  const campus = campusQuery.docs[0].data();
  const now = admin.firestore.Timestamp.now();
  const pending = [];
  const existing = [];

  for (const config of FICHAS) {
    const duplicate = await db.collection('fichas')
      .where('testSeedKey', '==', config.key)
      .limit(1)
      .get();
    if (!duplicate.empty) {
      const existingFicha = duplicate.docs[0].data();
      assertComplete(existingFicha);
      if (
        existingFicha.status !== 'complete' ||
        existingFicha.published !== true ||
        existingFicha.archived === true ||
        String(existingFicha.campusId) !== String(campus.id)
      ) {
        throw new Error(`${config.title}: la ficha existente no está completa, publicada y activa`);
      }
      existing.push({ title: config.title, id: duplicate.docs[0].id });
      continue;
    }
    const ficha = buildFicha(config, campus, now);
    assertComplete(ficha);
    pending.push({ config, ficha });
  }

  console.log(`Campus: ${campus.name} (id ${campus.id})`);
  console.log(`Semana: 27-07-2026 — 02-08-2026`);
  for (const item of pending) {
    console.log(`  CREAR: ${item.config.title} (${item.config.encuentros.map((e) => e.time).join(', ')})`);
  }
  for (const item of existing) {
    console.log(`  OMITIR: ${item.title} (ya existe: ${item.id})`);
  }

  if (!APPLY) {
    console.log('\nVista previa solamente. Ejecuta con --apply para crear las fichas.');
    return;
  }

  const batch = db.batch();
  const created = [];
  for (const item of pending) {
    const ref = db.collection('fichas').doc();
    batch.set(ref, { ...item.ficha, fichaId: ref.id });
    created.push({ id: ref.id, title: item.config.title });
  }
  if (created.length > 0) await batch.commit();

  console.log(`\nFichas creadas: ${created.length}`);
  for (const item of created) console.log(`  ${item.id} — ${item.title}`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  admin,
  db,
  buildFicha,
  assertComplete,
};
