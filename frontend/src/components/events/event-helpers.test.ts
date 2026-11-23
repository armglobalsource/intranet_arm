import { describe, expect, it } from 'vitest';
import { eventDay, eventIcs, isPast, upcomingMoment, eventReadiness, eventTimeRange, mapsUrl, slugify, ticketPriceLabel } from './event-helpers';
import { newEvent } from './event-types';

describe('ayudas de eventos', () => {
  it('arma el enlace a partir del nombre', () => {
    expect(slugify('Retiro AR Hombres 2027: ¡Renovación!')).toBe('retiro-ar-hombres-2027-renovacion');
  });

  it('muestra fecha y horario en la zona del evento', () => {
    expect(eventDay('2027-01-10T12:00:00Z', 'America/Santiago')).toMatchObject({ day: '10', month: 'ene' });
    expect(eventTimeRange('2027-01-10T12:00:00Z', '2027-01-10T21:00:00Z', 'America/Santiago')).toBe('09:00 – 18:00 hrs');
    expect(eventTimeRange('2027-01-10T12:00:00Z', '2027-01-12T21:00:00Z', 'America/Santiago')).toContain('hasta el 12 de enero');
  });

  it('anuncia cuándo abren las inscripciones y detecta el cierre', () => {
    const now = Date.parse('2026-11-23T14:30:00Z');
    expect(upcomingMoment('2026-11-25T14:28:00Z', 'America/Santiago', now)).toBe('25 de noviembre, 11:28 hrs');
    expect(upcomingMoment('2026-11-20T14:28:00Z', 'America/Santiago', now)).toBe('');
    expect(upcomingMoment(null, 'America/Santiago', now)).toBe('');
    expect(isPast('2026-11-20T00:00:00Z', now)).toBe(true);
    expect(isPast('2026-12-01T14:28:00Z', now)).toBe(false);
    expect(isPast(null, now)).toBe(false);
  });

  it('prepara el calendario, el mapa y el valor desde', () => {
    const ics = eventIcs({ title: 'Retiro, hombres', slug: 'retiro', startsAt: '2027-01-10T12:00:00Z', endsAt: '2027-01-10T21:00:00Z', details: { ...newEvent(1, 1).details, location: 'Casa de retiro', address: 'Camino 1' } }, 'https://x/eventos/retiro');
    expect(ics).toContain('DTSTART:20270110T120000Z');
    expect(ics).toContain('SUMMARY:Retiro\\, hombres');
    expect(ics).toContain('LOCATION:Casa de retiro\\, Camino 1');
    expect(mapsUrl('Casa de retiro', '')).toBe('https://www.google.com/maps/search/?api=1&query=Casa%20de%20retiro');
    const clp = (price: number) => ({ name: 'Entrada', price, currency: 'CLP' });
    // Un solo valor se muestra tal cual, sin «Desde».
    expect(ticketPriceLabel([clp(100)])).toBe(new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(100));
    expect(ticketPriceLabel([clp(100), clp(100)])).not.toContain('–');
    expect(ticketPriceLabel([clp(20000), clp(15000)])).toMatch(/15.000 – .*20.000/);
    expect(ticketPriceLabel([])).toBe('');
  });

  it('indica qué falta para publicar', () => {
    const e = newEvent(1, 10);
    const pending = eventReadiness(e).filter((i) => i.required && !i.done).map((i) => i.key);
    expect(pending).toEqual(['title', 'dates', 'place', 'category', 'summary', 'description']);
    const online = eventReadiness({ ...e, details: { ...e.details, modality: 'online', pricing: 'paid' }, ticketTypes: [] });
    expect(online.find((i) => i.key === 'place')?.done).toBe(true);
    expect(online.find((i) => i.key === 'tickets')?.done).toBe(false);
  });
});
