import { describe, expect, it, vi } from 'vitest';
import { PostgresFichasService } from './postgres-fichas.service';

const admin = { sub: 1, email: 'editor@example.test', campusId: 1, permissions: ['*'] };
const reader = { ...admin, sub: 2, permissions: ['fichas:view'] };
function fixture() {
  const assignment = { mode: 'people', people: [{ userId: 10, name: 'Ana' }], note: '' };
  const ficha: any = { document_id: 'f1', campusId: '1', type: 'unico', published: true, encuentros: [{ id: 'unico', time: '11:00' }],
    sections: { pastoral: { assignedTo: 3, revision: 7, rows: [{ id: 'p1', type: 'person', label: 'Bienvenida', shared: true, required: true, values: { shared: 'Ana' }, assignments: { shared: assignment } }] }, media: { rows: [] } } };
  const query = vi.fn(async (sql: string, params: any[] = []): Promise<any> => {
    if (sql.startsWith('SELECT * FROM arm_app.fichas')) return { rows: [structuredClone(ficha)] };
    if (sql.startsWith('SELECT u.id AS')) return { rows: [{ userId: '10', name: 'Ana', campusName: 'Santiago' }], fields: [{ name: 'userId', dataTypeID: 20 }] };
    if (sql.startsWith('SELECT id, btrim')) return { rows: [{ id: '10', name: 'Ana', status: 'active', campusId: 1 }] };
    if (sql.startsWith('UPDATE arm_app.fichas') || sql.startsWith('INSERT INTO arm_app.fichas')) return { rows: [ficha], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
  const db = { query, transaction: async (fn: any) => fn({ query }) };
  return { service: new PostgresFichasService(db as any), query, ficha };
}
describe('directorio y persistencia desde fichas', () => {
  it('permite al responsable de área buscar sin acceso administrativo de usuarios y limita al campus', async () => {
    const { service, query } = fixture();
    const result = await service.findPeople('f1', { ...reader, sub: 3 }, 'Pérez Ana');
    expect(result).toEqual([{ userId: 10, name: 'Ana', campusName: 'Santiago' }]);
    expect(query.mock.calls.at(-1)?.[1]).toEqual([false, '1', ['%perez%', '%ana%']]);
    expect(query.mock.calls.at(-1)?.[0]).not.toContain('email');
  });
  it('bloquea consulta del directorio y escritura a lectores y editores ajenos', async () => {
    const { service, query } = fixture();
    for (const user of [reader, { ...reader, campusId: 2, permissions: ['fichas:edit'] }]) {
      await expect(service.findPeople('f1', user, 'Ana')).rejects.toThrow();
      await expect(service.createManualPerson('f1', user, 'Eve')).rejects.toThrow();
      await expect(service.updateSection('f1', 'pastoral', { rows: [] }, user)).rejects.toThrow();
    }
    expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT * FROM arm_app.fichas'))).toBe(true);
  });
  it('rechaza guardado obsoleto antes de modificar asignaciones', async () => {
    const { service, query, ficha } = fixture();
    await expect(service.updateSection('f1', 'pastoral', { expectedRevision: 6, rows: ficha.sections.pastoral.rows }, admin)).rejects.toThrow('La sección cambió');
    expect(query.mock.calls.some(([sql]) => sql.startsWith('UPDATE'))).toBe(false);
  });
  it('guarda personas y valores en la misma actualización de sección', async () => {
    const { service, query, ficha } = fixture();
    const rows = structuredClone(ficha.sections.pastoral.rows);
    rows[0].assignments.shared.note = 'Apoyo';
    await service.updateSection('f1', 'pastoral', { expectedRevision: 7, rows }, admin);
    const write = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE arm_app.fichas'))!;
    const sectionParam = write[1]?.find((v:any) => typeof v === 'string' && v.startsWith('{"pastoral"'));
    const saved = JSON.parse(sectionParam).pastoral;
    expect(saved.revision).toBe(8);
    expect(saved.rows[0].values.shared).toBe('Ana · Apoyo');
    expect(saved.rows[0].assignments.shared.people[0].userId).toBe(10);
  });
  it('la vista pública conserva nombres pero no expone IDs de asignación', async () => {
    const { service } = fixture();
    const result = await service.findPublic('f1');
    expect(result.sections.pastoral.rows[0].values.shared).toBe('Ana');
    expect(result.sections.pastoral.rows[0]).not.toHaveProperty('assignments');
    expect(result.sections.pastoral).not.toHaveProperty('assignedTo');
  });
  it('clonar limpia personas operativas aunque se conserven responsables de sección', async () => {
    const { service, query } = fixture();
    await service.clone('f1', admin, { keepAssignees: true });
    const write = query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO arm_app.fichas'))!;
    const sectionParam = write[1]?.find((v:any) => typeof v === 'string' && v.startsWith('{"pastoral"'));
    const saved = JSON.parse(sectionParam).pastoral;
    expect(saved.assignedTo).toBe(3);
    expect(saved.rows[0].values).toEqual({});
    expect(saved.rows[0].assignments).toEqual({});
  });
});
