import { describe, expect, it } from 'vitest';
import { migrateMediaData } from './fichas.defaults';

describe('migración del módulo Media', () => {
  it('mueve asignaciones antiguas desde Producción sin perder datos', () => {
    const migration = migrateMediaData({
      type: 'multi',
      hiddenSections: [],
      completionStatus: {
        pastoral: true,
        escena: true,
        produccion: true,
        streaming: true,
        setList: true,
        horarios: true,
        anuncios: true,
        voluntarios: true,
        outfit: true,
      },
      sections: {
        produccion: {
          revision: 2,
          rows: [
            { id: 'pr11', label: 'RRSS', values: { shared: 'Persona RRSS' } },
            { id: 'pr12', label: 'Fotografía y Edición', values: { shared: 'Equipo creativo' } },
            { id: 'pr13', label: 'Registro Audiovisual', values: { shared: 'Persona registro' } },
            { id: 'pr14', label: 'Historias', values: { shared: 'Persona historias' } },
          ],
        },
      },
    });

    expect(migration).not.toBeNull();
    expect(migration!.sections.produccion.rows.map((row: any) => row.label)).toEqual(['RRSS']);
    expect(migration!.sections.media.rows.map((row: any) => row.values.shared)).toEqual([
      'Persona historias',
      'Equipo creativo',
      'Equipo creativo',
      'Persona registro',
    ]);
    expect(migration!.completionStatus.media).toBe(false);
    expect(migration!.status).toBe('in_progress');
  });
});
