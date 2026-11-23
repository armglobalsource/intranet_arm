'use client';
/* eslint-disable @next/next/no-img-element */
// Portada pública del evento. La misma vista se usa como vista previa del editor:
// el diseño responde al ancho del contenedor, así la previa de teléfono es fiel.

import { CalendarDays, CalendarPlus, Clock, MapPin, Navigation, Share2, Ticket, Users, Globe2, Check } from 'lucide-react';
import { CSSProperties, useState } from 'react';
import { PublicEvent, eventPrice } from './event-types';
import { eventDay, eventIcs, eventTimeRange, mapsUrl, ticketPriceLabel } from './event-helpers';
import { eventDisplay } from './event-fonts';
import s from './events.module.css';
import l from './event-landing.module.css';
import { EventRegistrationForm } from './EventRegistration';

const MODALITY = { onsite: 'Presencial', online: 'Online', hybrid: 'Presencial y online' } as const;

function statusOf(e: PublicEvent) {
  if (e.registrationEnabled) return { text: 'Inscripciones abiertas', tone: 'open' };
  if (e.status === 'cancelled') return { text: 'Evento cancelado', tone: 'closed' };
  if (e.status === 'finished') return { text: 'Evento finalizado', tone: 'closed' };
  if (e.registrationStatus === 'closed') return { text: 'Inscripciones cerradas', tone: 'closed' };
  return { text: 'Inscripciones próximamente', tone: 'soon' };
}

