import { describe, expect, it } from 'vitest';
import {
  activeSectionsForType,
  deriveFichaStatus,
  missingRequiredRows,
  parseFichaDate,
} from './fichas.utils';

describe('fichas utils', () => {
  it('preserva el día civil al convertir una fecha sin hora', () => {
    const parsed = parseFichaDate('2026-07-22');
    expect(parsed.toISOString()).toBe('2026-07-22T12:00:00.000Z');
  });

  it('incluye Media entre las secciones activas de una ficha de oración', () => {
    const active = activeSectionsForType('oracion');
    expect(active).toHaveLength(8);
    expect(active).toContain('media');
    expect(active).not.toContain('anuncios');
    expect(active).not.toContain('voluntarios');
  });

  it('completa correctamente una ficha de oración', () => {
    const completion = Object.fromEntries(
      activeSectionsForType('oracion').map((section) => [section, true]),
    );
    expect(deriveFichaStatus('oracion', completion)).toBe('complete');
  });

  it('ignora las secciones ocultas al derivar el estado', () => {
    expect(deriveFichaStatus(
      'multi',
      {
        pastoral: true,
        escena: false,
        produccion: false,
        media: false,
        streaming: false,
        setList: false,
        horarios: false,
        anuncios: false,
        voluntarios: false,
        outfit: false,
      },
      ['escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit'],
    )).toBe('complete');
  });

  it('detecta valores obligatorios faltantes por encuentro', () => {
    expect(missingRequiredRows([
      {
        label: 'Predicación',
        required: true,
        shared: false,
        values: { e1: 'Persona A', e2: '' },
      },
    ], ['e1', 'e2'])).toEqual(['Predicación']);
  });
});
