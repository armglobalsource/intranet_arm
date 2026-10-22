const { createHash } = require('node:crypto');

// Every value is tagged: user maps cannot collide with migration metadata.
function encode(value, types = {}) {
  if (value === null) return { type: 'null' };
  if (typeof value === 'string' || typeof value === 'boolean') {
    return { type: typeof value, value };
  }
  if (typeof value === 'number') {
    return { type: 'number', value: Number.isFinite(value) && !Object.is(value, -0)
      ? value : Object.is(value, -0) ? '-0' : String(value) };
  }
  if (types.Timestamp && value instanceof types.Timestamp) {
    return { type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (types.GeoPoint && value instanceof types.GeoPoint) {
    return { type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (types.DocumentReference && value instanceof types.DocumentReference) {
    return { type: 'reference', path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { type: 'bytes', base64: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return { type: 'array', value: value.map(item => encode(item, types)) };
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return { type: 'map', value: Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, encode(item, types)]),
    ) };
  }
  throw new Error('Unsupported Firestore value; export stopped to avoid data loss');
}

function plain(value) {
  if (value.type === 'map') return Object.fromEntries(
    Object.entries(value.value).map(([key, item]) => [key, plain(item)]),
  );
  if (value.type === 'array') return value.value.map(plain);
  if (value.type === 'null') return null;
  if (['string', 'boolean', 'number'].includes(value.type)) return value.value;
  // Preserve timestamp precision and other special values for the eventual importer.
  return value;
}

async function exportDatabase(db, write, types = {}) {
  const collections = Object.create(null);
  let documentCount = 0;
  let missingParentCount = 0;
  const digest = createHash('sha256');

  async function visit(collection) {
    const summary = { documents: 0, missingParents: 0 };
    collections[collection.path] = summary;
    // listDocuments includes missing parents with live subcollections. A normal
    // query would omit these and silently lose their descendants.
    const refs = await collection.listDocuments();
    for (let offset = 0; offset < refs.length; offset += 200) {
      const batch = refs.slice(offset, offset + 200);
      const snapshots = await db.getAll(...batch);
      for (const snap of snapshots) {
        const record = { path: snap.ref.path, exists: snap.exists };
        if (snap.exists) {
          record.fields = encode(snap.data(), types);
          summary.documents++;
          documentCount++;
        } else {
          summary.missingParents++;
          missingParentCount++;
        }
        const line = JSON.stringify(record) + '\n';
        digest.update(line);
        await write(line);
        for (const child of await snap.ref.listCollections()) await visit(child);
      }
    }
  }

  for (const collection of await db.listCollections()) await visit(collection);
  return { documentCount, missingParentCount, collections, sha256: digest.digest('hex') };
}

function diagnose(records) {
  const collections = Object.create(null);
  const issues = [];
  const unique = new Map();
  const byPath = new Map();
  for (const record of records) {
    if (byPath.has(record.path)) throw new Error(`Repeated export path: ${record.path}`);
    byPath.set(record.path, record);
  }
  const uniqueFields = {
    users: ['email'],
    arm_catalogos: ['tipo', 'keyLower'],
    disponibilidades: ['userId', 'campusId', 'weekLabel', 'scheduleKey'],
    'disponibilidades-tecnicos': ['userId', 'campusId', 'weekLabel', 'scheduleKey'],
    campus_turnos: ['campusId', 'tipo', 'modalidad', 'fecha'],
  };
  const references = { userId: 'users', roleId: 'roles', campusId: 'campuses',
    areaId: 'org_areas', teamId: 'org_teams', jobTitleId: 'job_titles', equipoId: 'campus_equipos' };
  for (const record of records) {
    const parts = record.path.split('/');
    const group = parts.map((part, index) => index % 2 ? '{id}' : part).slice(0, -1).join('/');
    const summary = collections[group] ??= { documents: 0, missingParents: 0, fields: Object.create(null) };
    if (!record.exists) {
      summary.missingParents++;
      issues.push({ kind: 'missing_parent', paths: [record.path] });
      continue;
    }
    summary.documents++;
    for (const [key, value] of Object.entries(record.fields.value)) {
      const counts = summary.fields[key] ??= {};
      counts[value.type] = (counts[value.type] ?? 0) + 1;
    }
    const data = plain(record.fields);
    if (parts.length !== 2) continue;
    const collection = parts[0];
    const fields = uniqueFields[collection];
    if (fields) {
      const values = fields.map(field => {
        const value = data[field];
        if (field === 'email') return typeof value === 'string' ? value.trim().toLowerCase() : value;
        if (field.endsWith('Id') && value != null) return String(value);
        return value ?? null;
      });
      // modalidad may legitimately be null; other absent business-key fields
      // need explicit resolution before defining SQL constraints.
      if (fields.some((field, index) => field !== 'modalidad' && values[index] == null)) {
        issues.push({ kind: 'incomplete_unique_key', paths: [record.path], fields });
      } else {
        const key = JSON.stringify([collection, ...values]);
        if (unique.has(key)) issues.push({ kind: 'duplicate_business_key', paths: [unique.get(key), record.path], fields });
        else unique.set(key, record.path);
      }
    }
    for (const [field, target] of Object.entries(references)) {
      if (data[field] == null) continue;
      const targetPath = `${target}/${data[field]}`;
      if (!byPath.get(targetPath)?.exists) {
        issues.push({ kind: 'unresolved_reference', paths: [record.path, targetPath], field });
      }
    }
  }
  return { collections, issues, issueCount: issues.length };
}

module.exports = { encode, plain, exportDatabase, diagnose };
