/**
 * Import masivo desde Google Sheets (exportado como .xlsx)
 *
 * Uso:
 *   cd backend
 *   node scripts/import-from-sheets.js ./data/carga_inicial_intranet.xlsx
 *
 * Procesa en orden: roles → cargos → campus → usuarios → areas → equipos → membresias
 * Todos los pasos son upsert: se puede re-ejecutar sin duplicar datos.
 */

require('dotenv').config({ path: '.env' });
const admin = require('firebase-admin');
const XLSX  = require('xlsx');
const path  = require('path');
const bcrypt = require('bcrypt');

// ── Firebase init ────────────────────────────────────────────────────────────
const keyFile = path.resolve(process.env.FIREBASE_KEY_FILE || './service-account.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential:  admin.credential.cert(keyFile),
    projectId:   process.env.FIREBASE_PROJECT_ID,
  });
}
const db = admin.firestore();

// ── Helpers ──────────────────────────────────────────────────────────────────
function now() { return admin.firestore.FieldValue.serverTimestamp(); }

async function nextId(collection) {
  const ref = db.collection('_counters').doc(collection);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const next = snap.exists ? snap.data().next : 1;
    tx.set(ref, { next: next + 1 });
    return next;
  });
}

/** Lee una hoja del xlsx y devuelve array de objetos (primera fila = headers) */
function readSheet(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.warn(`⚠️  Hoja "${sheetName}" no encontrada, se omite.`);
    return [];
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return rows.filter(row => Object.values(row).some(v => String(v).trim() !== ''));
}

function normalize(str) { return String(str || '').trim().toLowerCase(); }

// ── PASO 1: Roles ─────────────────────────────────────────────────────────────
async function importRoles(workbook) {
  const rows = readSheet(workbook, 'roles');
  if (!rows.length) { console.log('  Sin filas en "roles", omitiendo.'); return {}; }

  const roleMap = {}; // nombre → id
  let created = 0, updated = 0;

  // Cargar roles existentes al mapa
  const existing = await db.collection('roles').get();
  existing.docs.forEach(d => {
    roleMap[normalize(d.data().name)] = d.data().id;
  });

  for (const row of rows) {
    const name = String(row['nombre'] || '').trim();
    if (!name) continue;

    const snap = await db.collection('roles')
      .where('nameLower', '==', normalize(name)).limit(1).get();

    if (snap.empty) {
      const id = await nextId('roles');
      await db.collection('roles').doc(String(id)).set({
        id,
        name,
        nameLower:   normalize(name),
        description: String(row['descripcion'] || '').trim() || null,
        isSystem:    false,
        isActive:    true,
        permissions: [],
        createdAt:   now(),
        updatedAt:   now(),
      });
      roleMap[normalize(name)] = id;
      created++;
    } else {
      const doc = snap.docs[0];
      roleMap[normalize(name)] = doc.data().id;
      if (row['descripcion']) {
        await doc.ref.update({ description: String(row['descripcion']).trim(), updatedAt: now() });
        updated++;
      }
    }
  }

  console.log(`  ✓ Roles: ${created} creados, ${updated} actualizados`);
  return roleMap;
}

// ── PASO 2: Cargos (Job Titles) ───────────────────────────────────────────────
async function importCargos(workbook) {
  const rows = readSheet(workbook, 'cargos');
  if (!rows.length) { console.log('  Sin filas en "cargos", omitiendo.'); return {}; }

  const cargoMap = {}; // nombre → id
  let created = 0, updated = 0;

  const existing = await db.collection('job_titles').get();
  existing.docs.forEach(d => {
    cargoMap[normalize(d.data().name)] = d.data().id;
  });

  for (const row of rows) {
    const name = String(row['nombre'] || '').trim();
    if (!name) continue;

    const sortOrder = parseInt(row['orden']) || 0;
    const snap = await db.collection('job_titles')
      .where('nameLower', '==', normalize(name)).limit(1).get();

    if (snap.empty) {
      const id = await nextId('job_titles');
      await db.collection('job_titles').doc(String(id)).set({
        id, name, nameLower: normalize(name),
        sortOrder, isActive: true,
        createdAt: now(), updatedAt: now(),
      });
      cargoMap[normalize(name)] = id;
      created++;
    } else {
      const doc = snap.docs[0];
      cargoMap[normalize(name)] = doc.data().id;
      await doc.ref.update({ sortOrder, updatedAt: now() });
      updated++;
    }
  }

  console.log(`  ✓ Cargos: ${created} creados, ${updated} actualizados`);
  return cargoMap;
}

