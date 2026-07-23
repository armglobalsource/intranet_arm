import { describe, expect, it } from 'vitest';
import { parseFichaDate, toFichaInputDate } from './ficha-date';

describe('fecha civil de una ficha', () => {
  it('mantiene el día de registros históricos guardados a medianoche UTC', () => {
    const date = parseFichaDate('2026-07-22T00:00:00.000Z');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(22);
  });

  it('convierte una fecha a un valor estable para inputs date', () => {
    expect(toFichaInputDate('2026-07-22T12:00:00.000Z')).toBe('2026-07-22');
  });
});
