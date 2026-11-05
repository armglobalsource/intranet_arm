import { describe, expect, it } from 'vitest';
import { buildWeeklyReport, mondayOf } from './weekly-report';
import { fmt, renderWeeklyReportHtml } from './weekly-report.html';

const campuses = [
  { id: 1, name: 'Stgo Centro', country: 'CL', isActive: true, schedules: [
    { dia: 'Miércoles', hora: '06:00', fichaType: 'oracion' }, { dia: 'Miércoles', hora: '20:00' }, { dia: 'Domingo', hora: '11:00' },
  ] },
  { id: 2, name: 'Montevideo', country: 'Uruguay', isActive: true, schedules: [{ dia: 'Jueves', hora: '20:00' }] },
];
const now = { date: '2026-11-03', time: '10:00' };

const report = (over: any) => ({ tipo: 'encuentro', campusId: 1, campus: 'Stgo Centro', modalidad: 'Presencial', estado: 'subido', ...over });
const records = [
  // Semana del 26 oct al 1 nov
  report({ id: 'a', fecha: '2026-10-28', encuentro: 'Encuentro Miércoles 20:00 hrs', modalidad: 'Presencial+Online',
    asistencia: { auditorio: 213, kids: 40 }, voluntarios: { servicio: 66 }, presencial: { acepto: 9 }, online: { acepto: 3, espectadores: 354 } }),
  report({ id: 'b', fecha: '2026-10-28', encuentro: 'Encuentro Oración Miércoles 06:00 hrs', asistencia: { auditorio: 20 } }),
  report({ id: 'c', tipo: 'evento', fecha: '2026-10-31', encuentro: 'JVNS X TEENS 17:00 hrs', eventoNombre: 'JVNS X TEENS 17:00 hrs',
    asistencia: { auditorio: 67 }, voluntarios: { servicio: 24 } }),
  report({ id: 'd', fecha: '2026-11-01', encuentro: 'Encuentro Domingo 11:00 hrs', estado: 'enviado', asistencia: { auditorio: 265 }, voluntarios: { servicio: 100 }, presencial: { acepto: 24 } }),
  // Semana anterior
  report({ id: 'e', fecha: '2026-10-21', encuentro: 'Encuentro Miércoles 20:00 hrs', asistencia: { auditorio: 208 }, voluntarios: { servicio: 90 }, presencial: { acepto: 14 } }),
  report({ id: 'f', campusId: 2, campus: 'Montevideo', fecha: '2026-10-22', encuentro: 'Encuentro Jueves 20:00 hrs', asistencia: { auditorio: 35 }, voluntarios: { servicio: 41 }, presencial: { acepto: 3 } }),
];

describe('reporte semanal', () => {
  it('usa la semana de lunes a domingo', () => {
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
  });

  it('separa presencial y online, suma asistentes + voluntarios y deja fuera la oración', () => {
    const r = buildWeeklyReport(records, campuses, '2026-10-28', { incluirPorRevisar: false, now });
    const miercoles = r.dias.find((d) => d.fecha === '2026-10-28')!;
    const filas = miercoles.paises[0].filas;
    expect(filas.map((f) => [f.modalidad, f.tipo, f.totales])).toEqual([
      ['Presencial', 'Encuentro', { totalGral: 319, totalAudit: 213, paj: 9 }],
      ['On Line', 'Enc. Global', { totalGral: 354, totalAudit: null, paj: 3 }],
    ]);
    expect(miercoles.total).toEqual({ totalGral: 673, totalAudit: 213, paj: 12 });
  });

  it('marca los encuentros sin reporte y no suma los que esperan revisión', () => {
    const r = buildWeeklyReport(records, campuses, '2026-10-28', { incluirPorRevisar: false, now });
    const jueves = r.dias.find((d) => d.fecha === '2026-10-29')!;
    expect(jueves.paises[0]).toMatchObject({ pais: 'Uruguay', filas: [{ campus: 'Montevideo', hora: '20:00', estado: 'sin_reporte', totales: null }] });
    const domingo = r.dias.find((d) => d.fecha === '2026-11-01')!;
    expect(domingo.paises[0].filas[0]).toMatchObject({ estado: 'enviado', totales: null });
    expect(r.resumen).toEqual({ incluidos: 3, sinReporte: 1, porRevisar: 1, observados: 0 });
    // Con la opción, el reporte por revisar suma.
    const conRevision = buildWeeklyReport(records, campuses, '2026-10-28', { incluirPorRevisar: true, now });
    expect(conRevision.dias.find((d) => d.fecha === '2026-11-01')!.total).toEqual({ totalGral: 365, totalAudit: 265, paj: 24 });
  });

  it('compara cada campus con la semana anterior y suma los eventos en el total semanal', () => {
    const r = buildWeeklyReport(records, campuses, '2026-10-28', { incluirPorRevisar: false, now });
    const stgo = r.campus.find((c) => c.campus === 'Stgo Centro')!;
    expect(stgo.dias).toEqual(['Miércoles', 'Domingo']);
    expect(stgo.actual.porDia['Miércoles']).toEqual({ totalGral: 673, totalAudit: 213, paj: 12 });
    expect(stgo.actual.porDia['Domingo']).toBe('P/R');
    expect(stgo.actual.semana).toEqual({ totalGral: 764, totalAudit: 280, paj: 12 });
    expect(stgo.anterior.semana).toEqual({ totalGral: 298, totalAudit: 208, paj: 14 });
    expect(stgo.diferencia).toEqual({ totalGral: 466, totalAudit: 72, paj: -2 });
    expect(stgo.eventos).toEqual(['JVNS X TEENS']);
    const mvd = r.campus.find((c) => c.campus === 'Montevideo')!;
    expect(mvd.actual.porDia['Jueves']).toBe('S/R');
    expect(r.comparacion.diferencia).toEqual({ totalGral: 764 - 374, totalAudit: 280 - 243, paj: 12 - 17 });
  });

  it('genera el HTML con las tres tablas, escapa los textos y formatea miles', () => {
    const r = buildWeeklyReport([...records, report({ id: 'x', tipo: 'evento', fecha: '2026-10-30', encuentro: '<b>Evento</b>', eventoNombre: '<b>Evento</b>', asistencia: { auditorio: 1 } })],
      campuses, '2026-10-28', { incluirPorRevisar: false, now });
    const html = renderWeeklyReportHtml(r);
    expect(html).toContain('REPORTE SEMANAL');
    expect(html).toContain('RESUMEN SEMANA ANTERIOR VS LA ACTUAL');
    expect(html).toContain('Comparación semanal de todos los campus');
    expect(html).toContain('Sem. 26 Oct al 01 Nov');
    expect(html).toContain('&lt;b&gt;Evento&lt;/b&gt;');
    expect(html).not.toContain('<b>Evento</b>');
    expect(html).toContain('Datos incompletos');
    expect(fmt(2706)).toBe('2.706');
    expect(fmt(-1234567)).toBe('-1.234.567');
  });
});
