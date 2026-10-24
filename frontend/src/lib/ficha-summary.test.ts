import { describe, expect, it } from 'vitest';
import { describeChange, isRecent, nowAndNext, parseClock, relativeTime, timingFor } from './ficha-summary';
import type { Row } from '@/types/ficha';

const row = (id: string, label: string, values: Record<string, string>, order: number, shared = false): Row =>
  ({ id, label, values, order, shared, type: 'text', required: false } as Row);

describe('ficha summary', () => {
  it('reads times from values or, in prayer fichas, from the label', () => {
    expect(parseClock('20:00')).toBe(1200);
    expect(parseClock('sin hora')).toBeNull();
    const moments = timingFor([
      row('a', 'Predicación', { e1: '20:23' }, 2),
      row('b', 'Inicio Worship', { e1: '20:00' }, 1),
      row('c', '05:10-05:40 — Preparativos', { shared: 'Ensambles' }, 0, true),
      row('d', 'Ensayo', {}, 3),
    ], 'e1');
    expect(moments.map((m) => [m.label, m.time, m.main])).toEqual([
      ['Preparativos', '05:10–05:40', false],
      ['Inicio Worship', '20:00', true],
      ['Predicación', '20:23', true],
    ]);
  });

  it('finds the current and next moment', () => {
    const moments = timingFor([row('a', 'Worship', { u: '20:00' }, 0), row('b', 'Predicación', { u: '20:23' }, 1)], 'u');
    expect(nowAndNext(moments, 20 * 60 + 10)).toMatchObject({ current: { label: 'Worship' }, next: { label: 'Predicación' } });
    expect(nowAndNext(moments, 19 * 60)).toMatchObject({ current: null, next: { label: 'Worship' } });
  });

  it('describes history entries in plain language', () => {
    const labels = { pastoral: 'Equipo Pastoral', horarios: 'Horarios' };
    const rows = describeChange({ document_id: '1', seccion: 'pastoral', userName: 'Ana', timestamp: '', cambios: { kind: 'rows', changes: [
      { kind: 'value', label: 'Predicación', encuentro: '09:00', before: 'Pr. Rodrigo', after: 'Pr. Diego' },
      { kind: 'added', label: 'Oración final', encuentro: null, before: null, after: null },
    ] } }, labels);
    expect(rows).toEqual({ title: 'Editó Equipo Pastoral', details: ['Predicación (09:00): «Pr. Rodrigo» → «Pr. Diego»', 'Agregó la fila «Oración final»'] });
    expect(describeChange({ document_id: '2', seccion: 'horarios', userName: null, timestamp: '', cambios: { kind: 'complete' } }, labels).title)
      .toBe('Marcó Horarios como completa');
    expect(describeChange({ document_id: '3', seccion: 'horarios', userName: null, timestamp: '', cambios: { fields: ['rows'], rowCount: 3 } }, labels).title)
      .toBe('Editó Horarios');
  });

  it('formats relative times and recent changes', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    expect(relativeTime('2026-10-24T11:55:00Z', now)).toBe('hace 5 min');
    expect(relativeTime('2026-10-24T09:00:00Z', now)).toBe('hace 3 h');
    expect(relativeTime('2026-10-23T12:00:00Z', now)).toBe('ayer');
    expect(isRecent('2026-10-23T13:00:00Z', 48, now)).toBe(true);
    expect(isRecent('2026-10-20T12:00:00Z', 48, now)).toBe(false);
  });
});
