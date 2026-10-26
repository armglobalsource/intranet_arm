import { describe, expect, it } from 'vitest';
import { statisticsRange, countryName } from './statistics-range';

describe('statistics date ranges', () => {
  it('allows complete history since 2020 with a server-controlled cutoff in Chile', () => {
    const range = statisticsRange(2026, undefined, undefined, true, new Date('2026-10-26T01:00:00Z'));
    expect(range).toMatchObject({ start: '2020-01-01', end: '2026-10-25', previousStart: '2020-01-01' });
    expect(range.days).toBeGreaterThan(366);
    expect(() => statisticsRange(2026, '2010-01-01', '2026-10-25', true)).toThrow();
  });
  it('compares adjacent equal periods across year boundaries', () => {
    expect(statisticsRange(2026, '2026-01-01', '2026-01-07')).toEqual({ start: '2026-01-01', end: '2026-01-07', days: 7, previousStart: '2025-12-25', previousEnd: '2025-12-31' });
  });
  it('accepts leap days and caps the window at 366 days', () => {
    expect(statisticsRange(2024).days).toBe(366);
    expect(statisticsRange(2024, '2024-02-29', '2024-02-29').previousEnd).toBe('2024-02-28');
    expect(() => statisticsRange(2024, '2024-01-01', '2025-01-01')).toThrow();
  });
  it.each([['2026-02-29', '2026-03-01'], ['2026-04-31', '2026-05-01'], ['2026-02-01', '2026-01-01'], ['2026-01-01', undefined], ['bad', '2026-01-01']])('rejects invalid or incomplete ranges %s %s', (from, to) => {
    expect(() => statisticsRange(2026, from, to)).toThrow();
  });
  it('homologates country aliases without guessing campus geography', () => {
    expect(countryName(' CL ')).toBe('Chile');
    expect(countryName('EE.UU.')).toBe('Estados Unidos');
    expect(countryName(null)).toBe('Sin país asignado');
  });
});
