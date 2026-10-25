import { describe, expect, it } from 'vitest';
import { doubtfulDates, nowInSantiago, pendingEncuentros } from './encuentros.pending';

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

  it('reads the current date and time in Chile', () => {
    expect(nowInSantiago(new Date('2026-10-25T15:30:00Z'))).toEqual({ date: '2026-10-25', time: '12:30' });
  });
});
