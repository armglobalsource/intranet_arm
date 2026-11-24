import { describe, expect, it } from 'vitest';
import { AppliedCode, choosable, describeCode, initialQty, maxFor, missingAnswer, slots, totals } from './checkout';
import { PublicEvent, TicketType } from './event-types';

const general: TicketType = { id: 'g', name: 'General', price: 10000, currency: 'CLP', maxPerOrder: 4, remaining: 50, sale: 'on' };
const kids: TicketType = { id: 'k', name: 'Niños', price: 0, currency: 'CLP', maxPerOrder: 10, remaining: null, sale: 'on' };
const staff: TicketType = { id: 's', name: 'Equipo', price: 5000, currency: 'CLP', maxPerOrder: 10, sale: 'on' };
const event = { ticketTypes: [general, kids], details: { pricing: 'paid' } } as unknown as PublicEvent;
const money = (n: number) => `$${n.toLocaleString('es-CL')}`;

describe('Carrito de la inscripción', () => {
  it('suma las entradas visibles y las que desbloquea un código', () => {
    const code: AppliedCode = { code: 'EQUIPO', kind: 'percent', value: 0, ticketTypeIds: ['s'], unlockedTickets: [staff] };
    expect(choosable(event, null).map((t) => t.name)).toEqual(['General', 'Niños']);
    expect(choosable(event, code).map((t) => t.name)).toEqual(['General', 'Niños', 'Equipo']);
    expect(choosable({ ...event, ticketTypes: [], details: { pricing: 'free' } } as unknown as PublicEvent, null)[0].name).toBe('Entrada gratuita');
  });
  it('el máximo respeta la compra, los cupos de la entrada y los del evento', () => {
    expect(maxFor(general, null)).toBe(4);
    expect(maxFor({ ...general, remaining: 2 }, null)).toBe(2);
    expect(maxFor(general, 1)).toBe(1);
    expect(maxFor({ ...general, soldOut: true }, null)).toBe(0);
    expect(maxFor({ ...general, sale: 'soon' }, null)).toBe(0);
  });
  it('calcula el total con descuento como el servidor', () => {
    const qty = { g: 2, k: 1 };
    expect(slots([general, kids], qty).map((t) => t.name)).toEqual(['General', 'General', 'Niños']);
    expect(totals([general, kids], qty, null)).toMatchObject({ count: 3, subtotal: 20000, discount: 0, total: 20000 });
    const code: AppliedCode = { code: 'FAMILIA', kind: 'percent', value: 25, ticketTypeIds: ['g'], unlockedTickets: [] };
    expect(totals([general, kids], qty, code)).toMatchObject({ subtotal: 20000, discount: 5000, total: 15000 });
    expect(totals([general], { g: 1 }, { ...code, kind: 'amount', value: 20000, ticketTypeIds: [] }).total).toBe(0);
  });
  it('preselecciona una unidad cuando hay una sola entrada disponible', () => {
    expect(initialQty([general], null)).toEqual({ g: 1 });
    expect(initialQty([general, kids], null)).toEqual({});
    expect(initialQty([general, { ...kids, soldOut: true }], null)).toEqual({ g: 1 });
  });
  it('detecta respuestas obligatorias pendientes y describe el código', () => {
    const q = [{ id: 'talla', label: 'Talla', type: 'select' as const, options: ['M'], required: true }, { id: 'ok', label: 'Fotos', type: 'yesno' as const, required: true }];
    const a = { self: true, firstName: '', lastName: '', age: '', answers: { talla: 'M' } as Record<string, string | boolean> };
    expect(missingAnswer(q, a)?.label).toBe('Fotos');
    expect(missingAnswer(q, { ...a, answers: { talla: 'M', ok: true } })).toBeUndefined();
    expect(describeCode({ code: 'F', kind: 'percent', value: 25, ticketTypeIds: ['g'], unlockedTickets: [] }, [general], money)).toBe('25 % de descuento en General');
    expect(describeCode({ code: 'E', kind: 'percent', value: 0, ticketTypeIds: ['s'], unlockedTickets: [staff] }, [general], money)).toBe('desbloquea «Equipo»');
  });
});
