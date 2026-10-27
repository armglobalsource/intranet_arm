import { describe, expect, it, vi } from 'vitest';
import { normalizeRowAssignments } from './fichas.people';
import { missingRequiredRows } from './fichas.utils';
import { applyEncuentros } from './fichas.encuentros';
import { buildGlobalSectionsFromMixedFicha, rowsForSingleEncounter } from './fichas.defaults';
import { buildTemplateSections } from './fichas.templates';
import { diffRows } from './fichas.changelog';

const person = (id = 10, name = 'Nombre enviado') => ({ userId: id, name });
const assignment = (id = 10) => ({ mode: 'people', people: [person(id)], note: '' });
const row = (a: any = assignment()) => ({ id: 'r', label: 'Sonido', type: 'person', shared: true, required: true, values: { shared: 'Texto enviado' }, assignments: { shared: a } });
const db = (users: any[] = [{ id: '10', name: 'Ana Pérez', status: 'active', campusId: '1' }]) => ({ query: vi.fn().mockResolvedValue({ rows: users }) });
const normalize = (rows: any[], old: any[] = [], conn: any = db(), global = false, section = 'produccion') => normalizeRowAssignments(rows, old, ['e1', 'e2'], section, '1', global, conn);
const enc = (id: string) => ({ id, label: id, time: '11:00', isLive: false, color: '#111' });

