'use client';
/* eslint-disable @next/next/no-img-element */
// Inscripción y entrada: un solo formulario en la portada y una página de seguimiento
// (pago con Mercado Pago y entrada) con la identidad del evento.
import { ChangeEvent, CSSProperties, FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, Check, CheckCircle2, Clock, CreditCard, Hourglass, Loader2, Lock, Printer, RefreshCw, ShieldCheck, Wallet, XCircle } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { eventPrice, PublicEvent } from './event-types';
import { eventDay, eventIcs, eventTimeRange, momentLabel } from './event-helpers';
import c from './event-checkout.module.css';

type Receipt = { id: string; token: string; status: string; participantName: string; title: string; startsAt: string; timezone: string; amount: number; currency: string; ticketName?: string | null; expiresAt: string | null; emailSent: boolean; testPayment: boolean; ticketCode: string | null };
type Returned = null | 'approved' | 'pending' | 'failed';

const post = async (path: string, body: unknown) => (await axios.post(`${api.defaults.baseURL}${path}`, body)).data;
const receiptKey = (slug: string) => `event-receipt:${slug}`;
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
const money = (amount: number, currency: string) => eventPrice({ name: 'Entrada', price: amount, currency });

// La pestaña guarda el acceso a la inscripción; localStorage cubre el regreso desde Mercado Pago en otra pestaña.
function remember(slug: string, r: { id: string; token: string }) {
  const value = JSON.stringify({ id: r.id, token: r.token });
  for (const store of [sessionStorage, localStorage]) { try { store.setItem(receiptKey(slug), value); } catch { /* almacenamiento bloqueado */ } }
}
function recall(slug: string): { id: string; token: string } | null {
  for (const store of [sessionStorage, localStorage]) {
    try { const v = JSON.parse(store.getItem(receiptKey(slug)) || 'null'); if (v?.id && v?.token) return v; } catch { /* sin acceso */ }
  }
  return null;
}

function Steps({ current, paid }: { current: number; paid: boolean }) {
  const items = paid ? ['Tus datos', 'Pago', 'Tu entrada'] : ['Tus datos', 'Tu entrada'];
  return (
    <ol className={c.steps} aria-label="Pasos para obtener tu entrada">
      {items.map((label, i) => (
        <li key={label} data-state={i < current ? 'done' : i === current ? 'current' : 'todo'} aria-current={i === current ? 'step' : undefined}>
          <span aria-hidden="true">{i < current ? <Check size={14} /> : i + 1}</span>{label}
        </li>
      ))}
    </ol>
  );
}

