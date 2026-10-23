import { describe, expect, it } from 'vitest';
import { pendingDashboardFichas } from './dashboard-tasks';
import type { FichaListItem } from '../types/ficha';

const ficha = (fichaId: string, date: string | null, extra = {}): FichaListItem => ({
  fichaId, date, status: 'draft', title: fichaId, campusId: '1', campusName: 'Campus',
  type: 'unico', completionStatus: {} as FichaListItem['completionStatus'], ...extra,
});
describe('pendingDashboardFichas', () => {
  it('keeps today and future work, excluding archived, completed and past fichas', () => {
    const rows = [ficha('future', '2026-10-25'), ficha('past', '2026-10-22'),
      ficha('today', '2026-10-23'), ficha('archived', '2026-10-24', { archived: true }),
      ficha('done', '2026-10-24', { status: 'complete' })];
    expect(pendingDashboardFichas(rows, new Date(2026, 9, 23, 23)).map(f => f.fichaId))
      .toEqual(['today', 'future']);
    expect(rows[0].fichaId).toBe('future');
  });
  it('keeps undated work visible after dated work and supports historical UTC dates', () => {
    const rows = [ficha('undated', null), ficha('today', '2026-10-23T00:00:00.000Z')];
    expect(pendingDashboardFichas(rows, new Date(2026, 9, 23, 18)).map(f => f.fichaId))
      .toEqual(['today', 'undated']);
  });
});
