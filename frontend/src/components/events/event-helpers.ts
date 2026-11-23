// Ayudas del módulo de eventos: enlace automático, fechas de la portada,
// calendario, mapas y la lista de lo que falta para publicar.

import { eventPrice, type EventProgram, type PublicEvent, type TicketType } from './event-types';

/** Colores sugeridos para la portada, tomados de la paleta de armglobal.org. */
export const EVENT_COLORS = [
  { value: '#31302e', name: 'Carbón ARM' },
  { value: '#283033', name: 'Pizarra' },
  { value: '#2c5e4d', name: 'Verde bosque' },
  { value: '#96523f', name: 'Terracota' },
  { value: '#4b2920', name: 'Café' },
  { value: '#4f6067', name: 'Azul acero' },
] as const;

/** Zonas horarias de los campus ARM (el resto se puede escribir igual). */
export const EVENT_TIMEZONES = [
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Punta_Arenas', label: 'Chile (Punta Arenas)' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Caracas', label: 'Venezuela (Caracas)' },
  { value: 'America/Chicago', label: 'Estados Unidos (Texas)' },
  { value: 'America/New_York', label: 'Estados Unidos (Este)' },
] as const;

/** «Retiro de Hombres 2027» → «retiro-de-hombres-2027». */
export function slugify(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function parts(value: string, timeZone: string | undefined, options: Intl.DateTimeFormatOptions) {
  try { return new Intl.DateTimeFormat('es-CL', { ...options, timeZone }).format(new Date(value)); } catch { return ''; }
}

/** Día, mes y día de la semana para el bloque de fecha de la portada. */
export function eventDay(value: string, timeZone?: string) {
  if (!value) return null;
  return {
    day: parts(value, timeZone, { day: 'numeric' }),
    month: parts(value, timeZone, { month: 'short' }).replace('.', ''),
    weekday: parts(value, timeZone, { weekday: 'long' }),
    full: parts(value, timeZone, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

/** «10:00 – 18:00 hrs» el mismo día; si termina otro día, incluye la fecha de término. */
export function eventTimeRange(start: string, end: string, timeZone?: string) {
  if (!start) return '';
  const time = (v: string) => parts(v, timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (!end) return `${time(start)} hrs`;
  const sameDay = parts(start, timeZone, { dateStyle: 'short' }) === parts(end, timeZone, { dateStyle: 'short' });
  return sameDay ? `${time(start)} – ${time(end)} hrs` : `${time(start)} hrs · hasta el ${parts(end, timeZone, { day: 'numeric', month: 'long' })}, ${time(end)} hrs`;
}

export function mapsUrl(location: string, address: string) {
  const query = [location, address].filter((v) => v.trim()).join(', ');
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '';
}

/** Valor de la entrada tal cual: un solo valor, o el rango si hay entradas con valores distintos. */
export function ticketPriceLabel(tickets: TicketType[]) {
  const valid = tickets.filter((t) => Number.isFinite(t.price));
  if (!valid.length) return '';
  const distinct = Array.from(new Map(valid.map((t) => [`${t.currency}:${t.price}`, t])).values()).sort((a, b) => a.price - b.price);
  if (distinct.length === 1) return eventPrice(distinct[0]);
  const sameCurrency = distinct.every((t) => t.currency === distinct[0].currency);
  return sameCurrency ? `${eventPrice(distinct[0])} – ${eventPrice(distinct[distinct.length - 1])}` : distinct.map(eventPrice).join(' / ');
}

const icsDate = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);

/** Archivo .ics para «Agregar al calendario». */
export function eventIcs(e: Pick<PublicEvent, 'title' | 'slug' | 'startsAt' | 'endsAt' | 'details'>, url: string) {
  const end = e.endsAt || new Date(new Date(e.startsAt).getTime() + 2 * 3600_000).toISOString();
  const where = e.details.modality === 'online' ? 'Online' : [e.details.location, e.details.address].filter(Boolean).join(', ');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ARM Global//Eventos//ES', 'BEGIN:VEVENT',
    `UID:${e.slug}@armglobal.org`, `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(e.startsAt)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(e.title)}`, `DESCRIPTION:${icsText(`${e.details.summary}\n${url}`.trim())}`,
    ...(where ? [`LOCATION:${icsText(where)}`] : []), `URL:${url}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export type ReadinessItem = { key: string; label: string; step: number; done: boolean; required: boolean };

/** Lo que necesita un evento para publicarse con una portada completa. */
export function eventReadiness(e: EventProgram): ReadinessItem[] {
  const d = e.details;
  const datesOk = !!e.startsAt && !!e.endsAt && new Date(e.endsAt) >= new Date(e.startsAt);
  const items: ReadinessItem[] = [
    { key: 'title', label: 'Nombre y enlace del evento', step: 0, done: !!e.title.trim() && !!e.slug, required: true },
    { key: 'dates', label: 'Fecha de inicio y término', step: 0, done: datesOk, required: true },
    { key: 'place', label: d.modality === 'online' ? 'Modalidad online' : 'Lugar del evento', step: 0, done: d.modality === 'online' || !!d.location.trim(), required: true },
    { key: 'team', label: 'Campus y responsable', step: 0, done: !!e.campusId && !!e.organizerId, required: true },
    { key: 'category', label: 'Categoría', step: 0, done: !!e.categoryId, required: true },
    { key: 'summary', label: 'Invitación breve', step: 1, done: !!d.summary.trim(), required: true },
    { key: 'description', label: 'Descripción del evento', step: 1, done: !!d.description.trim(), required: true },
    { key: 'banner', label: 'Imagen de portada', step: 1, done: !!d.bannerUrl.trim(), required: false },
  ];
  if (d.pricing === 'paid') items.push({ key: 'tickets', label: 'Entradas con valor', step: 2, done: e.ticketTypes.length > 0 && e.ticketTypes.every((t) => t.name.trim() && t.price > 0), required: true });
  return items;
}
