const test = require('node:test');
const assert = require('node:assert/strict');
const { encode } = require('./export-lib.cjs');
const { validate, sourceName, importSQL } = require('./prepare-operational.cjs');
const record = (path, data) => ({ path, exists: true, fields: encode(data) });

test('retains nullable email and refuses unmodelled fields instead of silently dropping them', () => {
  assert.deepEqual(validate([record('users/1', { id: 1, email: null })]), { users: 1 });
  assert.throws(() => validate([record('users/1', { id: 1, unknownNewField: true })]), /Unmodelled field/);
});
test('requires integral foreign keys and rejects incompatible field types', () => {
  assert.throws(() => validate([record('users/1', { campusId: 1.2 })]), /Noninteger/);
  assert.throws(() => validate([record('users/1', { campusId: '' })]), /Noninteger/);
  assert.throws(() => validate([record('users/1', { email: false })]), /Wrong type/);
});
test('routes nested history and exchange metadata explicitly, rejects unknown subcollections', () => {
  assert.equal(sourceName(record('fichas/a/changelog/b', {})), 'ficha_changelog');
  assert.equal(sourceName(record('tipo_cambio/_meta', {})), 'tipo_cambio_meta');
  assert.throws(() => sourceName(record('users/a/private/b', {})), /Unexpected/);
});
test('rejects untrusted run identifiers before constructing SQL', () => {
  assert.throws(() => importSQL("'; delete from users; --"), /Invalid run/);
});
