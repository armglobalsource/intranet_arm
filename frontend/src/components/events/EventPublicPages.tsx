'use client';
/* eslint-disable @next/next/no-img-element */
// Páginas públicas sin cuenta: el catálogo de próximos eventos y «Mis entradas» (enlace por correo).
import Link from 'next/link';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Loader2, Mail, MapPin, Search, Ticket } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { eventDay, eventTimeRange } from './event-helpers';
import { eventPrice } from './event-types';
import { fold } from './attendance';
import p from './event-public.module.css';

const base = () => api.defaults.baseURL;
const money = (n: number) => eventPrice({ name: '', price: n, currency: 'CLP' });
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export type CatalogEvent = {
  slug: string; title: string; startsAt: string; endsAt: string; timezone?: string; summary?: string; bannerUrl?: string; color?: string;
  modality?: string; location?: string; campusName: string; categoryName?: string | null; campuses: string[]; pricing?: 'free' | 'paid';
  minPrice: number | null; maxPrice: number | null; registrationEnabled: boolean; soldOut: boolean; capacityLeft: number | null;
};

export function priceLabel(e: Pick<CatalogEvent, 'pricing' | 'minPrice' | 'maxPrice'>) {
  if (e.pricing !== 'paid' || e.minPrice == null) return 'Gratis';
  return e.maxPrice != null && e.maxPrice !== e.minPrice ? `Desde ${money(e.minPrice)}` : money(e.minPrice);
}
export function statusLabel(e: Pick<CatalogEvent, 'registrationEnabled' | 'soldOut'>) {
  return e.soldOut ? { text: 'Cupos agotados', tone: 'closed' } : e.registrationEnabled ? { text: 'Inscripciones abiertas', tone: 'open' } : { text: 'Inscripciones próximamente', tone: 'soon' };
}

function PublicFrame({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <main className={p.page}>
      <header className={p.band}>
        <nav className={p.nav} aria-label="Eventos ARM Global">
          <Link href="/eventos" className={p.brand}><img src="/logo_ficha.png" alt="ARM Global" /></Link>
          <span className={p.links}><Link href="/eventos">Eventos</Link><Link href="/mis-entradas">Mis entradas</Link></span>
        </nav>
        <div className={p.hero}><p>{eyebrow}</p><h1>{title}</h1></div>
      </header>
      <div className={p.body}>{children}</div>
      <footer className={p.footer}>ARM Global · Un mismo propósito, muchas comunidades.</footer>
    </main>
  );
}

