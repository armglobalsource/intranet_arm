import { describe, expect, it } from 'vitest';
import { fichaPermisos } from './fichas.access';

const ficha = (extra: any = {}) => ({
  campusId: '1', createdBy: 99, published: false,
  sections: { streaming: { assignedTo: 7 }, media: { assignedTo: 8 }, horarios: {} },
  equipo: { encargadoTecnico: { userId: 5, name: 'Encargado' }, responsableActualizacion: { userId: 6, name: 'Responsable' } },
  ...extra,
});
const user = (sub: number, permissions: string[] = ['fichas:view'], campusId = 1) => ({ sub, email: `${sub}@x`, campusId, permissions });

describe('ficha roles and permissions', () => {
  it('gives the Productor General full control in every campus', () => {
    const p = fichaPermisos(ficha(), user(1, ['fichas:admin'], 2));
    expect(p).toMatchObject({ rol: 'productor', view: true, structure: true, content: true, layoutVisual: true, publish: true, designateEncargado: true });
  });

  it('lets the Encargado Técnico edit content, publish and designate the update responsible, but not the structure', () => {
    const p = fichaPermisos(ficha(), user(5));
    expect(p).toMatchObject({ rol: 'encargado', structure: false, content: true, publish: true, designateEncargado: false, designateResponsable: true });
    expect(p.sections).toEqual(['streaming', 'media', 'horarios']);
  });

  it('lets the Responsable de Actualización edit content without publishing', () => {
    expect(fichaPermisos(ficha(), user(6))).toMatchObject({ rol: 'responsable', content: true, publish: false, designateResponsable: false });
  });

  it('limits an area responsible to their own section, also in a draft', () => {
    const p = fichaPermisos(ficha(), user(7));
    expect(p).toMatchObject({ rol: 'area', view: true, content: false, sections: ['streaming'], layoutVisual: false, publish: false });
  });

  it('lets the global visuals responsible edit only the Layout Visual in any campus', () => {
    expect(fichaPermisos(ficha(), user(9, ['fichas:view', 'fichas:layout'], 3))).toMatchObject({ rol: 'visuales', view: true, content: false, sections: [], layoutVisual: true });
  });

  it('shows the published ficha to other teams of the campus, read only', () => {
    expect(fichaPermisos(ficha(), user(10)).view).toBe(false);
    expect(fichaPermisos(ficha({ published: true }), user(10))).toMatchObject({ rol: 'lector', view: true, sections: [], layoutVisual: false, publish: false });
    expect(fichaPermisos(ficha({ published: true }), user(10, ['fichas:view'], 4)).view).toBe(false);
  });

  it('requires its own permission to publish', () => {
    expect(fichaPermisos(ficha(), user(11, ['fichas:edit'])).publish).toBe(false);
    expect(fichaPermisos(ficha(), user(11, ['fichas:edit', 'fichas:publish'])).publish).toBe(true);
    expect(fichaPermisos(ficha(), user(11, ['fichas:edit', 'fichas:publish'], 2)).publish).toBe(false);
  });
});
