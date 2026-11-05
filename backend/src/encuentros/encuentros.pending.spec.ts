import { describe, expect, it } from 'vitest';
import { doubtfulDates, earliestReviewDate, existingReport, nowInSantiago, pendingEncuentros, pendingFromLastReport } from './encuentros.pending';

const santiago = {
  id: 1, name: 'Santiago',
  schedules: [
    { dia: 'Domingo', hora: '09:00' }, { dia: 'Domingo', hora: '11:00' },
    { dia: 'Miércoles', hora: '06:00', fichaType: 'oracion' }, { dia: 'Miércoles', hora: '20:00' },
  ],
};
const oriente = { id: 9, name: 'Oriente', isActive: false, schedules: [{ dia: 'Domingo', hora: '10:00' }] };

describe('pending encuentros', () => {
  it('lists scheduled encuentros without a report, newest first, with the history naming', () => {
    const pending = pendingEncuentros([santiago, oriente], [
      { campusId: 1, fecha: '2026-10-18', encuentro: 'Encuentro Domingo 09:00 hrs' },
      { campusId: 1, fecha: '2026-10-21', encuentro: 'Encuentro Miércoles 20:00 hrs' },
    ], '2026-10-18', '2026-10-21', { date: '2026-10-25', time: '12:00' });
    expect(pending.map((p) => [p.fecha, p.encuentro])).toEqual([
      ['2026-10-21', 'Encuentro Oración Miércoles 06:00 hrs'],
      ['2026-10-18', 'Encuentro Domingo 11:00 hrs'],
    ]);
  });

  it('matches reports by hour even if the name was written differently, and ignores events', () => {
    const pending = pendingEncuentros([santiago], [
      { campusId: 1, fecha: '2026-10-18', encuentro: 'Encuentro Dom 9:00' },
      { campusId: 1, fecha: '2026-10-18', encuentro: 'Fiestas 11:00 hrs', tipo: 'evento' },
    ], '2026-10-18', '2026-10-18', { date: '2026-10-25', time: '12:00' });
    expect(pending.map((p) => p.hora)).toEqual(['11:00']);
  });

  it('pairs a report written with a nearby hour (Jueves 19:30 reported as 20:00)', () => {
    const puntaArenas = { id: 4, name: 'Punta Arenas', schedules: [{ dia: 'Jueves', hora: '19:30' }] };
    expect(pendingEncuentros([puntaArenas], [{ campusId: 4, fecha: '2026-10-15', encuentro: 'Encuentro Jueves 20:00 hrs' }],
      '2026-10-15', '2026-10-15', { date: '2026-10-25', time: '12:00' })).toEqual([]);
  });

  it('flags records whose name says another weekday than their date', () => {
    expect(doubtfulDates([
      { campusId: 1, fecha: '2026-10-15', encuentro: 'Encuentro Domingo 09:00 hrs' },
      { campusId: 1, fecha: '2026-10-18', encuentro: 'Encuentro Domingo 11:00 hrs' },
      { campusId: 1, fecha: '2026-10-14', encuentro: 'Encuentro Oración Miércoles 06:00 hrs' },
    ], [santiago])).toEqual([
      { id: undefined, campusId: 1, campus: 'Santiago', fecha: '2026-10-15', encuentro: 'Encuentro Domingo 09:00 hrs', diaFecha: 'Jueves', diaNombre: 'Domingo' },
    ]);
  });

  it('does not ask for today encuentros until two hours after they start, nor for future days', () => {
    const pending = pendingEncuentros([santiago], [], '2026-10-25', '2026-10-27', { date: '2026-10-25', time: '11:30' });
    expect(pending.map((p) => p.hora)).toEqual(['09:00']);
  });

  describe('desde el último reporte de cada campus', () => {
    const now = { date: '2026-11-02', time: '12:00' };
    const domingos = { id: 1, name: 'Santiago', schedules: [{ dia: 'Domingo', hora: '09:00' }, { dia: 'Domingo', hora: '11:00' }] };
    const jueves = { id: 2, name: 'Puente Alto', schedules: [{ dia: 'Jueves', hora: '20:00' }] };

    it('lista todo lo que falta desde el último reporte, aunque sea anterior a dos semanas, del más antiguo al más nuevo', () => {
      const { pendientes, progreso } = pendingFromLastReport([domingos], [], new Map([['1', '2026-09-27']]), now);
      expect(pendientes[0]).toMatchObject({ fecha: '2026-10-04', hora: '09:00' });
      expect(pendientes[1]).toMatchObject({ fecha: '2026-10-04', hora: '11:00' });
      expect(pendientes.at(-1)).toMatchObject({ fecha: '2026-11-01', hora: '11:00' });
      expect(pendientes).toHaveLength(10);
      expect(progreso).toEqual([{ campusId: 1, campus: 'Santiago', ultimoReporte: '2026-09-27', pendientes: 10 }]);
    });

    it('sigue encontrando huecos anteriores al último reporte y ordena por campus', () => {
      const records = [
        { campusId: 1, fecha: '2026-11-01', encuentro: 'Encuentro Domingo 09:00 hrs' },
        { campusId: 1, fecha: '2026-11-01', encuentro: 'Encuentro Domingo 11:00 hrs' },
        { campusId: 1, fecha: '2026-10-25', encuentro: 'Encuentro Domingo 11:00 hrs' },
        { campusId: 2, fecha: '2026-10-22', encuentro: 'Encuentro Jueves 20:00 hrs' },
        { campusId: 2, fecha: '2026-10-29', encuentro: 'Encuentro Jueves 20:00 hrs' },
      ];
      const { pendientes, progreso } = pendingFromLastReport([domingos, jueves], records, new Map([['1', '2026-11-01'], ['2', '2026-10-29']]), now);
      expect(pendientes.map((p) => [p.campus, p.fecha, p.hora])).toEqual([
        ['Santiago', '2026-10-25', '09:00'],
      ]);
      expect(progreso.map((c) => c.campus)).toEqual(['Puente Alto', 'Santiago']);
    });

    it('sin reportes revisa solo los últimos días y con mucho atraso tiene un tope', () => {
      expect(pendingFromLastReport([jueves], [], new Map(), now).pendientes).toHaveLength(2);
      expect(earliestReviewDate([jueves], new Map([['2', '2020-01-01']]), now.date)).toBe('2026-07-06');
    });
  });

  describe('reporte ya registrado', () => {
    const records = [{ id: 'a', campusId: 1, tipo: 'encuentro', fecha: '2026-10-18', encuentro: 'Encuentro Domingo 11:00 hrs' }];

    it('lo encuentra por nombre aunque cambien tildes o mayúsculas', () => {
      expect(existingReport(santiago, records, '2026-10-18', 'encuentro  domingo 11:00 HRS')?.id).toBe('a');
      expect(existingReport(santiago, records, '2026-10-18', 'Encuentro Domingo 09:00 hrs')).toBeNull();
      expect(existingReport(santiago, records, '2026-10-25', 'Encuentro Domingo 11:00 hrs')).toBeNull();
    });

    it('reconoce el horario cubierto por un reporte escrito con otra hora', () => {
      const puntaArenas = { id: 4, name: 'Punta Arenas', schedules: [{ dia: 'Jueves', hora: '19:30' }] };
      const jueves = [{ id: 'j', campusId: 4, tipo: 'encuentro', fecha: '2026-10-15', encuentro: 'Encuentro Jueves 20:00 hrs' }];
      expect(existingReport(puntaArenas, jueves, '2026-10-15', 'Encuentro Jueves 19:30 hrs')?.id).toBe('j');
    });

    it('no confunde encuentros con eventos ni bloquea un encuentro especial con otro nombre', () => {
      const evento = [{ id: 'e', campusId: 1, tipo: 'evento', fecha: '2026-10-18', encuentro: 'Fiesta 11:00 hrs' }];
      expect(existingReport(santiago, evento, '2026-10-18', 'Encuentro Domingo 11:00 hrs')).toBeNull();
      expect(existingReport(santiago, evento, '2026-10-18', 'Fiesta 11:00 hrs', 'evento')?.id).toBe('e');
      expect(existingReport(santiago, records, '2026-10-18', 'Encuentro de Mujeres 16:00 hrs')).toBeNull();
    });
  });

  it('reads the current date and time in Chile', () => {
    expect(nowInSantiago(new Date('2026-10-25T15:30:00Z'))).toEqual({ date: '2026-10-25', time: '12:30' });
  });
});