// ── PASO 3: Campus ────────────────────────────────────────────────────────────
async function importCampus(workbook) {
  const rows = readSheet(workbook, 'campus');
  if (!rows.length) { console.log('  Sin filas en "campus", omitiendo.'); return {}; }

  const campusMap = {}; // nombre → { id, name, address }
  let created = 0, updated = 0;

  const existing = await db.collection('campuses').get();
  existing.docs.forEach(d => {
    const data = d.data();
    campusMap[normalize(data.name)] = { id: data.id, name: data.name, address: data.address };
  });

  for (const row of rows) {
    const name = String(row['nombre'] || '').trim();
    if (!name) continue;

    const snap = await db.collection('campuses')
      .where('nameLower', '==', normalize(name)).limit(1).get();

    const payload = {
      name,
      nameLower: normalize(name),
      siglas:    String(row['siglas']    || '').trim() || null,
      city:      String(row['ciudad']    || '').trim() || null,
      country:   String(row['pais']      || '').trim() || null,
      address:   String(row['direccion'] || '').trim() || null,
      phone:     String(row['telefono']  || '').trim() || null,
      email:     String(row['email']     || '').trim() || null,
      website:   String(row['sitio_web'] || '').trim() || null,
      isActive:  true,
    };

    if (snap.empty) {
      const id = await nextId('campuses');
      await db.collection('campuses').doc(String(id)).set({
        ...payload, id,
        pastorIds: [], adminIds: [], schedules: [],
        createdAt: now(), updatedAt: now(),
      });
      campusMap[normalize(name)] = { id, name, address: payload.address };
      created++;
    } else {
      const doc = snap.docs[0];
      const id = doc.data().id;
      await doc.ref.update({ ...payload, updatedAt: now() });
      campusMap[normalize(name)] = { id, name, address: payload.address };
      updated++;
    }
  }

  console.log(`  ✓ Campus: ${created} creados, ${updated} actualizados`);
  return campusMap;
}

// ── PASO 4: Usuarios ─────────────────────────────────────────────────────────
async function importUsuarios(workbook, roleMap, cargoMap, campusMap) {
  const rows = readSheet(workbook, 'usuarios');
  if (!rows.length) { console.log('  Sin filas en "usuarios", omitiendo.'); return {}; }

  // Roles del sistema que ya existen
  const sysRoles = await db.collection('roles').get();
  sysRoles.docs.forEach(d => {
    roleMap[normalize(d.data().name)] = d.data().id;
  });

  const userMap = {}; // email → id
  let created = 0, updated = 0, errors = 0;

  for (const row of rows) {
    const email = normalize(row['email']);
    if (!email || !email.includes('@')) {
      console.warn(`  ⚠️  Fila sin email válido, se omite.`);
      errors++;
      continue;
    }

    const firstName = String(row['nombre']   || '').trim();
    const lastName  = String(row['apellido'] || '').trim();
    const roleName  = normalize(row['rol'] || 'user');
    const campusName = normalize(row['campus'] || '');
    const cargoName  = normalize(row['cargo']  || '');
    const status    = normalize(row['estado'] || 'active');
    const phone     = String(row['telefono'] || '').trim() || null;
    const country   = String(row['pais']     || '').trim() || null;
    const password  = String(row['password'] || '').trim() || null;

    if (!firstName || !lastName) {
      console.warn(`  ⚠️  Usuario ${email} sin nombre/apellido, se omite.`);
      errors++;
      continue;
    }

    // Resolver roleId
    const roleId = roleMap[roleName] || roleMap['user'] || 2;

    // Resolver campus
    const campusObj = campusName ? campusMap[campusName] : null;
    const campusId  = campusObj?.id || null;

    // Resolver cargo
    const cargoId  = cargoName ? cargoMap[cargoName] : null;
    const jobTitles = cargoId
      ? [{ jobTitleId: cargoId, name: row['cargo'], sortOrder: 0 }]
      : [];

    // Snapshot de role
    const roleDoc = await db.collection('roles').doc(String(roleId)).get();
    const roleSnap = roleDoc.exists ? { id: roleId, name: roleDoc.data().name } : { id: roleId, name: roleName };

    const snap = await db.collection('users')
      .where('email', '==', email).limit(1).get();

    if (snap.empty) {
      const id = await nextId('users');
      const passwordHash = password ? await bcrypt.hash(password, 10) : null;
      await db.collection('users').doc(String(id)).set({
        id, email,
        firstName, lastName,
        nameLower: `${normalize(firstName)} ${normalize(lastName)}`,
        roleId, role: roleSnap,
        campusId, campus: campusObj ? { id: campusObj.id, name: campusObj.name, address: campusObj.address } : null,
        jobTitles,
        phone, country,
        bio: null, birthDate: null, gender: null, avatarUrl: null,
        status: status === 'inactive' ? 'inactive' : 'active',
        passwordHash,
        lastLoginAt: null,
        createdAt: now(), updatedAt: now(),
      });
      userMap[email] = id;
      created++;
    } else {
      const doc  = snap.docs[0];
      const data = doc.data();
      userMap[email] = data.id;

      const updates = {
        firstName, lastName,
        nameLower: `${normalize(firstName)} ${normalize(lastName)}`,
        roleId, role: roleSnap,
        campusId, campus: campusObj ? { id: campusObj.id, name: campusObj.name, address: campusObj.address } : data.campus,
        status: status === 'inactive' ? 'inactive' : 'active',
        updatedAt: now(),
      };
      if (phone)     updates.phone = phone;
      if (country)   updates.country = country;
      if (cargoId)   updates.jobTitles = jobTitles;
      if (password)  updates.passwordHash = await bcrypt.hash(password, 10);

      await doc.ref.update(updates);
      updated++;
    }
  }

  console.log(`  ✓ Usuarios: ${created} creados, ${updated} actualizados, ${errors} errores`);
  return userMap;
}

