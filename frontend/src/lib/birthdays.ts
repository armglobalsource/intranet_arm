import type { UserBirthday } from '@/hooks/useUsers';

const DAY = 86_400_000;

/** Read calendar dates without shifting birthdays through UTC. */
export function parseBirthday(value?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value ?? '');
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function localDayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export interface UpcomingBirthday {
  person: UserBirthday;
  daysAway: number;
  date: Date;
  leapDayObserved: boolean;
}

/** In non-leap years, February 29 is observed on March 1. */
export function upcomingBirthdays(people: UserBirthday[], now = new Date(), horizon = 30): UpcomingBirthday[] {
  const year = now.getFullYear();
  const today = Date.UTC(year, now.getMonth(), now.getDate());
  return people.flatMap((person): UpcomingBirthday[] => {
    const birth = parseBirthday(person.birthDate);
    if (!birth || Date.UTC(birth.year, birth.month - 1, birth.day) > today) return [];
    let next = Date.UTC(year, birth.month - 1, birth.day);
    if (next < today) next = Date.UTC(year + 1, birth.month - 1, birth.day);
    const daysAway = (next - today) / DAY;
    if (daysAway > horizon) return [];
    const nextDate = new Date(next);
    return [{ person, daysAway, date: new Date(nextDate.getUTCFullYear(), nextDate.getUTCMonth(), nextDate.getUTCDate(), 12),
      leapDayObserved: birth.month === 2 && birth.day === 29 && nextDate.getUTCMonth() === 2 }];
  }).sort((a, b) => a.daysAway - b.daysAway || `${a.person.firstName} ${a.person.lastName}`.localeCompare(`${b.person.firstName} ${b.person.lastName}`, 'es') || a.person.id - b.person.id);
}