export function EventLanding({ event: e, preview = false }: { event: PublicEvent; preview?: boolean }) {
  const d = e.details;
  // En la vista previa del editor la portada vive dentro del <main> de la intranet.
  const Main = preview ? 'div' : 'main';
  const status = statusOf(e);
  const day = eventDay(e.startsAt, d.timezone);
  const time = eventTimeRange(e.startsAt, e.endsAt, d.timezone);
  const map = d.modality !== 'online' ? mapsUrl(d.location, d.address) : '';
  const price = d.pricing === 'free' ? 'Gratis' : ticketPriceLabel(e.ticketTypes) || 'Valor por confirmar';
  const place = d.modality === 'online' ? 'Evento online' : d.location || 'Lugar por confirmar';
  const [shared, setShared] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/eventos/${e.slug}` : `/eventos/${e.slug}`;

  function addToCalendar() {
    if (!e.startsAt) return;
    const blob = new Blob([eventIcs(e, url)], { type: 'text/calendar;charset=utf-8' });
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${e.slug || 'evento'}.ics` });
    link.click();
    URL.revokeObjectURL(link.href);
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: e.title, text: d.summary, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2500); }
    } catch { /* el usuario canceló */ }
  }

  const cta = e.registrationEnabled && !preview
    ? <a href="#inscribirme" className={l.cta}><Ticket size={18} aria-hidden="true" />Inscribirme ahora</a>
    : <span className={`${l.statusPill} ${l[`tone_${status.tone}`]}`}>{status.text}</span>;

  return (
    <div className={`${s.public} ${l.page} ${eventDisplay.variable}`} style={{ '--event-color': d.color || '#173e32' } as CSSProperties}>
      <header className={l.hero}>
        {d.bannerUrl ? <img className={l.heroImage} src={d.bannerUrl} alt="" referrerPolicy="no-referrer" /> : <div className={l.heroPattern} aria-hidden="true" />}
        <nav className={l.topbar} aria-label="Identidad del evento">
          <img src="/logo_ficha.png" alt="ARM Global" />
          <span>Eventos</span>
        </nav>
        <div className={l.heroInner}>
          {day && (
            <div className={l.dateBlock} aria-hidden="true">
              <span>{day.month}</span><strong>{day.day}</strong>
            </div>
          )}
          <div className={l.heroText}>
            <div className={l.chips}>
              <span className={l.chip}>{e.categoryName || 'Evento ARM Global'}</span>
              <span className={l.chip}>{MODALITY[d.modality]}</span>
            </div>
            <h1>{e.title || 'El nombre de tu evento'}</h1>
            <p>{d.summary || 'Escribe una invitación breve: es lo primero que verán al abrir el enlace.'}</p>
            <div className={l.heroActions}>
              {cta}
              <button type="button" className={l.ghost} onClick={addToCalendar} disabled={!e.startsAt}><CalendarPlus size={17} aria-hidden="true" />Agregar al calendario</button>
            </div>
          </div>
        </div>
      </header>

      <section className={l.facts} aria-label="Datos del evento">
        <div><CalendarDays size={20} aria-hidden="true" /><span><b>Fecha</b>{day ? day.full : 'Por confirmar'}</span></div>
        <div><Clock size={20} aria-hidden="true" /><span><b>Horario</b>{time || 'Por confirmar'}</span></div>
        <div>{d.modality === 'online' ? <Globe2 size={20} aria-hidden="true" /> : <MapPin size={20} aria-hidden="true" />}<span><b>Lugar</b>{place}</span></div>
        <div><Ticket size={20} aria-hidden="true" /><span><b>Valor</b>{price}</span></div>
      </section>

      <Main className={l.main}>
        <div className={l.content}>
          {e.registrationEnabled && !preview && <EventRegistrationForm event={e} />}
          <section className={l.section}>
            <h2>Sobre el evento</h2>
            <p className={l.prose}>{d.description || 'Cuenta de qué se trata, para quién es y qué vivirán los participantes.'}</p>
          </section>

          <section className={l.section}>
            <h2>Detalles</h2>
            <ul className={l.details}>
              <li><CalendarDays size={19} aria-hidden="true" /><div><b>Cuándo</b>{day ? `${day.full} · ${time}` : 'Por confirmar'}<small>Hora de {d.timezone.replace(/_/g, ' ').split('/').pop()}</small></div></li>
              <li>{d.modality === 'online' ? <Globe2 size={19} aria-hidden="true" /> : <MapPin size={19} aria-hidden="true" />}<div><b>Dónde</b>{place}{d.address && d.modality !== 'online' && <small>{d.address}</small>}{map && <a href={map} target="_blank" rel="noreferrer" className={l.link}><Navigation size={14} aria-hidden="true" />Cómo llegar</a>}</div></li>
              <li><Users size={19} aria-hidden="true" /><div><b>Organiza</b>{e.campusName || 'Campus organizador'}{e.campuses.length > 0 && <span className={l.tags}>{e.campuses.map((c) => <span key={c}>{c}</span>)}</span>}</div></li>
              {(e.capacity || d.minimumAge != null) && <li><Check size={19} aria-hidden="true" /><div><b>Para participar</b>{[e.capacity ? `${e.capacity} cupos` : '', d.minimumAge != null ? `Desde ${d.minimumAge} años` : ''].filter(Boolean).join(' · ')}</div></li>}
            </ul>
          </section>

          {d.pricing === 'paid' && e.ticketTypes.length > 0 && (
            <section className={l.section}>
              <h2>Entradas</h2>
              <div className={l.tickets}>
                {e.ticketTypes.map((t, i) => <div key={t.id ?? i} className={l.ticket}><span>{t.name || 'Entrada'}</span><strong>{eventPrice(t)}</strong></div>)}
              </div>
            </section>
          )}

          {d.faqs.length > 0 && (
            <section className={l.section}>
              <h2>Preguntas frecuentes</h2>
              {d.faqs.map((f, i) => <details key={i} className={l.faq}><summary>{f.question || 'Pregunta'}</summary><p className={l.prose}>{f.answer}</p></details>)}
            </section>
          )}

          {(d.conditions || d.cancellationPolicy) && (
            <section className={l.section}>
              <h2>Condiciones</h2>
              {d.conditions && <details className={l.faq}><summary>Condiciones y requisitos</summary><p className={l.prose}>{d.conditions}</p></details>}
              {d.cancellationPolicy && <details className={l.faq}><summary>Política de cancelación</summary><p className={l.prose}>{d.cancellationPolicy}</p></details>}
            </section>
          )}
        </div>

        <aside className={l.booking} aria-label="Inscripción">
          <p className={l.bookingEyebrow}>Tu lugar en este evento</p>
          <strong className={l.bookingPrice}>{price}</strong>
          {e.capacity ? <p className={l.muted}>{e.capacity} cupos en total</p> : null}
          <div className={`${l.bookingStatus} ${l[`tone_${status.tone}`]}`}>{status.text}</div>
          {e.registrationEnabled && !preview && <a href="#inscribirme" className={l.cta}><Ticket size={18} aria-hidden="true" />Inscribirme ahora</a>}
          <p className={l.muted}>
            {e.registrationEnabled ? 'Completa tus datos para reservar tu cupo.'
              : e.status === 'cancelled' ? 'Este evento fue cancelado.'
              : e.status === 'finished' ? 'Gracias por ser parte de este evento.'
              : 'Aquí aparecerá la inscripción cuando esté abierta.'}
          </p>
          <div className={l.bookingActions}>
            <button type="button" onClick={addToCalendar} disabled={!e.startsAt}><CalendarPlus size={16} aria-hidden="true" />Calendario</button>
            <button type="button" onClick={share}><Share2 size={16} aria-hidden="true" />{shared ? 'Enlace copiado' : 'Compartir'}</button>
          </div>
          {preview && <p className={l.previewNote}>Vista previa · no realiza inscripciones ni pagos.</p>}
        </aside>
      </Main>

      <footer className={l.footer}>
        <img src="/logo_negro.png" alt="ARM Global" />
        <span>Un mismo propósito, muchos campus.</span>
      </footer>
    </div>
  );
}
