// Carrito de la inscripción: cantidades por entrada, asistentes y total con descuento.
// Es una vista previa; el servidor recalcula todo al confirmar.
import { EventQuestion, PublicEvent, TicketType } from './event-types';

export type AppliedCode = { code: string; kind: 'percent' | 'amount'; value: number; ticketTypeIds: string[]; unlockedTickets: TicketType[] };
export type Attendee = { self: boolean; firstName: string; lastName: string; age: string; answers: Record<string, string | boolean> };
/** Sin tipos de entrada (evento gratuito simple) se usa una entrada implícita con esta clave. */
export const FREE_KEY = '_';

/** Entradas que puede elegir el público: las visibles más las que desbloqueó el código. */
export function choosable(event: PublicEvent, code: AppliedCode | null): TicketType[] {
  const unlocked = (code?.unlockedTickets ?? []).filter((t) => !event.ticketTypes.some((v) => v.id === t.id));
  const list = [...event.ticketTypes, ...unlocked];
  return list.length ? list : [{ id: FREE_KEY, name: event.details.pricing === 'paid' ? 'Entrada' : 'Entrada gratuita', price: 0, currency: 'CLP', maxPerOrder: 10, remaining: null, sale: 'on' }];
}

/** Máximo elegible de una entrada: el menor entre el máximo por compra, sus cupos y los del evento. */
export function maxFor(t: TicketType, eventLeft: number | null | undefined) {
  if (t.soldOut || (t.sale && t.sale !== 'on')) return 0;
  return Math.max(0, Math.min(t.maxPerOrder ?? 10, t.remaining ?? Infinity, eventLeft ?? Infinity, 10));
}

/** Una plaza por entrada elegida, en el orden de la lista. */
export function slots(tickets: TicketType[], qty: Record<string, number>) {
  return tickets.flatMap((t) => Array.from({ length: qty[t.id ?? ''] ?? 0 }, () => t));
}

export function codeCovers(code: AppliedCode | null, ticketId: string | undefined) {
  if (!code || !ticketId || ticketId === FREE_KEY) return !!code && !code.ticketTypeIds.length;
  return !code.ticketTypeIds.length || code.ticketTypeIds.includes(ticketId);
}

/** Igual que el servidor: descuento por entrada, redondeado al peso y nunca mayor que el precio. */
export function totals(tickets: TicketType[], qty: Record<string, number>, code: AppliedCode | null) {
  const lines = tickets.filter((t) => (qty[t.id ?? ''] ?? 0) > 0).map((t) => {
    const n = qty[t.id ?? ''];
    const each = codeCovers(code, t.id) && t.price > 0 ? Math.min(t.price, code!.kind === 'percent' ? Math.round((t.price * code!.value) / 100) : code!.value) : 0;
    return { ticket: t, n, subtotal: t.price * n, discount: each * n };
  });
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const discount = lines.reduce((s, l) => s + l.discount, 0);
  return { lines, count: lines.reduce((s, l) => s + l.n, 0), subtotal, discount, total: subtotal - discount };
}

/** Cantidades iniciales: si hay una sola entrada disponible, una unidad elegida. */
export function initialQty(tickets: TicketType[], eventLeft: number | null | undefined) {
  const open = tickets.filter((t) => maxFor(t, eventLeft) > 0);
  return open.length === 1 ? { [open[0].id ?? FREE_KEY]: 1 } : {};
}

/** Las respuestas obligatorias que faltan en una plaza (para avisar antes de enviar). */
export function missingAnswer(questions: EventQuestion[] | undefined, a: Attendee) {
  return (questions ?? []).find((q) => q.required && (q.type === 'yesno' ? a.answers[q.id] !== true : !String(a.answers[q.id] ?? '').trim()));
}

export function describeCode(code: AppliedCode, tickets: TicketType[], money: (n: number) => string) {
  const names = code.ticketTypeIds.map((id) => tickets.find((t) => t.id === id)?.name).filter(Boolean);
  const off = code.value === 0 ? '' : code.kind === 'percent' ? `${code.value} % de descuento` : `${money(code.value)} de descuento por entrada`;
  const unlocked = code.unlockedTickets.length ? `desbloquea ${code.unlockedTickets.map((t) => `«${t.name}»`).join(', ')}` : '';
  return [off && (names.length ? `${off} en ${names.join(', ')}` : off), unlocked].filter(Boolean).join(' y ') || 'Código aplicado';
}
