import { describe, expect, it } from 'vitest';
import { Attendee, clock, exportRows, filterAttendees, fileSlug, summarize, ticketCodeIn } from './attendance';

const base: Attendee = {
  id: '11111111-1111-4111-8111-111111111111', firstName: 'José', lastName: 'Muñoz', email: 'jose@example.com', phone: '+56 9 1234 5678', age: 30,
  campusId: 1, campusName: 'Santiago', ticketName: 'General', status: 'confirmed', amount: 5000, currency: 'CLP', source: 'public',
  createdAt: '2026-11-20T15:00:00Z', checkedInAt: null, checkedInBy: null,
};
const list: Attendee[] = [
  base,
  { ...base, id: '22222222-2222-4222-8222-222222222222', firstName: 'Ana', lastName: 'Soto', email: 'ana@example.com', checkedInAt: '2026-11-24T22:42:00Z', checkedInBy: 'Pablo E.', campusId: 2, campusName: 'Viña' },
  { ...base, id: '33333333-3333-4333-8333-333333333333', firstName: 'Luis', lastName: 'Rojas', email: 'luis@example.com', status: 'pending_payment', amount: 5000 },
  { ...base, id: '44444444-4444-4444-8444-444444444444', firstName: 'Marta', lastName: 'Díaz', email: 'marta@example.com', status: 'confirmed', amount: 0, source: 'manual', ticketName: 'Cortesía' },
  { ...base, id: '55555555-5555-4555-8555-555555555555', firstName: 'Test', lastName: 'Prueba', email: 'test@example.com', status: 'confirmed', amount: 5000, testPayment: true },
];
const none = { search: '', status: '', campus: '', presence: '' as const };

describe('Lista de inscritos', () => {
  it('busca sin importar tildes ni mayúsculas, por nombre, correo o código', () => {
    expect(filterAttendees(list, { ...none, search: 'jose munoz' }).map((a) => a.firstName)).toEqual(['José']);
    expect(filterAttendees(list, { ...none, search: 'ANA@' })).toHaveLength(1);
    expect(filterAttendees(list, { ...none, search: '33333333' })[0].firstName).toBe('Luis');
  });
  it('filtra por estado, campus y asistencia', () => {
    expect(filterAttendees(list, { ...none, presence: 'in' }).map((a) => a.firstName)).toEqual(['Ana']);
    expect(filterAttendees(list, { ...none, presence: 'out' }).map((a) => a.firstName)).toEqual(['José', 'Marta', 'Test']);
    expect(filterAttendees(list, { ...none, campus: '2' })).toHaveLength(1);
    expect(filterAttendees(list, { ...none, status: 'pending_payment' })).toHaveLength(1);
  });
  it('resume confirmados, ingresos, cortesías, cupos y recaudación real (sin pruebas)', () => {
    expect(summarize(list, 10)).toEqual({ confirmed: 4, checkedIn: 1, pending: 1, waitlisted: 0, courtesy: 1, revenue: 10000, capacityLeft: 5 });
    expect(summarize(list, null).capacityLeft).toBeNull();
  });
  it('exporta con encabezados en español y la hora en la zona del evento', () => {
    const rows = exportRows(list, 'America/Santiago');
    expect(rows[1]).toMatchObject({ Nombre: 'Ana', Ingresó: 'Sí', 'Hora de ingreso': expect.stringContaining('19:42'), 'Registrado por': 'Pablo E.' });
    expect(rows[3].Origen).toBe('Agregada por el equipo');
    expect(rows[2].Estado).toBe('Pago pendiente');
  });
});

describe('Control de ingreso', () => {
  it('encuentra el código de la entrada en lo que lee el escáner', () => {
    expect(ticketCodeIn('11111111-1111-4111-8111-111111111111')).toBe(base.id);
    expect(ticketCodeIn('https://x.cl/t/11111111-1111-4111-8111-111111111111?a=1')).toBe(base.id);
    expect(ticketCodeIn('11111111-1111-4111-8111-11111111111X'.toUpperCase())).toBeNull();
    expect(ticketCodeIn('hola')).toBeNull();
  });
  it('muestra la hora y arma nombres de archivo legibles', () => {
    expect(clock('2026-11-24T22:42:00Z', 'America/Santiago')).toBe('19:42');
    expect(fileSlug('Retiro de Hombres 2026: ¡Únete!')).toBe('retiro-de-hombres-2026-unete');
  });
});
