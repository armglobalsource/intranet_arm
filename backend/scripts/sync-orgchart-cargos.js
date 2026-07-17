/**
 * Sincroniza el customTitle de cada membresía del organigrama como Cargo
 * (jobTitles) de la persona en Personas — el organigrama es hoy la fuente
 * de verdad y la mayoría de las personas tiene Cargos vacío.
 *
 * Solo AGREGA cargos, nunca quita uno existente.
 *
 * Uso:
 *   node scripts/sync-orgchart-cargos.js              (dry-run, solo reporta)
 *   node scripts/sync-orgchart-cargos.js --apply       (aplica los cambios)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

const APPLY = process.argv.includes('--apply');

const relKey  = path.resolve(__dirname, '../', process.env.FIREBASE_KEY_FILE || './service-account.json');
const mainKey = path.resolve('/Users/luisramirezbriones/Developer/ARM/intranet_arm/backend/service-account.json');
const keyFile = fs.existsSync(relKey) ? relKey : mainKey;
admin.initializeApp({
  credential: admin.credential.cert(keyFile),
  projectId:  process.env.FIREBASE_PROJECT_ID,
});
const db = admin.firestore();

const MEMBERSHIPS_COL = 'org_memberships';
const JOB_TITLES_COL  = 'job_titles';
const USERS_COL       = 'users';
const COUNTERS_COL    = '_counters';

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

async function main() {
  console.log(APPLY ? '🚀 Modo APLICAR — se van a escribir cambios en Firestore\n' : '🔎 Modo DRY-RUN — solo reporte, nada se escribe (usa --apply para ejecutar)\n');

  const [membSnap, jobTitlesSnap, usersSnap] = await Promise.all([
    db.collection(MEMBERSHIPS_COL).get(),
    db.collection(JOB_TITLES_COL).get(),
    db.collection(USERS_COL).get(),
  ]);

  // Cargos existentes, indexados por nombre normalizado
  const jobTitleByNameLower = new Map(); // nameLower -> { id, name }
  jobTitlesSnap.docs.forEach((d) => {
    const data = d.data();
    jobTitleByNameLower.set(data.nameLower, { id: data.id, name: data.name });
  });

  // Usuarios, indexados por id, con su lista actual de jobTitles (mutable en memoria)
  const userById = new Map(); // id -> { ref, jobTitles: [...] , name }
  usersSnap.docs.forEach((d) => {
    const data = d.data();
    userById.set(data.id, {
      ref: d.ref,
      jobTitles: [...(data.jobTitles ?? [])],
      name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || `#${data.id}`,
    });
  });

  const toCreate   = new Map(); // nameLower -> { name, users: Set<userId> }
  const toAssign   = new Map(); // nameLower -> { name, users: Set<userId> } (cargo ya existe, falta asignar a algunas personas)
  const alreadyOk  = new Set(); // userId+nameLower que ya están sincronizados
  let skippedNoUser = 0;
  let skippedEmpty  = 0;

  for (const m of membSnap.docs) {
    const data = m.data();
    const raw = (data.customTitle ?? '').trim();
    if (!raw) { skippedEmpty++; continue; }

    const nameLower = raw.toLowerCase();
    const user = userById.get(data.userId);
    if (!user) { skippedNoUser++; continue; }

    const existing = jobTitleByNameLower.get(nameLower);
    if (existing) {
      const hasIt = user.jobTitles.some((jt) => jt.jobTitleId === existing.id);
      if (hasIt) {
        alreadyOk.add(`${data.userId}:${nameLower}`);
      } else {
        if (!toAssign.has(nameLower)) toAssign.set(nameLower, { name: existing.name, users: new Set() });
        toAssign.get(nameLower).users.add(data.userId);
      }
    } else {
      if (!toCreate.has(nameLower)) toCreate.set(nameLower, { name: raw, users: new Set() });
      toCreate.get(nameLower).users.add(data.userId);
    }
  }

  // ── Reporte ────────────────────────────────────────────────────────────────
  console.log(`Membresías con customTitle: ${membSnap.size - skippedEmpty} (de ${membSnap.size} totales)`);
  console.log(`Ya sincronizados de antes:  ${alreadyOk.size}`);
  if (skippedNoUser) console.log(`⚠️  Membresías con userId huérfano (sin usuario): ${skippedNoUser}`);
  console.log('');

  if (toCreate.size) {
    console.log(`── Cargos NUEVOS a crear en el catálogo (${toCreate.size}) ──`);
    for (const [, { name, users }] of [...toCreate.entries()].sort()) {
      console.log(`  + "${name}"  →  ${users.size} persona(s): ${[...users].map((id) => userById.get(id)?.name ?? id).join(', ')}`);
    }
    console.log('');
  }

  if (toAssign.size) {
    console.log(`── Cargos EXISTENTES a asignar a más personas (${toAssign.size}) ──`);
    for (const [, { name, users }] of [...toAssign.entries()].sort()) {
      console.log(`  = "${name}"  →  ${users.size} persona(s): ${[...users].map((id) => userById.get(id)?.name ?? id).join(', ')}`);
    }
    console.log('');
  }

  if (!toCreate.size && !toAssign.size) {
    console.log('✅ Todo ya está sincronizado, nada que hacer.');
    return;
  }

  if (!APPLY) {
    console.log('👉 Revisa la lista de arriba. Si hay nombres que en realidad son el mismo cargo escrito distinto');
    console.log('   (ej. "Encargado Worship" y "Encargado de Worship"), corrígelo en el organigrama antes de aplicar,');
    console.log('   para que ambos caigan en el mismo cargo del catálogo.');
    console.log('\nCuando esté ok, corre: node scripts/sync-orgchart-cargos.js --apply');
    return;
  }

  // ── Aplicar ────────────────────────────────────────────────────────────────
  console.log('Aplicando cambios…\n');

  // 1. Crear los cargos nuevos
  const createdIds = new Map(); // nameLower -> { id, name }
  for (const [nameLower, { name }] of toCreate.entries()) {
    const id = await nextId(JOB_TITLES_COL);
    await db.collection(JOB_TITLES_COL).doc(String(id)).set({
      id, name, nameLower,
      sortOrder: 0, isActive: true,
      createdAt: now(), updatedAt: now(),
    });
    createdIds.set(nameLower, { id, name });
    console.log(`  ✓ Cargo creado: "${name}" (id ${id})`);
  }

  // 2. Asignar a cada usuario afectado (nuevos + existentes)
  const allAssignments = new Map(); // userId -> [{jobTitleId, name}]
  const addAssignment = (userId, jobTitleId, name) => {
    if (!allAssignments.has(userId)) allAssignments.set(userId, []);
    allAssignments.get(userId).push({ jobTitleId, name });
  };
  for (const [nameLower, { users }] of toCreate.entries()) {
    const jt = createdIds.get(nameLower);
    users.forEach((userId) => addAssignment(userId, jt.id, jt.name));
  }
  for (const [nameLower, { users }] of toAssign.entries()) {
    const jt = jobTitleByNameLower.get(nameLower);
    users.forEach((userId) => addAssignment(userId, jt.id, jt.name));
  }

  let updatedUsers = 0;
  for (const [userId, newTitles] of allAssignments.entries()) {
    const user = userById.get(userId);
    const current = user.jobTitles;
    const merged = [...current];
    for (const nt of newTitles) {
      if (!merged.some((jt) => jt.jobTitleId === nt.jobTitleId)) {
        merged.push({ jobTitleId: nt.jobTitleId, name: nt.name, sortOrder: merged.length });
      }
    }
    await user.ref.update({ jobTitles: merged, updatedAt: now() });
    updatedUsers++;
    console.log(`  ✓ ${user.name}: +${newTitles.map((t) => t.name).join(', ')}`);
  }

  console.log(`\n✅ Listo. Cargos creados: ${createdIds.size}. Personas actualizadas: ${updatedUsers}.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
