import { describe, expect, it } from 'vitest';
import { localDayKey, parseBirthday, upcomingBirthdays } from './birthdays';
import type { UserBirthday } from '@/hooks/useUsers';

const person = (id: number, birthDate: string, firstName = 'Persona'): UserBirthday => ({ id, birthDate, firstName, lastName: 'ARM', avatarUrl: null });

describe('birthday calendar', () => {
  it('keeps today, tomorrow and the 30-day boundary, sorted without mutating input', () => {
    const rows = [person(1, '1990-11-22'), person(2, '1990-10-24'), person(3, '1990-10-23', 'Zoe'), person(4, '1990-10-23', 'Ana'), person(5, '1990-11-23'), person(6, '1990-10-22')];
    const result = upcomingBirthdays(rows, new Date(2026, 9, 23, 23, 59));
    expect(result.map((b) => [b.person.id, b.daysAway])).toEqual([[4, 0], [3, 0], [2, 1], [1, 30]]);
    expect(rows[0].id).toBe(1);
  });
  it('crosses December to January without dropping upcoming birthdays', () => {
    expect(upcomingBirthdays([person(1, '1980-01-01')], new Date(2026, 11, 31))[0].daysAway).toBe(1);
  });
  it('treats stored ISO dates as calendar dates, not timestamps in another zone', () => {
    const result = upcomingBirthdays([person(1, '1990-10-23T00:00:00.000Z')], new Date(2026, 9, 23));
    expect(result[0].daysAway).toBe(0);
    expect(localDayKey(result[0].date)).toBe('2026-10-23');
  });
  it('ignores missing, impossible and future birth dates', () => {
    expect(parseBirthday(null)).toBeNull();
    expect(upcomingBirthdays(['', 'bad', '1990-02-30', '1990-13-01', '2027-10-23'].map((date, i) => person(i, date)), new Date(2026, 9, 23))).toEqual([]);
    expect(parseBirthday('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 });
    expect(parseBirthday('1900-02-29')).toBeNull();
  });
  it('observes leap-day birthdays on March 1 except in leap years', () => {
    const rows = [person(1, '2000-02-29')];
    const ordinary = upcomingBirthdays(rows, new Date(2027, 1, 28))[0];
    expect([ordinary.daysAway, localDayKey(ordinary.date), ordinary.leapDayObserved]).toEqual([1, '2027-03-01', true]);
    expect(upcomingBirthdays(rows, new Date(2027, 2, 1))[0].daysAway).toBe(0);
    const leap = upcomingBirthdays(rows, new Date(2028, 1, 28))[0];
    expect([leap.daysAway, localDayKey(leap.date), leap.leapDayObserved]).toEqual([1, '2028-02-29', false]);
  });
  it('counts calendar days correctly across a daylight-saving transition', () => {
    expect(upcomingBirthdays([person(1, '1990-09-07')], new Date(2026, 8, 5))[0].daysAway).toBe(2);
  });
});
