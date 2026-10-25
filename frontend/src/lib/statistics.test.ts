import { describe, expect, it } from 'vitest';
import { statsPreset, statsChange, validStatsRange } from './statistics';
describe('statistics filters and comparisons', () => {
  it('selects a complete Monday–Sunday week, including across years', () => {
    expect(statsPreset('week', new Date('2026-01-05T15:00:00Z'))).toEqual({ from: '2025-12-29', to: '2026-01-04' });
  });
  it('uses the Chilean calendar date near UTC midnight', () => {
    expect(statsPreset('year', new Date('2026-01-01T01:00:00Z'))).toEqual({ from: '2025-01-01', to: '2025-12-31' });
    expect(statsPreset('month', new Date('2026-10-24T15:00:00Z'))).toEqual({ from: '2026-10-01', to: '2026-10-24' });
  });
  it('requires finite valid ranges of at most 366 days', () => {
    expect(validStatsRange('2024-01-01', '2024-12-31')).toBe(true);
    expect(validStatsRange('2026-02-29', '2026-03-01')).toBe(false);
    expect(validStatsRange('2024-01-01', '2025-01-01')).toBe(false);
    expect(validStatsRange('', '')).toBe(false);
  });
  it('distinguishes no comparison base from zero growth', () => {
    expect(statsChange(10, 0)).toEqual({ delta: 10, percent: null });
    expect(statsChange(0, 100)).toEqual({ delta: -100, percent: -100 });
    expect(statsChange(120, 100)).toEqual({ delta: 20, percent: 20 });
  });
});
