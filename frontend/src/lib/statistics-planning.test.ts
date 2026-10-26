import { describe, expect, it } from 'vitest';
import { campusProjection, planningRange, type PlanningRecord } from './statistics-planning';

const range = { from: '2026-08-31', to: '2026-10-25' };
const records: PlanningRecord[] = Array.from({ length: 8 }, (_, i) => ({
  campusId: 1, fecha: new Date(Date.UTC(2026, 7, 31 + 7 * i)).toISOString().slice(0, 10),
  fechaPrecision: 'dia', tipo: 'encuentro', asistencia: i === 0 ? 8000 : 100,
}));
describe('campus planning', () => {
  it('uses eight closed Chilean weeks and excludes the current week', () => {
    expect(planningRange(new Date('2026-10-26T15:00:00Z'))).toEqual(range);
  });
  it('uses a median, counts attendance rather than unique people, and excludes monthly records/events/other campuses/future', () => {
    const result = campusProjection([...records,
      { ...records[0], tipo: 'evento', asistencia: 99999 },
      { ...records[0], fechaPrecision: 'mes', asistencia: 99999 },
      { ...records[0], campusId: 2, asistencia: 99999 },
      { ...records[0], fecha: '2026-10-26', asistencia: 99999 },
    ], 1, range);
    expect(result.baseline).toBe(400);
    expect(result.reports).toBe(8);
  });
  it('does not project with insufficient coverage or a missing recent week', () => {
    expect(campusProjection(records.slice(3), 1, range).baseline).toBeNull();
    expect(campusProjection(records.slice(0, 7), 1, range).reason).toContain('últimas dos');
  });
  it('does not silently fill missing weeks with zero', () => {
    expect(campusProjection(records.slice(2), 1, range).baseline).toBe(400);
    expect(campusProjection(records.slice(2), 1, range).observedWeeks).toBe(6);
    expect(campusProjection(records.map(r => ({ ...r, asistencia: 0 })), 1, range).baseline).toBeNull();
  });
});
