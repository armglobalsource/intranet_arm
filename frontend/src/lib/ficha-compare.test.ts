import { describe, expect, it } from 'vitest';
import { compareRows, shareValues, splitValues } from './ficha-compare';
import type { Encuentro, Row } from '@/types/ficha';

const encuentros = [
  { id: 'e1', label: '09:00', time: '09:00', isLive: false, color: '' },
  { id: 'e2', label: '11:00', time: '11:00', isLive: false, color: '' },
] as Encuentro[];
const row = (id: string, label: string, values: Record<string, string>, shared = false, order = 0): Row =>
  ({ id, label, values, shared, order, type: 'text', required: false } as Row);

describe('ficha compare', () => {
  it('marks rows that change between encuentros and shared rows', () => {
    const rows = compareRows('produccion', [
      row('a', 'Sonido', { e1: 'Ana', e2: 'Juan' }, false, 0),
      row('b', 'Luces', { e1: 'Pedro', e2: 'Pedro' }, false, 1),
      row('c', 'Productor', { shared: 'Rodrigo' }, true, 2),
      row('d', 'RRSS', {}, false, 3),
    ], encuentros);
    expect(rows.map((r) => [r.label, r.differs, r.shared, r.empty])).toEqual([
      ['Sonido', true, false, false], ['Luces', false, false, false], ['Productor', false, true, false], ['RRSS', false, false, true],
    ]);
    expect(rows[2].sharedText).toBe('Rodrigo');
  });

  it('shows songs and timing in words', () => {
    const [song] = compareRows('setList', [row('s', 'Canción 1', { e1: '{"titulo":"Way Maker","tonalidad":"E","cantante":"Ana"}' })], encuentros);
    expect(song.cells[0].text).toBe('Way Maker (E) · Ana');
    const [moment] = compareRows('horarios', [row('h', 'Worship', { e1: '{"inicio":"09:05","fin":"09:25","nota":"Suave"}', e2: '11:05' })], encuentros);
    expect(moment.cells.map((c) => c.text)).toEqual(['09:05–09:25 · Suave', '11:05']);
  });

  it('shares a row keeping the chosen encuentro value and splits it back', () => {
    const r = row('a', 'Sonido', { e1: '', e2: 'Juan' });
    expect(shareValues(r, encuentros, 'e1')).toEqual({ values: { shared: 'Juan' }, conflict: false, kept: 'Juan' });
    expect(shareValues(row('b', 'Luces', { e1: 'Ana', e2: 'Juan' }), encuentros, 'e2')).toMatchObject({ values: { shared: 'Juan' }, conflict: true });
    expect(splitValues(row('c', 'Productor', { shared: 'Rodrigo' }, true), encuentros)).toEqual({ e1: 'Rodrigo', e2: 'Rodrigo' });
  });
});
