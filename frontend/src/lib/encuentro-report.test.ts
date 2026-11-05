import { describe, expect, it } from 'vitest';
import { atypicalAttendance, groupByDate, validateReport, type ReportDraft } from './encuentro-report';

const draft = (extra: Partial<ReportDraft> = {}): ReportDraft => ({
  tipo: 'encuentro', isNew: true, fecha: '2026-11-01', today: '2026-11-02', nowTime: '12:00',
  encuentro: 'Encuentro Domingo 11:00 hrs', hora: '11:00', eventoNombre: '', eventoHora: '',
  modalidad: 'Presencial', fullReport: true, prayer: false, predicador: 'Pr. Rodrigo',
  aceptoPresencial: '2', aceptoOnline: '', espectadores: '',
  asistencia: { auditorio: '120' }, voluntarios: { servicio: '10' }, ...extra,
});

describe('validación del reporte', () => {
  it('acepta un reporte completo, también con ceros explícitos', () => {
    expect(validateReport(draft())).toEqual({});
    expect(validateReport(draft({ asistencia: { auditorio: '0' }, voluntarios: { servicio: '0' }, aceptoPresencial: '' }))).toEqual({});
  });

  it('pide los datos que necesita Estadísticas', () => {
    expect(Object.keys(validateReport(draft({ encuentro: '', predicador: ' ', asistencia: {}, voluntarios: {} }))).sort())
      .toEqual(['asistencia.auditorio', 'encuentro', 'predicador', 'voluntarios']);
    expect(validateReport(draft({ modalidad: 'Presencial+Online' })).espectadores).toBeDefined();
  });

  it('no pide auditorio ni voluntarios a un encuentro solo online', () => {
    expect(validateReport(draft({ modalidad: 'Online', asistencia: {}, voluntarios: {}, aceptoPresencial: '', espectadores: '300' }))).toEqual({});
  });

  it('no pide predicador en oración', () => {
    expect(validateReport(draft({ prayer: true, fullReport: false, predicador: '' }))).toEqual({});
  });

  it('rechaza fechas futuras y encuentros que aún no parten', () => {
    expect(validateReport(draft({ fecha: '2026-11-03' })).fecha).toMatch(/futura/);
    expect(validateReport(draft({ fecha: '2026-11-02', hora: '20:00' })).encuentro).toMatch(/20:00/);
    expect(validateReport(draft({ fecha: '2026-11-02', hora: '09:00' })).encuentro).toBeUndefined();
  });

  it('rechaza decimales, texto y decisiones mayores que los asistentes', () => {
    expect(validateReport(draft({ asistencia: { auditorio: '12.5', kids: 'x' } })))
      .toMatchObject({ 'asistencia.auditorio': expect.any(String), 'asistencia.kids': expect.any(String) });
    expect(validateReport(draft({ aceptoPresencial: '500' })).aceptoPresencial).toMatch(/120/);
  });

  it('al editar un reporte antiguo no exige lo que nunca tuvo, pero revisa lo escrito', () => {
    const old = draft({ isNew: false, predicador: '', asistencia: {}, voluntarios: {}, aceptoPresencial: '' });
    expect(validateReport(old)).toEqual({});
    expect(validateReport({ ...old, asistencia: { kids: '1.5' } })['asistencia.kids']).toBeDefined();
  });

  it('valida el nombre y la hora de un evento', () => {
    expect(Object.keys(validateReport(draft({ tipo: 'evento', encuentro: '', predicador: '', eventoNombre: '', eventoHora: '' }))).sort())
      .toEqual(['eventoHora', 'eventoNombre']);
  });
});

describe('asistencia atípica', () => {
  it('detecta un cero de más o de menos respecto de lo habitual', () => {
    expect(atypicalAttendance(1250, [120, 130, 125, 118])).toEqual({ tipico: 125 });
    expect(atypicalAttendance(12, [120, 130, 125])).toEqual({ tipico: 125 });
    expect(atypicalAttendance(140, [120, 130, 125])).toBeNull();
  });

  it('no opina con pocos datos', () => {
    expect(atypicalAttendance(1250, [120, 130])).toBeNull();
    expect(atypicalAttendance(0, [120, 130, 125])).toBeNull();
  });
});

it('agrupa por fecha conservando el orden', () => {
  expect(groupByDate([{ fecha: 'a', n: 1 }, { fecha: 'a', n: 2 }, { fecha: 'b', n: 3 }]).map((g) => [g.fecha, g.items.length]))
    .toEqual([['a', 2], ['b', 1]]);
});
