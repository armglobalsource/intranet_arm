import { describe, expect, it } from 'vitest';
import { cleanLabel, durationMinutes, encodeMoment, momentTree, parseMoment, withDuration } from './ficha-timing';
import type { Row } from '@/types/ficha';

const row = (id: string, label: string, values: Record<string, string>, extra: Partial<Row> = {}): Row =>
  ({ id, label, values, order: 0, shared: false, type: 'text', required: false, ...extra } as Row);

describe('ficha timing', () => {
  it('reads old rows with a single time', () => {
    const p = parseMoment(row('h5', 'Inicio Worship', { e1: '20:00' }), 'e1');
    expect(p).toMatchObject({ legacy: true, label: 'Inicio Worship', value: { inicio: '20:00', tipo: 'worship' } });
  });

  it('extracts ranges and durations written inside the name', () => {
    const p = parseMoment(row('x', 'AR Worship (17 min) | 20:00 - 20:17', {}), 'e1');
    expect(p.label).toBe('AR Worship');
    expect(p.value).toMatchObject({ inicio: '20:00', fin: '20:17' });
    expect(durationMinutes(p.value)).toBe(17);
    const countdown = parseMoment(row('y', 'Countdown (05 min)', { e1: '19:55' }), 'e1');
    expect(countdown.value).toMatchObject({ inicio: '19:55', fin: '20:00', tipo: 'video' });
  });

  it('reads prayer rows with the time in the name and a description or person in the value', () => {
    const text = parseMoment(row('or1', '05:10-05:40 — Preparativos', { shared: 'Ensambles · Prueba' }, { shared: true }), 'unico');
    expect(text).toMatchObject({ label: 'Preparativos', value: { inicio: '05:10', fin: '05:40', nota: 'Ensambles · Prueba' } });
    const person = parseMoment(row('or7', '06:00 — Predicación', { shared: 'Pr. Rodrigo' }, { shared: true, type: 'person' }), 'unico');
    expect(person.value).toMatchObject({ inicio: '06:00', responsable: 'Pr. Rodrigo', tipo: 'predicacion' });
  });

  it('round-trips the structured value and drops empty fields', () => {
    const raw = encodeMoment({ inicio: '9:05', fin: '09:20', tipo: 'noticia', nota: 'Leer', enlace: { seccion: 'anuncios', rowId: 'an1' }, responsable: ' ' });
    expect(JSON.parse(raw)).toEqual({ inicio: '09:05', fin: '09:20', tipo: 'noticia', nota: 'Leer', enlace: { seccion: 'anuncios', rowId: 'an1' } });
    expect(parseMoment(row('a', 'Bienvenida', { e1: raw }), 'e1')).toMatchObject({ legacy: false, value: { inicio: '09:05', tipo: 'noticia' } });
    expect(encodeMoment({ tipo: 'momento' })).toBe('');
  });

  it('changes duration by moving the end time, also across midnight', () => {
    expect(withDuration({ inicio: '23:50' }, 20)).toEqual({ inicio: '23:50', fin: '00:10' });
    expect(durationMinutes({ inicio: '23:50', fin: '00:10' })).toBe(20);
  });

  it('nests sub-moments under their parent and sorts by start time', () => {
    const tree = momentTree([
      row('b', 'Predicación', { e1: '{"inicio":"20:23"}' }, { order: 0 }),
      row('a', 'Worship', { e1: '{"inicio":"20:00"}' }, { order: 1 }),
      row('a2', 'Canción 2', { e1: '{"inicio":"20:09"}' }, { order: 2, parentId: 'a' }),
      row('a1', 'Canción 1', { e1: '{"inicio":"20:01"}' }, { order: 3, parentId: 'a' }),
    ], 'e1', true);
    expect(tree.map((n) => [n.label, n.children.map((c) => c.label)])).toEqual([
      ['Worship', ['Canción 1', 'Canción 2']], ['Predicación', []],
    ]);
  });

  it('keeps names without times untouched', () => {
    expect(cleanLabel('Preparación sala')).toBe('Preparación sala');
  });
});
