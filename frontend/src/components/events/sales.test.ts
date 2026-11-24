import { describe, expect, it } from 'vitest';
import { fillDays, shortDay } from './EventSales';

describe('Panel de ventas', () => {
  it('completa con cero los días sin ventas para no esconderlos', () => {
    const days = fillDays([{ day: '2026-11-20', tickets: 2, amount: 20000 }, { day: '2026-11-23', tickets: 1, amount: 10000 }]);
    expect(days.map((d) => [d.day, d.tickets])).toEqual([['2026-11-20', 2], ['2026-11-21', 0], ['2026-11-22', 0], ['2026-11-23', 1]]);
    expect(fillDays([])).toEqual([]);
  });
  it('muestra la fecha corta sin desfase de zona horaria', () => {
    expect(shortDay('2026-11-20')).toBe('20 nov');
    expect(shortDay('2027-01-01')).toBe('1 ene');
  });
});
