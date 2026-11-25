import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventLuggageService, bagCodeIn, newBagCode } from './event-luggage.service';

const EVENT = '257bc9ba-5f6b-426b-a944-df327e8e35d2';
const PABLO = { id: '11111111-1111-4111-8111-111111111111', participant: { firstName: 'Pablo', lastName: 'Encina' }, status: 'confirmed', ticket_code: 'aaaaaaaa-1111-4111-8111-111111111111', campus: 'Santiago' };
const TOMAS = { id: '22222222-2222-4222-8222-222222222222', participant: { firstName: 'Tomás', lastName: 'Soto' }, status: 'confirmed', ticket_code: 'bbbbbbbb-2222-4222-8222-222222222222', campus: 'Viña' };
const PEND = { id: '33333333-3333-4333-8333-333333333333', participant: { firstName: 'Ana', lastName: 'Ruiz' }, status: 'pending_payment', ticket_code: null, campus: 'Santiago' };

/** Base de datos en memoria con solo las consultas que usa el equipaje. */
function setup(eventStatus = 'published') {
  const regs = [PABLO, TOMAS, PEND];
  const bags: any[] = [];
  const row = (b: any) => { const r = regs.find((x) => x.id === b.registration_id)!; return { id: b.id, code: b.code, number: b.number, description: b.description, status: b.status, registrationId: b.registration_id, createdAt: 'now', deliveredAt: b.delivered_at ?? null, deliveredMethod: b.delivered_method ?? null, participant: r.participant, ticketStatus: r.status, ticketName: 'General', campusName: r.campus, total: bags.filter((x) => x.registration_id === b.registration_id && x.status !== 'void').length, createdBy: 'Puerta ARM', deliveredBy: b.delivered_at ? 'Mesa ARM' : null }; };
  const query = vi.fn(async (sql: string, p: any[] = []) => {
    if (sql.includes('count(*) FILTER (WHERE status=\'stored\')')) return { rows: [{ stored: bags.filter((b) => b.status === 'stored').length, delivered: bags.filter((b) => b.status === 'delivered').length, owners: new Set(bags.filter((b) => b.status !== 'void').map((b) => b.registration_id)).size }] };
    if (sql.includes('FOR UPDATE')) return { rows: regs.filter((r) => r.id === p[0]).map((r) => ({ id: r.id, status: r.status })) };
    if (sql.includes('AS active')) { const mine = bags.filter((b) => b.registration_id === p[0]); return { rows: [{ active: mine.filter((b) => b.status !== 'void').length, last: Math.max(0, ...mine.map((b) => b.number)) }] }; }
    if (sql.startsWith('INSERT INTO arm_app.event_luggage')) { const id = `bag-${bags.length + 1}`; bags.push({ id, event_id: p[0], registration_id: p[1], number: p[2], code: p[3], description: p[4], status: 'stored' }); return { rows: [{ id }] }; }
    if (sql.includes("SET status='void'")) { const b = bags.find((x) => x.id === p[0] && x.status === 'stored'); if (!b) return { rows: [] }; b.status = 'void'; return { rows: [{ registration_id: b.registration_id }] }; }
    if (sql.includes("SET status='delivered'")) { const b = bags.find((x) => x.id === p[0] && x.status === 'stored'); if (!b) return { rows: [] }; Object.assign(b, { status: 'delivered', delivered_at: 'now', delivered_method: p[3] }); return { rows: [{ id: b.id }] }; }
    if (sql.includes('r.ticket_code,r.snapshot')) return { rows: regs.filter((r) => r.id === p[1]).map((r) => ({ id: r.id, participant: r.participant, status: r.status, ticket_code: r.ticket_code, ticketName: 'General', campusName: r.campus })) };
    if (sql.includes('(ticket_code=$2 OR id=$2)')) return { rows: regs.filter((r) => r.ticket_code === p[1] || r.id === p[1]).map((r) => ({ participant: r.participant })) };
    if (sql.includes('b.code=$2')) return { rows: bags.filter((b) => b.code === p[1]).map(row) };
    if (sql.includes('b.registration_id=$2')) return { rows: bags.filter((b) => b.registration_id === p[1] && b.status !== 'void').sort((a, b) => a.number - b.number).map(row) };
    if (sql.includes('WHERE b.id=$1')) return { rows: bags.filter((b) => b.id === p[0]).map(row) };
    if (sql.includes('WHERE b.event_id=$1 ORDER BY')) return { rows: bags.map(row) };
    throw new Error(`consulta no prevista: ${sql.slice(0, 80)}`);
  });
  const db = { query, transaction: async (fn: any) => fn({ query }) };
  const attendance = { scope: vi.fn(async () => ({ event: { id: EVENT, title: 'Retiro', status: eventStatus, details: { color: '#2c5e4d' } }, manage: false })) };
  const user = { sub: 7, campusId: 10, permissions: ['eventos:checkin'] };
  return { service: new EventLuggageService(db as any, attendance as any), bags, user, attendance };
}