describe('asignaciones vinculadas', () => {
  it('valida personas manuales por campus y guarda el tratamiento con el nombre confiable', async () => {
    const id = '86ae332e-7b26-41cf-94f0-352284b090d8';
    const conn = { query: vi.fn().mockResolvedValue({ rows: [{ id, name: 'Eve', campus_id: 1 }] }) };
    const rows = [row({ mode: 'people', people: [{ manualId: id, name: 'Nombre falso', title: 'Pastora' }], note: '' })];
    await normalize(rows, [], conn);
    expect(rows[0].values.shared).toBe('Pastora Eve');
    expect(rows[0].assignments.shared.people[0]).toEqual({ manualId: id, name: 'Eve', title: 'Pastora' });
    await expect(normalize([row({ mode: 'people', people: [{ manualId: id, name: 'Eve' }], note: '' })], [], { query: vi.fn().mockResolvedValue({ rows: [{ id, name: 'Eve', campus_id: 2 }] }) })).rejects.toThrow('persona manual');
    await expect(normalize([row({ mode: 'people', people: [{ manualId: id, userId: 10, name: 'Eve' }], note: '' })])).rejects.toThrow();
  });
  it('usa IDs y nombres canónicos, admite homónimos y conserva orden', async () => {
    const rows = [row({ ...assignment(), people: [person(11), person(10)] })];
    await normalize(rows, [], db([10, 11].map(id => ({ id: String(id), name: 'Ana Pérez', status: 'active', campusId: 1 }))));
    expect(rows[0].assignments.shared.people).toEqual([person(11, 'Ana Pérez'), person(10, 'Ana Pérez')]);
    expect(rows[0].values.shared).toBe('Ana Pérez / Ana Pérez');
  });
  it('rechaza usuarios inexistentes, inactivos o fuera del campus; permite global autorizado', async () => {
    await expect(normalize([row()], [], db([]))).rejects.toThrow('usuario activo');
    await expect(normalize([row()], [], db([{ id: 10, status: 'inactive', campusId: 1 }]))).rejects.toThrow('usuario activo');
    const other = db([{ id: 10, name: 'Ana', status: 'active', campusId: 2 }]);
    await expect(normalize([row()], [], other)).rejects.toThrow('usuario activo');
    await expect(normalize([row()], [], other, true)).resolves.toBeUndefined();
  });
  it('preserva nombres históricos y vínculos de una persona desactivada sin aceptar nombres manipulados', async () => {
    const old = row({ ...assignment(), people: [person(10, 'Nombre histórico')] });
    const rows = [row()];
    await normalize(rows, [old], db([]));
    expect(rows[0].values.shared).toBe('Nombre histórico');
  });
  it('no enlaza nombres de fichas antiguas', async () => {
    const legacy = { id: 'r', values: { shared: 'Ana Pérez' } };
    const conn = db();
    await normalize([legacy], [], conn);
    expect(legacy).not.toHaveProperty('assignments'); expect(conn.query).not.toHaveBeenCalled();
  });
  it('valida estructura, ids, duplicados, límites y encuentros', async () => {
    for (const a of [null, { ...assignment(), people: [person(10), person(10)] }, { ...assignment(), people: [person(-1)] }, { ...assignment(), people: [person('10' as any)] }, { ...assignment(), note: 'x'.repeat(501) }, { ...assignment(), mode: 'fixed' }]) {
      await expect(normalize([row(a)])).rejects.toThrow();
    }
    await expect(normalize([{ ...row(), assignments: { missing: assignment() } }])).rejects.toThrow('encuentro');
  });
  it('distingue pendiente de recurso resuelto al completar', async () => {
    const pending = row({ mode: 'pending', people: [], note: '' });
    await normalize([pending]);
    expect(pending.values.shared).toBe('Por confirmar');
    expect(missingRequiredRows([pending], ['e1'])).toEqual(['Sonido']);
    const fixed = row({ mode: 'fixed', people: [], note: 'Cámara 4' });
    await normalize([fixed]);
    expect(fixed.values.shared).toBe('Fija · Cámara 4');
    expect(missingRequiredRows([fixed], ['e1'])).toEqual([]);
  });
  it('conserva canción y timing al normalizar sus responsables', async () => {
    const song = { ...row(), type: 'song', values: { shared: JSON.stringify({ titulo: 'Gracia', tonalidad: 'D', cantante: 'Falso' }) } };
    await normalize([song], [], db(), false, 'setList');
    expect(JSON.parse(song.values.shared)).toEqual({ titulo: 'Gracia', tonalidad: 'D', cantante: 'Ana Pérez' });
    const timing = { ...row(), type: 'text', values: { shared: JSON.stringify({ inicio: '11:00', fin: '11:10', responsable: 'Falso' }) } };
    await normalize([timing], [], db(), false, 'horarios');
    expect(JSON.parse(timing.values.shared)).toEqual({ inicio: '11:00', fin: '11:10', responsable: 'Ana Pérez' });
  });
  it('copia y elimina encuentros sin dejar IDs huérfanos', () => {
    const r = { ...row(), shared: false, values: { e1: 'Ana' }, assignments: { e1: assignment() } };
    const f: any = { type: 'multi', encuentros: [enc('e1'), enc('e2')], sections: { produccion: { rows: [r] } } };
    applyEncuentros(f, [enc('e2'), { ...enc('e3'), copyFrom: 'e1' }]);
    expect(f.sections.produccion.rows[0].assignments).toEqual({ e3: assignment() });
    expect(f.sections.produccion.rows[0].values).toEqual({ e3: 'Ana' });
  });
  it('remapea los vínculos al separar oración de global', () => {
    const r = { ...row(), shared: false, values: { e1: 'Ana' }, assignments: { e1: assignment() } };
    expect(rowsForSingleEncounter([r], 'e1')[0].assignments).toEqual({ unico: assignment() });
    const global = buildGlobalSectionsFromMixedFicha({ produccion: { rows: [r] } }, 'e1');
    expect(global.produccion.rows.find((r:any) => r.label === 'Sonido').assignments.shared.people[0].userId).toBe(10);
  });
  it('audita cambios de vínculo incluso con nombres iguales', () => {
    const before = row(); const after = row(assignment(11));
    expect(diffRows([before], [after], []).some(c => c.before?.includes('#10') && c.after?.includes('#11'))).toBe(true);
  });
});

describe('plantillas basadas en PDF', () => {
  it('separa plataforma por encuentro, comparte equipo dentro de la ficha y crea puestos sin nombres', () => {
    for (const template of ['standard', 'santiago'] as const) {
      const s = buildTemplateSections('multi', template);
      expect(s.pastoral.rows).toHaveLength(3);
      expect(s.pastoral.rows.every((r:any) => !r.shared)).toBe(true);
      expect(s.produccion.rows.every((r:any) => r.shared && Object.keys(r.values).length === 0)).toBe(true);
      expect(s.escena.rows.filter((r:any) => r.label.startsWith('Posición'))).toHaveLength(template === 'standard' ? 4 : 3);
    }
  });
});
