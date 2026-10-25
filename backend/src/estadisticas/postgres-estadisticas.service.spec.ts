import { describe, expect, it } from 'vitest';
import { PostgresEstadisticasService as EstadisticasService } from './postgres-estadisticas.service';

function recordStoreWith(encuentros:any[],kiloamor:any[]){
 return {list:async(name:string)=>name==='encuentros'?encuentros:kiloamor};
}

describe('PostgresEstadisticasService', () => {
  it('agrega encuentros, categorías, campus e impacto social sin incluir finanzas', async () => {
    const fb = recordStoreWith([
      {
        id: 'e1',
        campusId: 1,
        campus: 'Santiago',
        fecha: '2026-01-05',
        tipo: 'encuentro',
        encuentro: 'Domingo 11:00',
        predicador: 'Ps. Uno',
        asistencia: { auditorio: 100, kids: 20 },
        voluntarios: { servicio: 10, worship: 5 },
        totalAsistencia: 120,
        totalVoluntarios: 15,
        presencial: { acepto: 8 },
        online: { acepto: 2, espectadores: 50 },
      },
      {
        id: 'e2',
        campusId: 2,
        campus: 'Concepción',
        fecha: '2026-02-10',
        tipo: 'evento',
        encuentro: 'Conferencia',
        predicador: '',
        asistencia: { auditorio: 80 },
        voluntarios: {},
        totalAsistencia: 80,
        totalVoluntarios: 0,
        presencial: { acepto: 3 },
        online: { acepto: 0, espectadores: 10 },
      },
    ], [
      { id: 'k1', campusId: 1, campus: 'Santiago', fecha: '2026-01-20', cajas: 12 },
    ]);
    const campuses = {
      findAll: async () => [
        { id: 1, name: 'Santiago', isActive: true },
        { id: 2, name: 'Concepción', isActive: true },
      ],
    };
    const catalogs = {
      findAll: async (type: string) => type === 'asistencia'
        ? [{ key: 'auditorio', label: 'Auditorio', sortOrder: 0 }, { key: 'kids', label: 'Kids', sortOrder: 1 }]
        : [{ key: 'servicio', label: 'Servicio', sortOrder: 0 }, { key: 'worship', label: 'Worship', sortOrder: 1 }],
    };
    const service = new EstadisticasService(fb as any, campuses as any, catalogs as any);

    const result = await service.dashboard({
      year: 2026,
      groupBy: 'month',
      type: 'all',
      canViewAll: true,
    });

    expect(result.totals).toMatchObject({
      encuentros: 1,
      eventos: 1,
      asistencia: 200,
      promedioAsistencia: 100,
      voluntarios: 15,
      manitosTotal: 13,
      espectadoresOnline: 60,
      kiloAmorCajas: 12,
    });
    expect(result.periods).toHaveLength(12);
    expect(result.periods[0].metrics.asistencia).toBe(120);
    expect(result.periods[1].metrics.asistencia).toBe(80);
    expect(result.byCampus).toHaveLength(2);
    expect(result.attendanceBreakdown).toEqual([
      { key: 'auditorio', label: 'Auditorio', value: 180 },
      { key: 'kids', label: 'Kids', value: 20 },
    ]);
    expect(result.volunteerBreakdown[0]).toEqual({
      key: 'servicio',
      label: 'Servicio',
      value: 10,
    });
    expect(result.records).toHaveLength(2);
    expect((result as any).siembra).toBeUndefined();
  });

  it('limita la agregación al campus solicitado y construye semanas completas', async () => {
    const fb = recordStoreWith([
      {
        campus: 'Santiago',
        fecha: '2026-07-01',
        tipo: 'encuentro',
        asistencia: { auditorio: 40 },
        voluntarios: { servicio: 5 },
        presencial: { acepto: 1 },
        online: { acepto: 0, espectadores: 4 },
      },
      {
        campus: 'Concepción',
        fecha: '2026-07-01',
        tipo: 'encuentro',
        asistencia: { auditorio: 90 },
        voluntarios: { servicio: 8 },
        presencial: { acepto: 2 },
        online: { acepto: 0, espectadores: 8 },
      },
    ], []);
    const campuses = {
      findAll: async () => [
        { id: 1, name: 'Santiago', isActive: true },
        { id: 2, name: 'Concepción', isActive: true },
      ],
    };
    const catalogs = { findAll: async () => [] };
    const service = new EstadisticasService(fb as any, campuses as any, catalogs as any);

    const result = await service.dashboard({
      year: 2026,
      groupBy: 'week',
      type: 'all',
      campusId: 1,
      canViewAll: false,
    });

    expect(result.campuses).toEqual([expect.objectContaining({ id: 1, name: 'Santiago' })]);
    expect(result.totals.asistencia).toBe(40);
    expect(result.records).toHaveLength(1);
    expect(result.periods.length).toBeGreaterThanOrEqual(52);
    expect(result.periods.some((period) => period.metrics.asistencia === 40)).toBe(true);
  });

  describe('reportes históricos de solo mes', () => {
    const campuses = { findAll: async () => [{ id: 7, name: 'Montevideo', country: 'Uruguay', isActive: true }, { id: 1, name: 'Santiago', isActive: true }] };
    const catalogs = { findAll: async () => [] };
    const monthOnly = (id: string, periodo: string, asistencia: number) => ({
      id, campusId: 7, campus: 'Montevideo', fecha: `${periodo}-01`, fechaPrecision: 'mes', periodo, tipo: 'encuentro',
      encuentro: 'Encuentro Jueves 20:00 hrs', asistencia: { auditorio: asistencia }, voluntarios: { servicio: 3 },
      totalAsistencia: asistencia, totalVoluntarios: 3, presencial: { acepto: 1 }, online: {}, estado: 'enviado',
    });
    const dated = { id: 'd1', campusId: 7, campus: 'Montevideo', fecha: '2021-09-09', tipo: 'encuentro', encuentro: 'Encuentro Jueves 20:00 hrs',
      asistencia: { auditorio: 10 }, voluntarios: {}, totalAsistencia: 10, totalVoluntarios: 0, presencial: {}, online: {}, estado: 'enviado' };
    const service = () => new EstadisticasService(recordStoreWith([monthOnly('m1', '2021-09', 40), monthOnly('m2', '2021-09', 25), dated], []) as any, campuses as any, catalogs as any);
    const wide = { year: 2021, type: 'all' as const, canViewAll: true, from: '2021-01-01', to: '2021-12-31' };

    it('suman en el mes, el total y el campus cuando el rango cubre el mes completo', async () => {
      const result = await service().dashboard({ ...wide, groupBy: 'month' });
      expect(result.totals.asistencia).toBe(75);
      expect(result.totals.encuentros).toBe(3);
      expect(result.periods.find((p) => p.key === '2021-09')!.metrics.asistencia).toBe(75);
      expect(result.byCampus.find((c) => c.campusId === 7)!.metrics.asistencia).toBe(75);
      expect(result.meta.monthOnly.reports).toBe(2);
      expect(result.meta.monthOnly.metrics.asistencia).toBe(65);
      expect(result.records.filter((r: any) => r.fechaPrecision === 'mes').map((r: any) => r.periodo)).toEqual(['2021-09', '2021-09']);
    });

    it('no alteran las semanas: quedan en el total pero fuera de todo período semanal', async () => {
      const result = await service().dashboard({ ...wide, groupBy: 'week' });
      expect(result.totals.asistencia).toBe(75);
      const inWeeks = result.periods.reduce((sum, p) => sum + p.metrics.asistencia, 0);
      expect(inWeeks).toBe(10);
      expect(result.meta.monthOnly.metrics.asistencia).toBe(65);
    });

    it('no entran si el rango no cubre el mes completo (ni como mes parcial ni en la comparación)', async () => {
      const partial = await service().dashboard({ year: 2021, type: 'all', canViewAll: true, groupBy: 'month', from: '2021-09-05', to: '2021-09-30' });
      expect(partial.totals.asistencia).toBe(10);
      expect(partial.meta.monthOnly.reports).toBe(0);
      const cut = await service().dashboard({ year: 2021, type: 'all', canViewAll: true, groupBy: 'month', from: '2021-09-01', to: '2021-09-29' });
      expect(cut.totals.asistencia).toBe(10);
      const previous = await service().dashboard({ year: 2021, type: 'all', canViewAll: true, groupBy: 'month', from: '2021-10-01', to: '2021-10-31' });
      expect(previous.comparison.totals.asistencia).toBe(75);
    });
  });

  describe('atribución al campus Virtual', () => {
    const campuses = { findAll: async () => [
      { id: 1, name: 'Santiago', country: 'Chile', isActive: true },
      { id: 2, name: 'Puente Alto', country: 'Chile', isActive: true },
      { id: 3, name: 'Virtual', isActive: true },
    ] };
    const catalogs = { findAll: async () => [] };
    const report = (campusId: number, campus: string, fecha: string, modalidad: string, espectadores: number, acepto = 0, extra: any = {}) => ({
      id: `${campus}-${fecha}-${modalidad}`, campusId, campus, fecha, tipo: 'encuentro', encuentro: 'Encuentro Domingo 11:00 hrs', modalidad,
      asistencia: { auditorio: 100 }, voluntarios: {}, totalAsistencia: 100, totalVoluntarios: 0, presencial: {}, online: { espectadores, acepto }, estado: 'enviado', ...extra,
    });
    const rows = [
      report(1, 'Santiago', '2026-03-01', 'Presencial+Online', 300, 4),
      report(2, 'Puente Alto', '2026-03-08', 'Presencial+Online', 80, 1),
      report(1, 'Santiago', '2026-03-08', 'Presencial', 40),
      report(3, 'Virtual', '2026-03-15', 'Online', 500, 6),
      report(1, 'Santiago', '2026-03-22', 'Presencial+Online', 0, 0),
      report(1, 'Santiago', '2026-03-29', 'Presencial+Online', 60, 0, { estado: 'pendiente' }),
    ];
    const service = () => new EstadisticasService(recordStoreWith(rows, []) as any, campuses as any, catalogs as any);
    const base = { year: 2026, type: 'all' as const, groupBy: 'month' as const };

    it('atribuye solo las transmisiones que dicen Online o Virtual y conserva el campus emisor', async () => {
      const result = await service().dashboard({ ...base, canViewAll: true });
      expect(result.virtual).toMatchObject({ campusId: 3, reports: 2, espectadoresOnline: 380, manitosOnline: 5 });
      expect(result.virtual!.emitters.map((e) => [e.campusName, e.espectadoresOnline])).toEqual([['Santiago', 300], ['Puente Alto', 80]]);
      expect(result.byCampus.find((c) => c.campusId === 1)!.metrics.espectadoresOnline).toBe(340);
    });

    it('no duplica el total global ni cambia la cifra propia del campus Virtual', async () => {
      const result = await service().dashboard({ ...base, canViewAll: true });
      expect(result.totals.espectadoresOnline).toBe(300 + 80 + 40 + 500);
      expect(result.byCampus.find((c) => c.campusId === 3)!.metrics.espectadoresOnline).toBe(500);
    });

    it('no incluye reportes pendientes y respeta el filtro de tipo', async () => {
      const result = await service().dashboard({ ...base, canViewAll: true, type: 'evento' });
      expect(result.virtual).toMatchObject({ reports: 0, espectadoresOnline: 0 });
    });

    it('solo se calcula cuando el usuario puede ver el campus Virtual', async () => {
      expect((await service().dashboard({ ...base, canViewAll: false, campusId: 1 })).virtual).toBeNull();
      expect((await service().dashboard({ ...base, canViewAll: true, campusId: 1 })).virtual).toBeNull();
      expect((await service().dashboard({ ...base, canViewAll: true, country: 'Chile' })).virtual).toBeNull();
      const own = await service().dashboard({ ...base, canViewAll: false, campusId: 3 });
      expect(own.virtual).toMatchObject({ espectadoresOnline: 380 });
      expect(own.totals.espectadoresOnline).toBe(500);
      expect(own.records.every((r: any) => r.campusId === 3)).toBe(true);
    });

    it('no atribuye nada si el catálogo no tiene un único campus Virtual', async () => {
      const none = new EstadisticasService(recordStoreWith(rows, []) as any, { findAll: async () => campuses.findAll().then((c) => c.filter((x) => x.id !== 3)) } as any, catalogs as any);
      expect((await none.dashboard({ ...base, canViewAll: true })).virtual).toBeNull();
    });
  });
});