describe('equipaje', () => {
  it('códigos legibles y lectura de la etiqueta', () => {
    expect(newBagCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(bagCodeIn('ARMEQ-7K3Q9XHM')).toBe('7K3Q9XHM');
    expect(bagCodeIn(' 7k3q-9xhm ')).toBe('7K3Q9XHM');
    expect(bagCodeIn('aaaaaaaa-1111-4111-8111-111111111111')).toBeNull();
  });

  it('registra bolsos numerados de una entrada confirmada, con el mismo permiso de la puerta', async () => {
    const x = setup();
    const r = await x.service.add(x.user, EVENT, { registrationId: PABLO.id, count: 2, description: 'Maleta negra' });
    expect(x.attendance.scope).toHaveBeenCalledWith(x.user, EVENT, 'door');
    expect(r.owner).toMatchObject({ name: 'Pablo Encina', campusName: 'Santiago' });
    expect((r.owner as any).ticketCode).toBeUndefined();
    expect(r.bags.map((b: any) => [b.number, b.total, b.description])).toEqual([[1, 2, 'Maleta negra'], [2, 2, 'Maleta negra']]);
    // Más tarde llega otro bolso: sigue la numeración.
    const more = await x.service.add(x.user, EVENT, { registrationId: PABLO.id, count: 1 });
    expect(more.bags.map((b: any) => b.number)).toEqual([1, 2, 3]);
    expect(more.counts).toMatchObject({ stored: 3, owners: 1 });
  });

  it('no registra equipaje sin entrada confirmada, sobre el máximo ni en un evento cancelado', async () => {
    const x = setup();
    await expect(x.service.add(x.user, EVENT, { registrationId: PEND.id, count: 1 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(x.service.add(x.user, EVENT, { registrationId: '44444444-4444-4444-8444-444444444444', count: 1 })).rejects.toBeInstanceOf(NotFoundException);
    await x.service.add(x.user, EVENT, { registrationId: PABLO.id, count: 9 });
    await expect(x.service.add(x.user, EVENT, { registrationId: PABLO.id, count: 2 })).rejects.toThrow('ya tiene 9');
    await expect(setup('cancelled').service.add(x.user, EVENT, { registrationId: PABLO.id, count: 1 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('entrega solo con la entrada del dueño (o su carnet verificado)', async () => {
    const x = setup();
    const { bags } = await x.service.add(x.user, EVENT, { registrationId: PABLO.id, count: 2 });
    const [one, two] = bags as any[];
    expect((await x.service.lookup(x.user, EVENT, `ARMEQ-${one.code}`)).bag).toMatchObject({ ownerName: 'Pablo Encina', number: 1 });
    await expect(x.service.lookup(x.user, EVENT, PABLO.ticket_code)).rejects.toThrow('Eso es una entrada');

    const wrong = await x.service.deliver(x.user, EVENT, { bagCode: `ARMEQ-${one.code}`, ticketCode: TOMAS.ticket_code });
    expect(wrong).toMatchObject({ result: 'mismatch', message: 'Este bolso es de Pablo Encina, pero la entrada es de Tomás Soto.' });
    expect(x.bags[0].status).toBe('stored');

    const ok = await x.service.deliver(x.user, EVENT, { bagCode: `ARMEQ-${one.code}`, ticketCode: `https://x/${PABLO.ticket_code}` });
    expect(ok).toMatchObject({ result: 'ok', message: 'Entregado a Pablo Encina.', counts: { stored: 1, delivered: 1 } });
    expect(x.bags[0].delivered_method).toBe('ticket');
    expect((await x.service.deliver(x.user, EVENT, { bagCode: one.code, ticketCode: PABLO.ticket_code })).result).toBe('already');

    await expect(x.service.deliver(x.user, EVENT, { bagCode: two.code })).rejects.toBeInstanceOf(BadRequestException);
    expect((await x.service.deliver(x.user, EVENT, { bagCode: two.code, registrationId: TOMAS.id, idChecked: true })).result).toBe('mismatch');
    const byId = await x.service.deliver(x.user, EVENT, { bagCode: two.code, registrationId: PABLO.id, idChecked: true });
    expect(byId.result).toBe('ok');
    expect(x.bags[1].delivered_method).toBe('id_check');
    expect((await x.service.deliver(x.user, EVENT, { bagCode: 'ZZZZZZZZ', ticketCode: PABLO.ticket_code })).result).toBe('not_found');
  });

  it('una etiqueta anulada no sirve para retirar', async () => {
    const x = setup();
    const { bags } = await x.service.add(x.user, EVENT, { registrationId: PABLO.id, count: 2 });
    const after = await x.service.void(x.user, EVENT, (bags[0] as any).id);
    expect(after.bags.map((b: any) => [b.number, b.total])).toEqual([[2, 1]]);
    expect((await x.service.deliver(x.user, EVENT, { bagCode: (bags[0] as any).code, ticketCode: PABLO.ticket_code })).result).toBe('void');
    await expect(x.service.void(x.user, EVENT, (bags[0] as any).id)).rejects.toThrow('ya fue entregada o anulada');
  });
});
