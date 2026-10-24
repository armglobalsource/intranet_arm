import { describe, expect, it } from 'vitest';
import { diffRows, displayValue, mergeRowChanges } from './fichas.changelog';

const encuentros = [{ id: 'e1', time: '09:00' }, { id: 'e2', time: '11:00' }];
const row = (id: string, label: string, values: Record<string, string> = {}) => ({ id, label, values });

describe('ficha changelog', () => {
  it('reports value changes per encuentro with before and after', () => {
    const changes = diffRows([row('p1', 'Predicación', { e1: 'Pr. Rodrigo' })], [row('p1', 'Predicación', { e1: 'Pr. Diego', e2: 'Pr. Rodrigo' })], encuentros);
    expect(changes).toEqual([
      { kind: 'value', rowId: 'p1', label: 'Predicación', encuentro: '09:00', before: 'Pr. Rodrigo', after: 'Pr. Diego' },
      { kind: 'value', rowId: 'p1', label: 'Predicación', encuentro: '11:00', before: null, after: 'Pr. Rodrigo' },
    ]);
  });

  it('reports added, removed and renamed rows, and shared values without encuentro', () => {
    const changes = diffRows([row('a', 'Sonido', { shared: 'Ana' }), row('b', 'RRSS')], [row('a', 'Audio', { shared: 'Ana' }), row('c', 'Luces')], encuentros);
    expect(changes.map(c => [c.kind, c.label, c.encuentro])).toEqual([
      ['renamed', 'Audio', null], ['added', 'Luces', null], ['removed', 'RRSS', null],
    ]);
  });

  it('shows songs by title instead of raw JSON', () => {
    expect(displayValue(JSON.stringify({ titulo: 'Way Maker', tonalidad: 'E', cantante: 'Ana' }))).toBe('Way Maker (E) · Ana');
  });

  it('merges consecutive autosaves keeping the original before and the latest after', () => {
    const first = diffRows([row('p1', 'Bienvenida', { shared: '' })], [row('p1', 'Bienvenida', { shared: 'Hola' })], encuentros);
    const second = diffRows([row('p1', 'Bienvenida', { shared: 'Hola' })], [row('p1', 'Bienvenida', { shared: 'Hola a todos' })], encuentros);
    expect(mergeRowChanges(first, second)).toEqual([
      { kind: 'value', rowId: 'p1', label: 'Bienvenida', encuentro: null, before: null, after: 'Hola a todos' },
    ]);
  });

  it('drops edits that return to the original value', () => {
    const first = diffRows([row('p1', 'Sonido', { shared: 'Ana' })], [row('p1', 'Sonido', { shared: 'Juan' })], encuentros);
    const back = diffRows([row('p1', 'Sonido', { shared: 'Juan' })], [row('p1', 'Sonido', { shared: 'Ana' })], encuentros);
    expect(mergeRowChanges(first, back)).toEqual([]);
  });
});
