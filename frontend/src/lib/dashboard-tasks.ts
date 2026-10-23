import type { FichaListItem } from '../types/ficha';
import { parseFichaDate } from './ficha-date';

/** Upcoming unfinished work; old or archived fichas are not today's tasks. */
export function pendingDashboardFichas(fichas: FichaListItem[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = (ficha: FichaListItem) => parseFichaDate(ficha.date).getTime();
  return fichas.filter(ficha => !ficha.archived && ficha.status !== 'complete'
    && (Number.isNaN(time(ficha)) || time(ficha) >= today))
    .sort((a, b) => (Number.isNaN(time(a)) ? Infinity : time(a))
      - (Number.isNaN(time(b)) ? Infinity : time(b)));
}