export function EventCatalog() {
  const query = useQuery({ queryKey: ['public-events'], queryFn: async () => (await axios.get<CatalogEvent[]>(`${base()}/public-events`)).data });
  const [search, setSearch] = useState('');
  const [campus, setCampus] = useState('');
  const [category, setCategory] = useState('');
  const list = useMemo(() => query.data ?? [], [query.data]);
  const campuses = useMemo(() => Array.from(new Set(list.flatMap((e) => [e.campusName, ...e.campuses]))).sort(), [list]);
  const categories = useMemo(() => Array.from(new Set(list.map((e) => e.categoryName).filter(Boolean) as string[])).sort(), [list]);
  const words = fold(search).split(/\s+/).filter(Boolean);
  const shown = list.filter((e) => (!campus || e.campusName === campus || e.campuses.includes(campus)) && (!category || e.categoryName === category)
    && words.every((w) => fold(`${e.title} ${e.summary ?? ''} ${e.location ?? ''} ${e.campusName} ${e.categoryName ?? ''}`).includes(w)));
  return (
    <PublicFrame eyebrow="ARM Global" title="Próximos eventos">
      <div className={p.filters}>
        <label className={p.search}><span className="sr-only">Buscar evento</span><Search size={18} aria-hidden="true" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar retiro, conferencia, campus…" /></label>
        <label><span className="sr-only">Campus</span><select value={campus} onChange={(e) => setCampus(e.target.value)}><option value="">Todos los campus</option>{campuses.map((c) => <option key={c}>{c}</option>)}</select></label>
        {categories.length > 0 && <label><span className="sr-only">Categoría</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas las categorías</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>}
      </div>
      {query.isPending && <p className={p.muted} role="status"><Loader2 size={16} className={p.spin} aria-hidden="true" />Cargando eventos…</p>}
      {query.isError && <p className={p.error} role="alert">{apiErrorMessage(query.error, 'No pudimos cargar los eventos.')} <button type="button" onClick={() => query.refetch()}>Reintentar</button></p>}
      {query.isSuccess && !shown.length && <div className={p.empty}><CalendarDays size={30} aria-hidden="true" /><h2>{list.length ? 'Nada coincide con tu búsqueda' : 'Pronto habrá nuevos eventos'}</h2><p>{list.length ? 'Prueba con otro campus o palabra.' : 'Vuelve a visitarnos en unos días.'}</p></div>}
      <div className={p.grid}>
        {shown.map((e) => {
          const day = eventDay(e.startsAt, e.timezone); const status = statusLabel(e);
          return (
            <Link key={e.slug} href={`/eventos/${e.slug}`} className={p.card} style={{ ['--event-color' as string]: e.color || '#31302e' }}>
              <div className={p.cover}>{e.bannerUrl && <img src={e.bannerUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}{day && <span className={p.date}><b>{day.day}</b>{day.month}</span>}</div>
              <div className={p.cardBody}>
                <span className={p.status} data-tone={status.tone}>{status.text}</span>
                <h2>{e.title}</h2>
                {day && <p><CalendarDays size={15} aria-hidden="true" />{cap(day.weekday)} · {eventTimeRange(e.startsAt, e.endsAt, e.timezone)}</p>}
                <p><MapPin size={15} aria-hidden="true" />{e.modality === 'online' ? 'Online' : e.location || e.campusName}</p>
                <div className={p.cardFoot}><span>{e.categoryName ?? e.campusName}</span><strong>{priceLabel(e)}</strong></div>
              </div>
            </Link>
          );
        })}
      </div>
    </PublicFrame>
  );
}

type MyOrder = { id: string; token: string; status: string; tickets: number; summary: string | null; amount: number; upcoming: boolean;
  event: { title: string; slug: string; startsAt: string; endsAt: string; timezone?: string; bannerUrl?: string; color?: string; location?: string } };
const ORDER_STATUS: Record<string, string> = { confirmed: 'Confirmada', pending_payment: 'Pago pendiente', waitlisted: 'Lista de espera', expired: 'Reserva vencida', payment_review: 'Pago en revisión', cancelled: 'Cancelada' };

export function MyTickets() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<{ email: string; orders: MyOrder[] } | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (!t) { setToken(''); return; }
    setToken(t);
    axios.post(`${base()}/my-tickets`, { token: t }).then((r) => setData(r.data)).catch((err) => setError(apiErrorMessage(err, 'El enlace no es válido. Pide uno nuevo.')));
  }, []);

  async function request(ev: FormEvent) {
    ev.preventDefault(); setBusy(true); setError(''); setSent('');
    try { const r = await axios.post(`${base()}/my-tickets/link`, { email }); setSent(r.data.message); }
    catch (err) { setError(apiErrorMessage(err, 'No pudimos enviar el enlace. Inténtalo de nuevo.')); }
    finally { setBusy(false); }
  }
  function restart() { window.history.replaceState(null, '', '/mis-entradas'); setToken(''); setData(null); setError(''); }

  const upcoming = data?.orders.filter((o) => o.upcoming) ?? [];
  const past = data?.orders.filter((o) => !o.upcoming) ?? [];
  const card = (o: MyOrder) => {
    const day = eventDay(o.event.startsAt, o.event.timezone);
    return (
      <article key={o.id} className={p.order} style={{ ['--event-color' as string]: o.event.color || '#31302e' }}>
        <div className={p.orderCover}>{o.event.bannerUrl && <img src={o.event.bannerUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}</div>
        <div className={p.orderBody}>
          <span className={p.status} data-tone={o.status === 'confirmed' ? 'open' : ['cancelled', 'expired'].includes(o.status) ? 'closed' : 'soon'}>{ORDER_STATUS[o.status] ?? o.status}</span>
          <h2>{o.event.title}</h2>
          {day && <p><CalendarDays size={15} aria-hidden="true" />{cap(day.full)} · {eventTimeRange(o.event.startsAt, o.event.endsAt, o.event.timezone)}</p>}
          {o.event.location && <p><MapPin size={15} aria-hidden="true" />{o.event.location}</p>}
          <p><Ticket size={15} aria-hidden="true" />{o.tickets === 1 ? '1 entrada' : `${o.tickets} entradas`}{o.summary ? ` · ${o.summary}` : ''}{o.amount > 0 ? ` · ${money(o.amount)}` : ''}</p>
        </div>
        <Link className={p.orderLink} href={`/eventos/${o.event.slug}/inscripcion#id=${o.id}&token=${o.token}`}>{o.status === 'confirmed' ? 'Ver entradas' : o.status === 'pending_payment' ? 'Completar pago' : 'Ver detalle'}</Link>
      </article>
    );
  };

  return (
    <PublicFrame eyebrow="Sin crear cuenta" title="Mis entradas">
      {token === null ? <p className={p.muted} role="status"><Loader2 size={16} className={p.spin} aria-hidden="true" />Cargando…</p>
        : token && !data && !error ? <p className={p.muted} role="status"><Loader2 size={16} className={p.spin} aria-hidden="true" />Buscando tus entradas…</p>
          : data ? <>
            <p className={p.muted}>Entradas compradas con <b>{data.email}</b>. <button type="button" className={p.link} onClick={restart}>Usar otro correo</button></p>
            {!data.orders.length && <div className={p.empty}><Ticket size={30} aria-hidden="true" /><h2>No encontramos inscripciones recientes</h2><p>Revisa si te inscribiste con otro correo.</p></div>}
            {upcoming.length > 0 && <section aria-label="Próximos eventos"><h2 className={p.section}>Próximos eventos</h2><div className={p.orders}>{upcoming.map(card)}</div></section>}
            {past.length > 0 && <section aria-label="Eventos anteriores"><h2 className={p.section}>Eventos anteriores</h2><div className={p.orders}>{past.map(card)}</div></section>}
          </>
            : (
              <form className={p.panel} onSubmit={request}>
                <Mail size={28} aria-hidden="true" />
                <h2>Recibe un enlace a tus entradas</h2>
                <p>Escribe el correo con que te inscribiste. Te enviaremos un enlace para ver todas tus entradas con su código QR, y transferirlas o cancelarlas si el evento lo permite.</p>
                {error && <p className={p.error} role="alert">{error}</p>}
                {sent ? <p className={p.ok} role="status">{sent}</p> : <>
                  <label className={p.field}><span>Correo electrónico</span><input type="email" required autoComplete="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" /></label>
                  <button className={p.cta} disabled={busy}>{busy ? 'Enviando…' : 'Enviarme el enlace'}</button>
                </>}
              </form>
            )}
      {error && token && <p className={p.muted}><button type="button" className={p.link} onClick={restart}>Pedir un enlace nuevo</button></p>}
    </PublicFrame>
  );
}
