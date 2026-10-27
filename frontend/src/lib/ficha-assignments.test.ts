import { describe, expect, it } from 'vitest';
import { editAssignmentCell } from './ficha-assignments';
import type { Row, RowAssignment } from '@/types/ficha';
const old: RowAssignment = { mode: 'people', people: [{ userId: 1, name: 'Ana' }], note: '' };
const next: RowAssignment = { mode: 'people', people: [{ userId: 2, name: 'Juan' }, { userId: 3, name: 'María' }], note: 'Apoyo' };
const row: Row = { id: 'r', label: 'Sonido', type: 'person', order: 0, required: true, shared: true, values: { shared: 'Ana' }, assignments: { shared: old } };
const encounters = ['09:00', '11:00', '17:00'].map((time, i) => ({ id: `e${i}`, time, label: time, color: '#111', isLive: false }));
describe('alcance de las asignaciones', () => {
  it('crea excepción de un encuentro sin modificar el resto', () => {
    const r = editAssignmentCell(row, 'produccion', 'shared', 'Juan / María · Apoyo', encounters, { assignment: next, scope: 'current', encounterId: 'e1' });
    expect(r.shared).toBe(false);
    expect(r.values).toEqual({ e0: 'Ana', e1: 'Juan / María · Apoyo', e2: 'Ana' });
    expect(r.assignments?.e0).toEqual(old); expect(r.assignments?.e1).toEqual(next);
    expect(row.values).toEqual({ shared: 'Ana' });
  });
  it('aplica a AM preservando PM', () => {
    const r = editAssignmentCell(row, 'produccion', 'shared', 'Juan', encounters, { assignment: next, scope: 'block', encounterId: 'e1' });
    expect(r.assignments).toEqual({ e0: next, e1: next, e2: old });
  });
  it('aplica responsables a todas las canciones sin copiar título ni tonalidad', () => {
    const song: Row = { ...row, type: 'song', shared: false, assignments: {}, values: { e0: '{"titulo":"Gracia","tonalidad":"D"}', e1: '{"titulo":"Vida","tonalidad":"C"}' } };
    const r = editAssignmentCell(song, 'setList', 'e0', song.values.e0, encounters, { assignment: next, scope: 'all', encounterId: 'e0' });
    expect(JSON.parse(r.values.e0)).toMatchObject({ titulo: 'Gracia', tonalidad: 'D', cantante: 'Juan / María · Apoyo' });
    expect(JSON.parse(r.values.e1)).toMatchObject({ titulo: 'Vida', tonalidad: 'C', cantante: 'Juan / María · Apoyo' });
  });
  it('editar otro dato del timing conserva el vínculo; cambiar responsable lo elimina', () => {
    const timing: Row = { ...row, type: 'text', values: { shared: '{"inicio":"11:00","responsable":"Ana"}' } };
    expect(editAssignmentCell(timing, 'horarios', 'shared', '{"inicio":"12:00","responsable":"Ana"}', encounters).assignments?.shared).toEqual(old);
    expect(editAssignmentCell(timing, 'horarios', 'shared', '{"inicio":"12:00","responsable":"Otro"}', encounters).assignments).toEqual({});
  });
});
