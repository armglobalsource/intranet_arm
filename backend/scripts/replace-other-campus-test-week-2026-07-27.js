/**
 * Reemplaza todas las fichas de campus distintos de Santiago por fichas
 * completas y publicadas para la semana 27-07-2026 — 02-08-2026.
 *
 * Vista previa: node scripts/replace-other-campus-test-week-2026-07-27.js
 * Aplicar:      node scripts/replace-other-campus-test-week-2026-07-27.js --apply
 */
const {
  admin,
  db,
  buildFicha,
  assertComplete,
} = require('./seed-santiago-test-week-2026-07-27');

const APPLY = process.argv.includes('--apply');
const WEEK_MONDAY = '2026-07-27';
const DAY_OFFSETS = {
  lunes: 0,
  martes: 1,
  miercoles: 2,
  jueves: 3,
  viernes: 4,
  sabado: 5,
  domingo: 6,
};

function normalized(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function slug(value) {
  return normalized(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateForConfig(config) {
  const firstWord = normalized(config.dia).split(/\s+/)[0];
  const offset = DAY_OFFSETS[firstWord];
  if (offset === undefined) throw new Error(`Día no reconocido: ${config.dia}`);
  return addDays(WEEK_MONDAY, offset);
}

function dateLabel(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fichaBelongsToCampus(ficha, campus) {
  const id = String(ficha.campusId ?? '');
  const campusSlug = slug(campus.name);
  const validIds = new Set([
    String(campus.id),
    `campus-${campusSlug}`,
    `arm-${campusSlug}`,
    campusSlug,
  ]);
  if (validIds.has(normalized(id))) return true;

  const fichaName = normalized(ficha.campusName)
    .replace(/^campus\s+/, '')
    .replace(/^arm\s+/, '');
  return fichaName === normalized(campus.name);
}

function buildConfigs(campus) {
  const configs = campus.encuentrosConfig ?? [];
  if (configs.length === 0) {
    throw new Error(`${campus.name} no tiene encuentrosConfig`);
  }

  return configs.map((config, index) => {
    const date = dateForConfig(config);
    const encuentros = (config.encuentros ?? []).map((encuentro, encounterIndex) => ({
      id: encuentrosId(config.encuentros.length, encounterIndex),
      label: encuentro.label,
      time: encuentro.time,
      isLive: Boolean(encuentro.isLive),
      color: encuentro.color || '#6366f1',
    }));
    if (encuentros.length === 0) {
      throw new Error(`${campus.name}/${config.dia} no tiene horarios`);
    }
    const type = config.fichaType === 'oracion'
      ? 'oracion'
      : encuentros.length > 1 ? 'multi' : 'unico';
    return {
      key: `test-${slug(campus.name)}-${date}-${index + 1}`,
      type,
      title: `[PRUEBA] ${campus.name} · ${config.dia} · ${dateLabel(date)}`,
      date,
      encuentros,
    };
  });
}

function encuentrosId(total, index) {
  return total === 1 ? 'unico' : `e${index + 1}`;
}

async function prepare() {
  const [campusSnapshot, fichaSnapshot] = await Promise.all([
    db.collection('campuses').get(),
    db.collection('fichas').get(),
  ]);
  const campuses = campusSnapshot.docs
    .map((doc) => ({ docId: doc.id, ...doc.data() }))
    .filter((campus) => campus.isActive !== false)
    .filter((campus) => normalized(campus.name) !== 'santiago')
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const existingFichas = fichaSnapshot.docs.map((doc) => ({
    ref: doc.ref,
    id: doc.id,
    data: doc.data(),
  }));
  const targets = existingFichas.filter((ficha) =>
    campuses.some((campus) => fichaBelongsToCampus(ficha.data, campus)),
  );
  const untouched = existingFichas.filter((ficha) => !targets.includes(ficha));

  const now = admin.firestore.Timestamp.now();
  const creations = campuses.flatMap((campus) =>
    buildConfigs(campus).map((config) => {
      const ficha = buildFicha(config, campus, now);
      assertComplete(ficha);
      return { campus, config, ficha };
    }),
  );

  return { campuses, targets, untouched, creations };
}

function printPlan(plan) {
  console.log('Semana: 27-07-2026 — 02-08-2026');
  console.log(`Campus a regenerar: ${plan.campuses.length}`);
  console.log(`Fichas a eliminar: ${plan.targets.length}`);
  console.log(`Fichas nuevas: ${plan.creations.length}\n`);

  for (const campus of plan.campuses) {
    const deleting = plan.targets.filter((ficha) => fichaBelongsToCampus(ficha.data, campus));
    const creating = plan.creations.filter((item) => item.campus.id === campus.id);
    console.log(`${campus.name}: eliminar ${deleting.length}, crear ${creating.length}`);
    for (const item of creating) {
      console.log(`  ${item.config.date} · ${item.config.encuentros.map((e) => e.time).join(', ')} · ${item.config.title}`);
    }
  }
  console.log(`\nFichas fuera del alcance y preservadas: ${plan.untouched.length}`);
}

async function applyPlan(plan) {
  const batch = db.batch();
  let changelogCount = 0;

  for (const target of plan.targets) {
    const changelog = await target.ref.collection('changelog').get();
    for (const entry of changelog.docs) {
      batch.delete(entry.ref);
      changelogCount += 1;
    }
    batch.delete(target.ref);
  }

  const created = [];
  for (const item of plan.creations) {
    const ref = db.collection('fichas').doc();
    batch.set(ref, { ...item.ficha, fichaId: ref.id });
    created.push({ id: ref.id, ...item });
  }

  if (plan.targets.length + changelogCount + created.length >= 500) {
    throw new Error('La operación excede el límite seguro de un batch');
  }
  await batch.commit();
  return { created, changelogCount };
}

async function verify(expectedCreations) {
  const snapshot = await db.collection('fichas').get();
  const expectedKeys = new Set(expectedCreations.map((item) => item.config.key));
  const found = [];

  for (const doc of snapshot.docs) {
    const ficha = doc.data();
    if (!expectedKeys.has(ficha.testSeedKey)) continue;
    assertComplete(ficha);
    if (
      ficha.status !== 'complete' ||
      ficha.published !== true ||
      ficha.archived === true
    ) {
      throw new Error(`${doc.id}: ficha de prueba inválida`);
    }
    found.push(doc.id);
  }
  if (found.length !== expectedKeys.size) {
    throw new Error(`Se esperaban ${expectedKeys.size} fichas y se encontraron ${found.length}`);
  }
  return found;
}

async function main() {
  const plan = await prepare();
  printPlan(plan);

  if (!APPLY) {
    console.log('\nVista previa solamente. Ejecuta con --apply para reemplazar las fichas.');
    return;
  }

  const result = await applyPlan(plan);
  const verified = await verify(plan.creations);
  console.log(`\nEliminadas: ${plan.targets.length}`);
  console.log(`Entradas de historial eliminadas: ${result.changelogCount}`);
  console.log(`Creadas y verificadas: ${verified.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
