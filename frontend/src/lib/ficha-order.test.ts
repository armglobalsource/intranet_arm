import { describe, expect, it } from 'vitest';
import { moveFichaBlock, reorderFichaRows } from './ficha-order';
import type { Row } from '@/types/ficha';

const row = (id: string, order: number): Row => ({ id, order, label: id, type: 'person', shared: true, required: true, values: { shared: `Persona ${id}` } });

describe('Orden de fichas', () => {
  it('mueve por ID en una lista desordenada y conserva personas y filas ocultas', () => {
    const rows = [row('c', 2), row('a', 0), row('hidden', 1)];
    const next = reorderFichaRows(rows, 'c', 'a');
    expect(next.map((r) => r.id)).toEqual(['c', 'a', 'hidden']);
    expect(next.map((r) => r.order)).toEqual([0, 1, 2]);
    expect(next[0].values.shared).toBe('Persona c');
    expect(rows[0].order).toBe(2);
  });
  it('ignora destinos inválidos y movimientos sin cambio', () => {
    const rows = [row('a', 0)];
    expect(reorderFichaRows(rows, 'a', 'missing')).toBe(rows);
    expect(reorderFichaRows(rows, 'a', 'a')).toBe(rows);
  });
  it('reordena dentro de una columna y conserva la proporción', () => {
    const layout = { left: ['a', 'b', 'c'], right: ['d'], leftRatio: 0.6 };
    expect(moveFichaBlock(layout, 'a', 'c')).toEqual({ ...layout, left: ['b', 'c', 'a'] });
    expect(layout.left).toEqual(['a', 'b', 'c']);
  });
  it('mueve entre columnas, incluso hacia una columna vacía, sin duplicar bloques', () => {
    const layout = { left: ['a', 'hidden'], right: ['b'] };
    expect(moveFichaBlock(layout, 'a', 'b')).toEqual({ left: ['hidden'], right: ['a', 'b'] });
    expect(moveFichaBlock({ left: ['a'], right: [] }, 'a', 'column:right')).toEqual({ left: [], right: ['a'] });
    expect(moveFichaBlock(layout, 'a', 'missing')).toBe(layout);
  });
});
