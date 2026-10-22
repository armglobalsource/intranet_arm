/**
 * Migración de datos: PostgreSQL (Supabase) → Firestore
 *
 * Uso:
 *   node scripts/migrate-to-firestore.js
 *
 * Variables de entorno requeridas (en .env):
 *   FIREBASE_PROJECT_ID, FIREBASE_KEY_FILE
 *   PG_URL  → URL de PostgreSQL origen (Supabase dev o prod)
 */

require('dotenv').config();
const { Client }   = require('pg');
const admin        = require('firebase-admin');
const path         = require('path');

// ── Config ─────────────────────────────────────────────────────────────────

const FIREBASE_KEY_FILE  = process.env.FIREBASE_KEY_FILE  || './service-account.json';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'intranet-arm';
const PG_URL = process.env.PG_URL;
if (!PG_URL) throw new Error('PG_URL es obligatorio; configura la conexión mediante una variable de entorno');

// ── Init ───────────────────────────────────────────────────────────────────

admin.initializeApp({
  credential:  admin.credential.cert(path.resolve(FIREBASE_KEY_FILE)),
  projectId:   FIREBASE_PROJECT_ID,
});
const db = admin.firestore();
const pg = new Client({ connectionString: PG_URL });

// ── Helpers ────────────────────────────────────────────────────────────────

async function batchWrite(collection, docs) {
  const chunks = [];
  for (let i = 0; i < docs.length; i += 500) chunks.push(docs.slice(i, i + 500));
  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach(({ id, data }) => {
      batch.set(db.collection(collection).doc(String(id)), data);
    });
    await batch.commit();
  }
  console.log(`  ✓ ${docs.length} docs → ${collection}`);
}

function ts(date) {
  return date ? admin.firestore.Timestamp.fromDate(new Date(date)) : null;
}

// ── Migración ──────────────────────────────────────────────────────────────

