import { describe, expect, it } from 'vitest';
import { applyEncuentros } from './fichas.encuentros';

const enc = (id: string, time: string, label = `Encuentro ${time}`) => ({ id, label, time, isLive: false, color: '#6366f1' });

function ficha() {
  return {
    type: 'multi',
    encuentros: [enc('e1', '09:00'), enc('e2', '11:00')],
    sections: {
      produccion: { rows: [
        { id: 'p1', label: 'Sonido', shared: false, values: { e1: 'Ana', e2: 'Juan' } },
        { id: 'p2', label: 'Productor', shared: true, values: { shared: 'Pedro' } },
      ] },
    },
    layoutVisual: { slots: [{ id: 'am', encuentroIds: ['e1', 'e2'], songs: [] }] },
  };
}

describe('ficha encuentros', () => {
  it('adds an encuentro copying the values of another one', () => {
    const f = ficha();
    const { change, touched } = applyEncuentros(f, [enc('e1', '09:00'), enc('e2', '11:00'), { ...enc('e3', '13:00'), copyFrom: 'e2' }]);
    expect(f.sections.produccion.rows[0].values).toEqual({ e1: 'Ana', e2: 'Juan', e3: 'Juan' });
    expect(f.sections.produccion.rows[1].values).toEqual({ shared: 'Pedro' });
    expect(f.encuentros.map((e: any) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect((f.encuentros[2] as any).copyFrom).toBeUndefined();
    expect(change).toMatchObject({ added: ['Encuentro 13:00 · 13:00'], removed: [] });
    expect(touched).toEqual(['produccion']);
  });

  it('removes an encuentro with its values and becomes a single-encuentro ficha', () => {
    const f = ficha();
    const { change } = applyEncuentros(f, [enc('e2', '11:30', 'Encuentro AM')]);
    expect(f.sections.produccion.rows[0].values).toEqual({ e2: 'Juan' });
    expect(f.layoutVisual.slots[0].encuentroIds).toEqual(['e2']);
    expect(f.type).toBe('unico');
    expect(change).toMatchObject({ removed: ['Encuentro 09:00 · 09:00'], changed: [{ before: 'Encuentro 11:00 · 11:00', after: 'Encuentro AM · 11:30' }] });
  });

  it('rejects invalid lists', () => {
    expect(() => applyEncuentros(ficha(), [])).toThrow('al menos un encuentro');
    expect(() => applyEncuentros(ficha(), [enc('e1', '9:00')])).toThrow('Hora inválida');
    expect(() => applyEncuentros(ficha(), [enc('e1', '09:00'), enc('e1', '10:00')])).toThrow('único');
    expect(() => applyEncuentros(ficha(), Array.from({ length: 13 }, (_, i) => enc(`e${i}`, '10:00')))).toThrow('hasta 12');
    expect(() => applyEncuentros({ ...ficha(), type: 'oracion' }, [enc('a', '06:00'), enc('b', '07:00'), enc('c', '20:00')])).toThrow('oración');
  });

  it('reports nothing when the list is the same', () => {
    expect(applyEncuentros(ficha(), [enc('e1', '09:00'), enc('e2', '11:00')]).change).toBeNull();
  });
});
