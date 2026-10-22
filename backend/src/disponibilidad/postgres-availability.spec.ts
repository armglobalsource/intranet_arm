import { describe,it,expect } from 'vitest';
import { buildEncounters,isoWeekMonday } from './postgres-availability';
describe('PostgreSQL availability schedules',()=>{
  it('rejects nonexistent ISO weeks and accepts a real week 53',()=>{
    expect(()=>isoWeekMonday('2026-W00')).toThrow();
    expect(()=>isoWeekMonday('2025-W53')).toThrow();
    expect(isoWeekMonday('2026-W53').toISOString()).toBe('2026-12-28T00:00:00.000Z');
    expect(()=>isoWeekMonday('2026-W54')).toThrow();
  });
  it('groups same-day blocks, preserves separate slots and does not mutate schedules',()=>{
    const schedules=[{dia:'Domingo',hora:'11:00',bloque:'AM'},{dia:'Domingo',hora:'09:00',bloque:'AM'},{dia:'Miércoles',hora:'20:00'}];
    const before=JSON.stringify(schedules);
    const result=buildEncounters(schedules,'2026-W43');
    expect(result.map(r=>r.scheduleKey)).toEqual(['Miércoles_20:00','Domingo_AM']);
    expect(result[1].hora).toBe('09:00 · 11:00');
    expect(result[1].encounterDate.toISOString()).toBe('2026-10-25T09:00:00.000Z');
    expect(JSON.stringify(schedules)).toBe(before);
  });
  it('rejects malformed stored times before creating commitments',()=>{
    expect(()=>buildEncounters([{dia:'Domingo',hora:'25:70'}],'2026-W43')).toThrow();
  });
});
