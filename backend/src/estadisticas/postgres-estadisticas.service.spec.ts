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

    expect(result.campuses).toEqual([{ id: 1, name: 'Santiago' }]);
    expect(result.totals.asistencia).toBe(40);
    expect(result.records).toHaveLength(1);
    expect(result.periods.length).toBeGreaterThanOrEqual(52);
    expect(result.periods.some((period) => period.metrics.asistencia === 40)).toBe(true);
  });
});