// ── PASO 5: Áreas Org ─────────────────────────────────────────────────────────
async function importAreas(workbook) {
  const rows = readSheet(workbook, 'areas_org');
  if (!rows.length) { console.log('  Sin filas en "areas_org", omitiendo.'); return {}; }

  const areaMap = {}; // nombre → id
  let created = 0, updated = 0;

  const existing = await db.collection('org_areas').get();
  existing.docs.forEach(d => {
    areaMap[normalize(d.data().name)] = d.data().id;
  });

  for (const row of rows) {
    const name = String(row['nombre'] || '').trim();
    if (!name) continue;

    const slug      = String(row['slug']  || '').trim().toLowerCase().replace(/\s+/g, '-');
    const color     = String(row['color'] || '#7F77DD').trim();
    const icon      = String(row['icono'] || '⭐').trim();
    const sortOrder = parseInt(row['orden']) || 0;

    const snap = await db.collection('org_areas')
      .where('name', '==', name).limit(1).get();

    if (snap.empty) {
      const id = await nextId('org_areas');
      await db.collection('org_areas').doc(String(id)).set({
        id, name, slug, color, icon, sortOrder,
        desc: null, iconUrl: null, isActive: true,
        createdAt: now(), updatedAt: now(),
      });
      areaMap[normalize(name)] = id;
      created++;
    } else {
      const doc = snap.docs[0];
      areaMap[normalize(name)] = doc.data().id;
      await doc.ref.update({ slug, color, icon, sortOrder, updatedAt: now() });
      updated++;
    }
  }

  console.log(`  ✓ Áreas: ${created} creadas, ${updated} actualizadas`);
  return areaMap;
}

// ── PASO 6: Equipos Org ───────────────────────────────────────────────────────
async function importEquipos(workbook, areaMap) {
  const rows = readSheet(workbook, 'equipos_org');
  if (!rows.length) { console.log('  Sin filas en "equipos_org", omitiendo.'); return {}; }

  const teamMap = {}; // nombre → id
  let created = 0, updated = 0, errors = 0;

  const existing = await db.collection('org_teams').get();
  existing.docs.forEach(d => {
    teamMap[normalize(d.data().name)] = d.data().id;
  });

  for (const row of rows) {
    const name     = String(row['nombre'] || '').trim();
    const areaName = normalize(row['area'] || '');
    if (!name || !areaName) continue;

    const areaId = areaMap[areaName];
    if (!areaId) {
      console.warn(`  ⚠️  Área "${row['area']}" no encontrada para equipo "${name}"`);
      errors++;
      continue;
    }

    const sortOrder = parseInt(row['orden']) || 0;
    const snap = await db.collection('org_teams')
      .where('name', '==', name).where('areaId', '==', areaId).limit(1).get();

    if (snap.empty) {
      const id = await nextId('org_teams');
      await db.collection('org_teams').doc(String(id)).set({
        id, name, areaId, sortOrder,
        icon: null, iconUrl: null, desc: null, colPosition: null,
        isActive: true,
        createdAt: now(), updatedAt: now(),
      });
      teamMap[normalize(name)] = id;
      created++;
    } else {
      const doc = snap.docs[0];
      teamMap[normalize(name)] = doc.data().id;
      await doc.ref.update({ sortOrder, updatedAt: now() });
      updated++;
    }
  }

  console.log(`  ✓ Equipos: ${created} creados, ${updated} actualizados, ${errors} errores`);
  return teamMap;
}