export function EventRegistrationForm({ event: e }: { event: PublicEvent }) {
  const paid = e.details.pricing === 'paid';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', age: '', consent: false,
    campusId: e.campusOptions?.length === 1 ? String(e.campusOptions[0].id) : '',
    ticketTypeId: paid && e.ticketTypes.length === 1 ? String(e.ticketTypes[0].id ?? '') : '',
  });
  const ticket = e.ticketTypes.find((t) => String(t.id) === form.ticketTypeId);
  const set = (key: keyof typeof form) => (ev: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: ev.target.value }));

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true); setError('');
    try {
      const requestStorageKey = `event-request:${e.slug}:${form.email.trim().toLowerCase()}`;
      let key = sessionStorage.getItem(requestStorageKey);
      if (!key) { key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, '0')).join(''); sessionStorage.setItem(requestStorageKey, key); }
      const r: Receipt = await post(`/public-events/${encodeURIComponent(e.slug)}/registrations`, { ...form, campusId: Number(form.campusId), age: form.age ? Number(form.age) : undefined, ticketTypeId: paid ? form.ticketTypeId : undefined, requestKey: key });
      remember(e.slug, r);
      window.location.assign(`/eventos/${encodeURIComponent(e.slug)}/inscripcion#id=${r.id}&token=${r.token}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'No pudimos registrar tu inscripción. Inténtalo nuevamente.'));
      setBusy(false);
    }
  }

  const input = (key: 'firstName' | 'lastName' | 'email' | 'phone', label: string, type: string, autoComplete: string, extra?: { wide?: boolean; hint?: string; placeholder?: string }) => (
    <label className={`${c.field} ${extra?.wide ? c.wide : ''}`}>
      <span>{label}</span>
      <input aria-label={label} type={type} autoComplete={autoComplete} required placeholder={extra?.placeholder} maxLength={key === 'email' ? 254 : key === 'phone' ? 25 : 80} value={form[key]} onChange={set(key)} />
      {extra?.hint && <small>{extra.hint}</small>}
    </label>
  );

  return (
    <section className={c.panel} id="inscribirme" aria-labelledby="inscribirme-title">
      <p className={c.eyebrow}>Inscripción</p>
      <h2 id="inscribirme-title" className={c.title}>Consigue tu entrada</h2>
      <p className={c.lead}>{paid ? 'Completa tus datos y paga en línea con Mercado Pago. Te toma un par de minutos.' : 'Completa tus datos y listo: tu entrada llega a tu correo.'}</p>
      <Steps current={0} paid={paid} />
      <form onSubmit={submit}>
        <fieldset disabled={busy} className={c.fieldset}>
          {paid && (
            <div className={c.group}>
              <h3>Elige tu entrada</h3>
              <div className={c.ticketChoices} role="radiogroup" aria-label="Entrada">
                {e.ticketTypes.map((t) => (
                  <label key={t.id} className={c.ticketChoice}>
                    <input type="radio" name="ticketTypeId" required value={t.id} checked={form.ticketTypeId === String(t.id)} onChange={() => setForm((f) => ({ ...f, ticketTypeId: String(t.id) }))} />
                    <span className={c.radio} aria-hidden="true"><Check size={13} /></span>
                    <span className={c.ticketChoiceName}>{t.name || 'Entrada'}</span>
                    <strong>{eventPrice(t)}</strong>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className={c.group}>
            <h3>Tus datos</h3>
            <div className={c.grid}>
              {input('firstName', 'Nombre', 'text', 'given-name')}
              {input('lastName', 'Apellido', 'text', 'family-name')}
              {input('email', 'Correo electrónico', 'email', 'email', { wide: true, hint: 'Aquí te enviaremos tu entrada.', placeholder: 'tu@correo.com' })}
              {input('phone', 'Teléfono / WhatsApp', 'tel', 'tel', { placeholder: '+56 9 1234 5678' })}
              <label className={c.field}>
                <span>Campus</span>
                <select aria-label="Campus" required value={form.campusId} onChange={set('campusId')}>
                  <option value="">Selecciona tu campus</option>
                  {e.campusOptions?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
              {e.details.minimumAge != null && (
                <label className={c.field}>
                  <span>Edad</span>
                  <input aria-label="Edad" type="number" inputMode="numeric" required min={e.details.minimumAge} max={120} value={form.age} onChange={set('age')} />
                  <small>Desde {e.details.minimumAge} años.</small>
                </label>
              )}
            </div>
          </div>

          {(e.details.conditions || e.details.cancellationPolicy) && (
            <details className={c.conditions}>
              <summary>Ver condiciones del evento</summary>
              {e.details.conditions && <p>{e.details.conditions}</p>}
              {e.details.cancellationPolicy && <p>{e.details.cancellationPolicy}</p>}
            </details>
          )}
          <label className={c.consent}>
            <input required type="checkbox" checked={form.consent} onChange={(ev) => setForm((f) => ({ ...f, consent: ev.target.checked }))} />
            <span>Acepto las condiciones del evento y el uso de mis datos para gestionar esta inscripción y recibir sus comunicaciones.</span>
          </label>

          <div className={c.summary}>
            <div className={c.total}><span>Total</span><strong>{paid ? (ticket ? eventPrice(ticket) : '—') : 'Gratis'}</strong></div>
            {paid && e.paymentMode === 'test' && <p className={c.notice}>Modo de prueba: no uses tarjetas reales.</p>}
            {error && <p className={c.error} role="alert">{error}</p>}
            <button className={c.cta} type="submit">
              {busy ? <><Loader2 size={18} className={c.spin} aria-hidden="true" />Reservando tu cupo…</>
                : paid ? <>Continuar al pago{ticket ? ` · ${eventPrice(ticket)}` : ''}</>
                : 'Confirmar mi inscripción'}
            </button>
            {paid
              ? <p className={c.fine}><Lock size={13} aria-hidden="true" />Tu cupo queda reservado y en el siguiente paso pagas de forma segura con Mercado Pago.</p>
              : <p className={c.fine}>Recibirás la confirmación en tu correo.</p>}
            {e.details.waitlist && <p className={c.fine}>Si se agotan los cupos, quedarás en lista de espera y no tendrás que pagar.</p>}
          </div>
        </fieldset>
      </form>
    </section>
  );
}

export function EventReceipt({ slug }: { slug: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [returned, setReturned] = useState<Returned>(null);
  const [polling, setPolling] = useState(false);
  const status = useRef('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setBusy(true); setError(''); }
    try {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const saved = hash.get('id') && hash.get('token') ? { id: hash.get('id')!, token: hash.get('token')! } : recall(slug);
      if (!saved) throw new Error('Abre el enlace de tu correo de confirmación o vuelve desde el navegador donde te inscribiste.');
      const r: Receipt = await post(`/event-registrations/${saved.id}/status`, { token: saved.token });
      remember(slug, r); status.current = r.status; setReceipt(r);
    } catch (err) {
      if (!quiet) setError(apiErrorMessage(err, err instanceof Error ? err.message : 'No pudimos consultar la inscripción.'));
    } finally { if (!quiet) setBusy(false); }
  }, [slug]);

  useEffect(() => {
    // Mercado Pago vuelve con ?collection_status=…; lo leemos y limpiamos la URL.
    const q = new URLSearchParams(window.location.search);
    const st = q.get('collection_status') || q.get('status');
    if (q.has('payment_id') || q.has('collection_id') || st) {
      setReturned(st === 'approved' ? 'approved' : st === 'rejected' || st === 'cancelled' || st === 'null' ? 'failed' : 'pending');
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
    void load();
    axios.get(`${api.defaults.baseURL}/public-events/${encodeURIComponent(slug)}`).then((r) => setEvent(r.data)).catch(() => { /* la página funciona sin la portada */ });
    const onVisible = () => { if (document.visibilityState === 'visible' && status.current === 'pending_payment') void load(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [slug, load]);

  // Al volver de Mercado Pago, el aviso del pago puede tardar unos segundos: consultamos por un minuto.
  useEffect(() => {
    if (!receipt || receipt.status !== 'pending_payment' || !returned || returned === 'failed') return;
    setPolling(true);
    let tries = 0;
    const timer = window.setInterval(async () => {
      tries += 1;
      await load(true);
      if (status.current !== 'pending_payment' || tries >= 15) { window.clearInterval(timer); setPolling(false); }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [returned, receipt?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function action(kind: 'checkout' | 'email') {
    if (!receipt) return;
    setBusy(true); setError('');
    try {
      const r = await post(`/event-registrations/${receipt.id}/${kind}`, { token: receipt.token });
      if (kind === 'checkout') { window.location.assign(r.url); return; }
      setReceipt(r);
    } catch (err) { setError(apiErrorMessage(err, 'No se pudo completar la acción. Puedes reintentar.')); }
    finally { setBusy(false); }
  }

  function addToCalendar() {
    if (!event?.startsAt) return;
    const blob = new Blob([eventIcs(event, `${window.location.origin}/eventos/${event.slug}`)], { type: 'text/calendar;charset=utf-8' });
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${event.slug || 'evento'}.ics` });
    link.click(); URL.revokeObjectURL(link.href);
  }

  const d = event?.details;
  const tz = d?.timezone || receipt?.timezone;
  const startsAt = event?.startsAt || receipt?.startsAt || '';
  const day = startsAt ? eventDay(startsAt, tz) : null;
  const time = startsAt ? eventTimeRange(startsAt, event?.endsAt || '', tz) : '';
  const place = d ? (d.modality === 'online' ? 'Evento online' : [d.location, d.address].filter(Boolean).join(', ')) : '';
  const paid = (receipt?.amount ?? 0) > 0;
  const price = receipt ? (paid ? money(receipt.amount, receipt.currency) : 'Gratis') : '';
  const firstName = receipt?.participantName.split(' ')[0] ?? '';
  const st = receipt?.status;
  const checking = st === 'pending_payment' && polling;

  const icon = (tone: 'ok' | 'wait' | 'bad', node: ReactNode) => <div className={c.statusIcon} data-tone={tone} aria-hidden="true">{node}</div>;

  let body: ReactNode = null;
  if (receipt) {
    if (st === 'confirmed') body = <>
      <Steps current={paid ? 2 : 1} paid={paid} />
      {icon('ok', <CheckCircle2 size={30} />)}
      <h1 className={c.title}>¡Tu entrada está lista!</h1>
      <p className={c.lead}>{firstName ? `${firstName}, ya` : 'Ya'} tienes tu lugar. {receipt.emailSent ? 'También te la enviamos por correo.' : 'Guarda esta página: es tu comprobante.'}</p>
      <article className={c.ticket} aria-label="Tu entrada">
        <div className={c.ticketHead}><span>Tu entrada</span><strong>{event?.title || receipt.title}</strong></div>
        <dl className={c.ticketInfo}>
          <div><dt>Participante</dt><dd>{receipt.participantName}</dd></div>
          <div><dt>Entrada</dt><dd>{receipt.ticketName || (paid ? 'Entrada general' : 'Entrada gratuita')} · {price}</dd></div>
          {day && <div><dt>Fecha</dt><dd>{cap(day.full)}</dd></div>}
          {time && <div><dt>Horario</dt><dd>{time}</dd></div>}
          {place && <div className={c.span2}><dt>Lugar</dt><dd>{place}</dd></div>}
        </dl>
        <div className={c.ticketCode}><small>Código de tu entrada</small><code>{receipt.ticketCode}</code><small>Presenta este código al equipo del evento.</small></div>
      </article>
      <div className={c.row}>
        <button type="button" className={c.secondary} onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Imprimir / Guardar PDF</button>
        {event?.startsAt && <button type="button" className={c.secondary} onClick={addToCalendar}><CalendarPlus size={16} aria-hidden="true" />Agregar al calendario</button>}
      </div>
    </>;
    else if (checking) body = <>
      <Steps current={1} paid />
      {icon('wait', <Loader2 size={30} className={c.spin} />)}
      <h1 className={c.title}>Estamos confirmando tu pago</h1>
      <p className={c.lead} role="status">Mercado Pago nos está avisando. Suele tardar unos segundos; no cierres esta página.</p>
    </>;
    else if (st === 'pending_payment') {
      const expires = momentLabel(receipt.expiresAt, receipt.timezone);
      body = <>
        <Steps current={1} paid />
        {returned === 'failed' && <p className={c.alert} role="alert">El pago no se completó y no se hizo ningún cargo. Puedes intentarlo de nuevo.</p>}
        {returned && returned !== 'failed' && <p className={c.alert} role="status">Si ya pagaste, la confirmación puede tardar unos minutos. Te enviaremos tu entrada por correo apenas Mercado Pago la apruebe; no vuelvas a pagar.</p>}
        <h1 className={c.title}>Último paso: paga tu entrada</h1>
        <p className={c.lead}>{firstName ? `Hola ${firstName}, tu` : 'Tu'} cupo está reservado. Completa el pago para confirmar tu entrada.</p>
        <div className={c.order}>
          <div className={c.orderLine}><div><strong>{receipt.ticketName || 'Entrada'}</strong><small>{receipt.participantName}{day ? ` · ${day.full}` : ''}</small></div><span>{price}</span></div>
          <div className={c.orderTotal}><span>Total a pagar</span><strong>{price}</strong></div>
        </div>
        {expires && <p className={c.reserve}><Clock size={16} aria-hidden="true" /><span>Tu cupo está reservado hasta el <b>{expires}</b>.</span></p>}
        {receipt.testPayment && <p className={c.notice}>Modo de prueba · No utilices tarjetas ni cuentas reales.</p>}
        <button type="button" disabled={busy} className={c.cta} onClick={() => action('checkout')}>
          {busy ? <><Loader2 size={18} className={c.spin} aria-hidden="true" />Abriendo Mercado Pago…</> : receipt.testPayment ? 'Pagar con Mercado Pago · Prueba' : 'Pagar con Mercado Pago'}
        </button>
        <ul className={c.methods} aria-label="Medios de pago">
          <li><CreditCard size={15} aria-hidden="true" />Débito y crédito</li>
          <li><Wallet size={15} aria-hidden="true" />Saldo Mercado Pago</li>
          <li><ShieldCheck size={15} aria-hidden="true" />Pago seguro</li>
        </ul>
        <p className={c.fine}>Te llevamos a Mercado Pago y, al terminar, vuelves aquí para ver tu entrada.</p>
        <button type="button" className={c.textButton} disabled={busy} onClick={() => load()}><RefreshCw size={14} aria-hidden="true" />Ya pagué: actualizar estado</button>
      </>;
    } else if (st === 'waitlisted') body = <>
      {icon('wait', <Hourglass size={28} />)}
      <h1 className={c.title}>Estás en lista de espera</h1>
      <p className={c.lead}>Los cupos están completos. Guardamos tu lugar en la lista: si se libera un cupo, el equipo organizador te contactará. No debes pagar por ahora.</p>
    </>;
    else if (st === 'payment_review') body = <>
      {icon('wait', <Hourglass size={28} />)}
      <h1 className={c.title}>Estamos revisando tu pago</h1>
      <p className={c.lead}>Recibimos un pago que el equipo debe revisar. No vuelvas a pagar: te escribiremos cuando tu entrada esté lista.</p>
    </>;
    else if (st === 'expired') body = <>
      {icon('bad', <Clock size={28} />)}
      <h1 className={c.title}>Tu reserva venció</h1>
      <p className={c.lead}>El tiempo para pagar terminó y el cupo se liberó. Si aún quieres participar, contacta al equipo organizador antes de intentar otro pago.</p>
    </>;
    else body = <>
      {icon('bad', <XCircle size={28} />)}
      <h1 className={c.title}>{st === 'cancelled' ? 'Inscripción cancelada' : 'Estado de tu inscripción'}</h1>
      <p className={c.lead}>{st === 'cancelled' ? 'Esta inscripción fue cancelada. Si crees que es un error, contacta al equipo organizador.' : 'Consulta con el equipo organizador.'}</p>
    </>;
  }

  return (
    <main className={c.page} style={{ '--event-color': d?.color || '#31302e' } as CSSProperties}>
      <header className={c.band}>
        {d?.bannerUrl && <img className={c.bandImage} src={d.bannerUrl} alt="" referrerPolicy="no-referrer" />}
        <div className={c.bandBar}>
          <Link href={`/eventos/${slug}`} className={c.back}><ArrowLeft size={16} aria-hidden="true" />Volver al evento</Link>
          <img src="/logo_ficha.png" alt="ARM Global" className={c.logo} />
        </div>
        <div className={c.bandTitle}>
          <p>Tu inscripción</p>
          <strong>{event?.title || receipt?.title || 'Evento ARM Global'}</strong>
          {(day || place) && <span>{[day ? cap(day.full) : '', time, d?.modality === 'online' ? 'Online' : d?.location].filter(Boolean).join(' · ')}</span>}
        </div>
      </header>
      <section className={c.card}>
        {error && <p role="alert" className={c.error}>{error}</p>}
        {body ?? (!error && <p role="status" className={c.loading}><Loader2 size={18} className={c.spin} aria-hidden="true" />Consultando tu inscripción…</p>)}
        {receipt && (
          <div className={c.mail}>
            {receipt.emailSent
              ? <p className={c.fine}>Enviamos el enlace de esta página a tu correo para que vuelvas cuando quieras.</p>
              : <><p className={c.fine}>Tu inscripción está guardada, pero no pudimos confirmar el envío del correo. Guarda el enlace de esta página.</p>
                <button type="button" disabled={busy} className={c.textButton} onClick={() => action('email')}>Reintentar envío de correo</button></>}
          </div>
        )}
      </section>
    </main>
  );
}
