/**
 * Migra org_memberships del modelo antiguo (customTitle: texto libre) al nuevo
 * modelo con integridad referencial real (jobTitleId: FK a job_titles).
 *
 * Por cada membresía con customTitle y sin jobTitleId:
 *   1. Busca un cargo existente en job_titles con ese nombre (o lo crea).
 *   2. Escribe jobTitleId en la membresía.
 *   3. Borra el campo customTitle (ya no se usa).
 *
 * IMPORTANTE: este script reemplaza a sync-orgchart-cargos.js, que quedó obsoleto
 * — ese script copiaba el cargo dentro de users.jobTitles[], lo cual ya no se hace
 * (los cargos de organigrama ahora se calculan en vivo, nunca se guardan aparte).
 * No lo vuelvas a correr.
 *
 * Uso:
 *   node scripts/migrate-membership-jobtitleid.js              (dry-run, solo reporta)
 *   node scripts/migrate-membership-jobtitleid.js --apply      (aplica los cambios)
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

  const [membSnap, jobTitlesSnap] = await Promise.all([
    db.collection(MEMBERSHIPS_COL).get(),
    db.collection(JOB_TITLES_COL).get(),
  ]);

  const jobTitleByNameLower = new Map(); // nameLower -> { id, name }
  jobTitlesSnap.docs.forEach((d) => {
    const data = d.data();
    jobTitleByNameLower.set(data.nameLower, { id: data.id, name: data.name });
  });

  const memberships = membSnap.docs.map((d) => ({ ref: d.ref, data: d.data() }));

  const alreadyMigrated = memberships.filter((m) => m.data.jobTitleId != null);
  const noCustomTitle   = memberships.filter((m) => m.data.jobTitleId == null && !(m.data.customTitle ?? '').trim());
  const toMigrate        = memberships.filter((m) => m.data.jobTitleId == null && (m.data.customTitle ?? '').trim());

  const toCreate = new Map(); // nameLower -> { name, memberships: [{ref, data}] }
  const toAssign = new Map(); // nameLower -> { jobTitle, memberships: [{ref, data}] }

  toMigrate.forEach((m) => {
    const raw = m.data.customTitle.trim();
    const nameLower = raw.toLowerCase();
    const existing = jobTitleByNameLower.get(nameLower);
    if (existing) {
      if (!toAssign.has(nameLower)) toAssign.set(nameLower, { jobTitle: existing, memberships: [] });
      toAssign.get(nameLower).memberships.push(m);
    } else {
      if (!toCreate.has(nameLower)) toCreate.set(nameLower, { name: raw, memberships: [] });
      toCreate.get(nameLower).memberships.push(m);
    }
  });

  console.log(`Total membresías:                 ${memberships.length}`);
  console.log(`Ya migradas (con jobTitleId):      ${alreadyMigrated.length}`);
  console.log(`Sin cargo (no requieren cambio):   ${noCustomTitle.length}`);
  console.log(`A migrar (customTitle → jobTitleId): ${toMigrate.length}`);
  console.log('');

  if (toCreate.size) {
    console.log(`── Cargos NUEVOS a crear en el catálogo (${toCreate.size}) ──`);
    for (const [, { name, memberships }] of [...toCreate.entries()].sort()) {
      console.log(`  + "${name}"  →  ${memberships.length} membresía(s)`);
    }
    console.log('');
  }

  if (toAssign.size) {
    console.log(`── Cargos EXISTENTES a referenciar (${toAssign.size}) ──`);
    for (const [, { jobTitle, memberships }] of [...toAssign.entries()].sort()) {
      console.log(`  = "${jobTitle.name}" (id ${jobTitle.id})  →  ${memberships.length} membresía(s)`);
    }
    console.log('');
  }

  if (!toMigrate.length) {
    console.log('✅ Nada que migrar.');
    return;
  }

  if (!APPLY) {
    console.log('👉 Revisa la lista de arriba. Si hay nombres que en realidad son el mismo cargo escrito distinto');
    console.log('   (ej. "Encargado Worship" y "Encargado de Worship"), corrígelo en el organigrama antes de aplicar,');
    console.log('   para que ambos caigan en el mismo cargo del catálogo.');
    console.log('\nCuando esté ok, corre: node scripts/migrate-membership-jobtitleid.js --apply');
    return;
  }

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

  // 2. Escribir jobTitleId en cada membresía y borrar customTitle
  let updated = 0;
  const applyToGroup = async (nameLower, jobTitle, memberships) => {
    for (const m of memberships) {
      await m.ref.update({
        jobTitleId:  jobTitle.id,
        customTitle: admin.firestore.FieldValue.delete(),
        updatedAt:   now(),
      });
      updated++;
    }
    console.log(`  ✓ "${jobTitle.name}" (id ${jobTitle.id}) → ${memberships.length} membresía(s) actualizadas`);
  };

  for (const [nameLower, { memberships }] of toCreate.entries()) {
    await applyToGroup(nameLower, createdIds.get(nameLower), memberships);
  }
  for (const [nameLower, { jobTitle, memberships }] of toAssign.entries()) {
    await applyToGroup(nameLower, jobTitle, memberships);
  }

  console.log(`\n✅ Listo. Cargos creados: ${createdIds.size}. Membresías migradas: ${updated}.`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