async function migrate() {
  await pg.connect();
  console.log('PostgreSQL conectado\n');

  // 1. Roles
  const roles = await pg.query('SELECT id, name, description FROM roles ORDER BY id');
  await batchWrite('roles', roles.rows.map(r => ({
    id: r.id,
    data: { id: r.id, name: r.name, description: r.description ?? null },
  })));

  // 2. Campuses
  const campuses = await pg.query('SELECT id, name, address, is_active, created_at FROM campuses ORDER BY id');
  await batchWrite('campuses', campuses.rows.map(r => ({
    id: r.id,
    data: {
      id: r.id, name: r.name, nameLower: r.name.toLowerCase(),
      address: r.address ?? null, isActive: r.is_active,
      createdAt: ts(r.created_at), updatedAt: null,
    },
  })));

  // 3. Job Titles
  const jts = await pg.query('SELECT id, name, sort_order, is_active, created_at FROM job_titles ORDER BY id');
  await batchWrite('job_titles', jts.rows.map(r => ({
    id: r.id,
    data: {
      id: r.id, name: r.name, nameLower: r.name.toLowerCase(),
      sortOrder: r.sort_order, isActive: r.is_active,
      createdAt: ts(r.created_at), updatedAt: null,
    },
  })));

  // Mapa nombre de job_title por id (para denormalizar en usuarios)
  const jtMap = {};
  jts.rows.forEach(r => { jtMap[r.id] = r.name; });

  // 4. Org Areas
  const areas = await pg.query('SELECT id, slug, name, color, icon, icon_url, "desc", sort_order, is_active, created_at, updated_at FROM org_areas ORDER BY id');
  await batchWrite('org_areas', areas.rows.map(r => ({
    id: r.id,
    data: {
      id: r.id, slug: r.slug, name: r.name, color: r.color, icon: r.icon,
      iconUrl: r.icon_url ?? null, desc: r.desc ?? null,
      sortOrder: r.sort_order, isActive: r.is_active,
      createdAt: ts(r.created_at), updatedAt: ts(r.updated_at),
    },
  })));

  // 5. Org Teams
  const teams = await pg.query('SELECT id, area_id, name, icon, icon_url, "desc", col_position, sort_order, is_active, created_at, updated_at FROM org_teams ORDER BY id');
  await batchWrite('org_teams', teams.rows.map(r => ({
    id: r.id,
    data: {
      id: r.id, areaId: r.area_id, name: r.name, icon: r.icon ?? null,
      iconUrl: r.icon_url ?? null, desc: r.desc ?? null,
      colPosition: r.col_position, sortOrder: r.sort_order, isActive: r.is_active,
      createdAt: ts(r.created_at), updatedAt: ts(r.updated_at),
    },
  })));

  // 6. Org Memberships
  const memberships = await pg.query('SELECT id, user_id, area_id, team_id, role, custom_title, sort_order, created_at FROM org_memberships ORDER BY id');
  await batchWrite('org_memberships', memberships.rows.map(r => ({
    id: r.id,
    data: {
      id: r.id, userId: r.user_id, areaId: r.area_id ?? null,
      teamId: r.team_id ?? null, role: r.role,
      customTitle: r.custom_title ?? null, sortOrder: r.sort_order,
      createdAt: ts(r.created_at), updatedAt: null,
    },
  })));

  // 7. Usuarios (con jobTitles denormalizados)
  const users = await pg.query(`
    SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name,
           u.phone, u.country, u.bio, u.avatar_url, u.status,
           u.role_id, u.campus_id, u.department_id, u.last_login_at,
           u.created_at, u.updated_at,
           r.name AS role_name,
           c.name AS campus_name, c.address AS campus_address
    FROM users u
    LEFT JOIN roles    r ON r.id = u.role_id
    LEFT JOIN campuses c ON c.id = u.campus_id
    ORDER BY u.id
  `);

  // Job titles por usuario
  const userJTs = await pg.query(`
    SELECT ujt.user_id, ujt.job_title_id, ujt.sort_order, jt.name
    FROM user_job_titles ujt
    JOIN job_titles jt ON jt.id = ujt.job_title_id
    ORDER BY ujt.user_id, ujt.sort_order
  `);
  const userJTMap = {};
  userJTs.rows.forEach(r => {
    if (!userJTMap[r.user_id]) userJTMap[r.user_id] = [];
    userJTMap[r.user_id].push({ jobTitleId: r.job_title_id, name: r.name, sortOrder: r.sort_order });
  });

  await batchWrite('users', users.rows.map(r => ({
    id: r.id,
    data: {
      id: r.id,
      email: r.email,
      passwordHash: r.password_hash,
      firstName: r.first_name,
      lastName: r.last_name,
      nameLower: `${r.first_name} ${r.last_name}`.toLowerCase(),
      phone: r.phone ?? null,
      country: r.country ?? null,
      bio: r.bio ?? null,
      avatarUrl: r.avatar_url ?? null,
      status: r.status,
      roleId: r.role_id,
      role: r.role_name ? { id: r.role_id, name: r.role_name } : null,
      campusId: r.campus_id ?? null,
      campus: r.campus_id ? { id: r.campus_id, name: r.campus_name, address: r.campus_address ?? null } : null,
      departmentId: r.department_id ?? null,
      jobTitles: userJTMap[r.id] ?? [],
      lastLoginAt: ts(r.last_login_at),
      createdAt: ts(r.created_at),
      updatedAt: ts(r.updated_at),
    },
  })));

  // 8. Content
  const contents = await pg.query(`
    SELECT id, title, slug, body, excerpt, type, status, author_id, thumbnail, pinned, published_at, created_at, updated_at
    FROM content ORDER BY id
  `);
  await batchWrite('content', contents.rows.map(r => ({
    id: r.id,
    data: {
      id: r.id, title: r.title, slug: r.slug, body: r.body ?? '',
      excerpt: r.excerpt ?? null, type: r.type, status: r.status,
      authorId: r.author_id, thumbnail: r.thumbnail ?? null,
      pinned: r.pinned, publishedAt: ts(r.published_at),
      createdAt: ts(r.created_at), updatedAt: ts(r.updated_at),
    },
  })));

  // 9. Documents
  const documents = await pg.query(`
    SELECT id, name, description, minio_key, mime_type, size_bytes, uploader_id, department_id, min_role_id, status, downloaded_count, created_at, updated_at
    FROM documents ORDER BY id
  `);
  await batchWrite('documents', documents.rows.map(r => ({
    id: r.id,
    data: {
      id: r.id, name: r.name, description: r.description ?? null,
      minioKey: r.minio_key, mimeType: r.mime_type ?? null,
      sizeBytes: r.size_bytes ? Number(r.size_bytes) : null,
      uploaderId: r.uploader_id, departmentId: r.department_id ?? null,
      minRoleId: r.min_role_id ?? null, status: r.status,
      downloadedCount: r.downloaded_count ?? 0,
      createdAt: ts(r.created_at), updatedAt: ts(r.updated_at),
    },
  })));

  // 10. Notifications
  const notifications = await pg.query(`
    SELECT id, user_id, title, body, link, channel, read_at, sent_at, created_at
    FROM notifications ORDER BY id
  `);
  await batchWrite('notifications', notifications.rows.map(r => ({
    id: r.id,
    data: {
      id: r.id, userId: r.user_id, title: r.title,
      body: r.body ?? null, link: r.link ?? null, channel: r.channel,
      read: r.read_at !== null, readAt: ts(r.read_at), sentAt: ts(r.sent_at),
      createdAt: ts(r.created_at),
    },
  })));

  // 11. Counters (next ID para cada colección)
  const counterCols = [
    'roles', 'campuses', 'job_titles', 'org_areas', 'org_teams',
    'org_memberships', 'users', 'content', 'documents', 'notifications',
  ];
  const tableMap = {
    roles: 'roles', campuses: 'campuses', job_titles: 'job_titles',
    org_areas: 'org_areas', org_teams: 'org_teams', org_memberships: 'org_memberships',
    users: 'users', content: 'content', documents: 'documents', notifications: 'notifications',
  };
  const maxIds = await Promise.all(counterCols.map(async col => {
    const r = await pg.query(`SELECT COALESCE(MAX(id), 0) as max FROM ${tableMap[col]}`);
    return { col, next: parseInt(r.rows[0].max) + 1 };
  }));

  const ctrBatch = db.batch();
  maxIds.forEach(({ col, next }) => {
    ctrBatch.set(db.collection('_counters').doc(col), { next });
  });
  await ctrBatch.commit();
  console.log('  ✓ Contadores inicializados');

  await pg.end();
  console.log('\n✅ Migración completada');
}

migrate().catch(e => {
  console.error('\n❌ Error en migración:', e.message);
  process.exit(1);
});