// ── PASO 7: Membresías ────────────────────────────────────────────────────────
async function importMembresias(workbook, userMap, areaMap, teamMap) {
  const rows = readSheet(workbook, 'membresias');
  if (!rows.length) { console.log('  Sin filas en "membresias", omitiendo.'); return; }

  let created = 0, updated = 0, errors = 0;

  for (const row of rows) {
    const email       = normalize(row['email_usuario'] || '');
    const targetName  = normalize(row['area_o_equipo'] || '');
    const tipo        = normalize(row['tipo'] || 'member');
    const customTitle = String(row['titulo_personalizado'] || '').trim() || null;

    const userId = userMap[email];
    if (!userId) {
      console.warn(`  ⚠️  Usuario "${email}" no encontrado, membresía omitida`);
      errors++;
      continue;
    }

    const areaId = areaMap[targetName];
    const teamId = teamMap[targetName];

    if (!areaId && !teamId) {
      console.warn(`  ⚠️  Área/equipo "${row['area_o_equipo']}" no encontrado, membresía omitida`);
      errors++;
      continue;
    }

    // Validar role según si es área o equipo
    let role = tipo;
    if (areaId && role !== 'area_leader') role = 'area_leader';
    if (teamId && !['team_leader', 'member'].includes(role)) role = 'member';

    // Buscar membresía existente
    let query = db.collection('org_memberships').where('userId', '==', userId);
    if (areaId) query = query.where('areaId', '==', areaId);
    else        query = query.where('teamId', '==', teamId);
    const snap = await query.limit(1).get();

    if (snap.empty) {
      const id = await nextId('org_memberships');
      await db.collection('org_memberships').doc(String(id)).set({
        id, userId,
        areaId: areaId || null,
        teamId: teamId || null,
        role, customTitle, sortOrder: 0,
        createdAt: now(), updatedAt: now(),
      });
      created++;
    } else {
      await snap.docs[0].ref.update({ role, customTitle, updatedAt: now() });
      updated++;
    }
  }

  console.log(`  ✓ Membresías: ${created} creadas, ${updated} actualizadas, ${errors} errores`);
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('❌  Uso: node scripts/import-from-sheets.js <archivo.xlsx>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  console.log(`\n📂  Leyendo: ${resolvedPath}`);

  let workbook;
  try {
    workbook = XLSX.readFile(resolvedPath);
  } catch (e) {
    console.error(`❌  No se pudo leer el archivo: ${e.message}`);
    process.exit(1);
  }

  console.log(`📋  Hojas encontradas: ${workbook.SheetNames.join(', ')}\n`);

  try {
    console.log('1️⃣   Importando roles...');
    const roleMap = await importRoles(workbook);

    console.log('2️⃣   Importando cargos...');
    const cargoMap = await importCargos(workbook);

    console.log('3️⃣   Importando campus...');
    const campusMap = await importCampus(workbook);

    console.log('4️⃣   Importando usuarios...');
    const userMap = await importUsuarios(workbook, roleMap, cargoMap, campusMap);

    console.log('5️⃣   Importando áreas org...');
    const areaMap = await importAreas(workbook);

    console.log('6️⃣   Importando equipos org...');
    const teamMap = await importEquipos(workbook, areaMap);

    console.log('7️⃣   Importando membresías...');
    await importMembresias(workbook, userMap, areaMap, teamMap);

    console.log('\n✅  Importación completada exitosamente.\n');
  } catch (e) {
    console.error('\n❌  Error durante la importación:', e.message);
    console.error(e.stack);
    process.exit(1);
  }

  process.exit(0);
}

main();
