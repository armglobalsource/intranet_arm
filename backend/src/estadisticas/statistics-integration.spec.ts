import { describe, expect, it, vi } from 'vitest';
import { EstadisticasController } from './estadisticas.controller';
import { PostgresEstadisticasService } from './postgres-estadisticas.service';

const campuses = [
  { id: 1, name: 'Centro', country: 'Chile', isActive: true },
  { id: 2, name: 'Centro', country: 'Uruguay', isActive: true },
  { id: 3, name: 'Anterior', country: 'CL', isActive: false },
];
const row = (id: string, fecha: string, campusId: number | undefined, total: number, estado?: string) => ({ id, fecha, campusId, campus: 'Centro', tipo: 'encuentro', totalAsistencia: total, asistencia: { auditorio: total }, presencial: { acepto: 1 }, online: { acepto: 2 }, estado });
function service(rows: any[]) {
  const list = vi.fn(async (name: string) => name === 'encuentros' ? rows : []);
  return { list, api: new PostgresEstadisticasService({ list } as any, { findAll: async () => campuses } as any, { findAll: async () => [] } as any) };
}
const options = { year: 2026, from: '2026-01-01', to: '2026-01-07', groupBy: 'week' as const, type: 'all' as const, canViewAll: true };
describe('integrated statistics', () => {
  it('includes validated and legacy reports, excludes pending, compares previous dates, and never accumulates on reread', async () => {
    const { api, list } = service([row('prev', '2025-12-31', 1, 50, 'validado'), row('legacy', '2026-01-01', 1, 100), row('valid', '2026-01-07T00:00:00.000Z', 1, 60, 'validado'), row('pending', '2026-01-02', 1, 999, 'pendiente'), row('future', '2026-01-08', 1, 999)]);
    const result = await api.dashboard(options);
    expect(result.totals.asistencia).toBe(160);
    expect(result.totals.auditorio).toBe(160);
    expect(result.totals.manitosTotal).toBe(6);
    expect(result.comparison.totals.asistencia).toBe(50);
    expect(result.meta).toMatchObject({ excludedReports: 1, legacyReports: 1, days: 7 });
    expect(result.periods.reduce((n, p) => n + p.metrics.asistencia, 0)).toBe(160);
    expect((await api.dashboard(options)).totals).toEqual(result.totals);
    expect(list).toHaveBeenCalledWith('encuentros', { start: '2025-12-25', end: '2026-01-07T23:59:59.999Z' });
  });
  it('retains inactive campuses, filters by country and preserves all authorized filter options', async () => {
    const { api } = service([row('cl', '2026-01-01', 1, 40), row('uy', '2026-01-01', 2, 90), row('old', '2026-01-01', 3, 20)]);
    const result = await api.dashboard({ ...options, country: 'CL' });
    expect(result.totals.asistencia).toBe(60);
    expect(result.byCampus.find((c) => c.campusId === 3)?.isActive).toBe(false);
    expect(result.countries).toEqual(['Chile', 'Uruguay']);
    expect((await api.dashboard({ ...options, campusId: 1 })).campuses).toHaveLength(3);
  });
  it('does not resolve a different ID or an ambiguous legacy name into the authorized campus', async () => {
    const { api } = service([row('mine', '2026-01-01', 1, 40), row('other', '2026-01-01', 2, 90), row('ambiguous', '2026-01-01', undefined, 999), row('missing-id', '2026-01-01', 999, 999)]);
    const result = await api.dashboard({ ...options, campusId: 1, canViewAll: false });
    expect(result.totals.asistencia).toBe(40);
    expect(result.countries).toEqual(['Chile']);
    expect(result.campuses).toHaveLength(1);
    expect((await api.dashboard({ ...options, campusId: 1, canViewAll: false, country: 'Uruguay' })).records).toHaveLength(0);
    await expect(api.dashboard({ ...options, canViewAll: false })).rejects.toThrow();
  });
  it('handles cross-year weekly buckets only once', async () => {
    const { api } = service([row('first', '2025-12-31', 1, 10), row('last', '2026-01-01', 1, 20)]);
    const result = await api.dashboard({ ...options, from: '2025-12-29', to: '2026-01-04' });
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].metrics.asistencia).toBe(30);
    expect(result.periods[0]).toMatchObject({ start: '2025-12-29', end: '2026-01-04' });
  });
  it('validates campus parameters and does not trust a requested campus from limited users', async () => {
    const dashboard = vi.fn(async (options: any) => options);
    const controller = new EstadisticasController({ dashboard } as any);
    const user = { campusId: 1, permissions: ['estadisticas:view'] };
    await expect(controller.dashboard('2026', 'week', '2', 'all', user)).rejects.toThrow();
    await expect(controller.dashboard('2026', 'week', '0', 'all', { permissions: ['*'] })).rejects.toThrow();
    await expect(controller.dashboard('2026', 'week', undefined, 'all', { ...user, campusId: null })).rejects.toThrow();
    expect(dashboard).not.toHaveBeenCalled();
    await controller.dashboard('2026', 'week', undefined, 'all', user, '2026-01-01', '2026-01-07', 'Chile');
    expect(dashboard).toHaveBeenCalledWith(expect.objectContaining({ campusId: 1, canViewAll: false, country: 'Chile' }));
  });
});
