'use client';
/* eslint-disable @next/next/no-img-element */
// Inscripción y entrada: un solo formulario en la portada y una página de seguimiento
// (pago con Mercado Pago y entrada) con la identidad del evento.
import { ChangeEvent, CSSProperties, FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, Check, CheckCircle2, Clock, CreditCard, Hourglass, Loader2, Lock, Minus, Plus, Printer, RefreshCw, ShieldCheck, Tag, Wallet, XCircle } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { eventPrice, PublicEvent, TicketType } from './event-types';
import { AppliedCode, Attendee, FREE_KEY, choosable, describeCode, initialQty, maxFor, missingAnswer, slots, totals } from './checkout';
import { eventDay, eventIcs, eventTimeRange, momentLabel } from './event-helpers';
import c from './event-checkout.module.css';

type ReceiptTicket = { id: string; name: string; ticketName: string; amount: number; status: string; code: string | null };
type Receipt = { id: string; token: string; status: string; buyerName: string; title: string; startsAt: string; timezone: string; subtotal: number; discount: number; amount: number; currency: string; code: string | null; summary: string | null; expiresAt: string | null; emailSent: boolean; testPayment: boolean; tickets: ReceiptTicket[] };
type Returned = null | 'approved' | 'pending' | 'failed';

/** QR de la entrada, generado en el navegador: el código no sale a ningún otro servicio. */
function TicketQr({ code }: { code: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    void import('qrcode').then((QR) => QR.toDataURL(code, { width: 440, margin: 1, errorCorrectionLevel: 'M' })).then((url) => { if (alive) setSrc(url); }).catch(() => undefined);
    return () => { alive = false; };
  }, [code]);
  return src ? <img className={c.qr} src={src} alt="Código QR de tu entrada" width={220} height={220} /> : <span className={c.qr} aria-hidden="true" />;
}

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
  const questions = e.details.questions ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState<AppliedCode | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeState, setCodeState] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' });
  const tickets = choosable(e, code);
  const [qty, setQty] = useState<Record<string, number>>(() => initialQty(choosable(e, null), e.capacityLeft));
  const [buyer, setBuyer] = useState({ firstName: '', lastName: '', email: '', phone: '', consent: false, campusId: e.campusOptions?.length === 1 ? String(e.campusOptions[0].id) : '' });
  const [people, setPeople] = useState<Attendee[]>([]);
  // La clave de la solicitud dura lo que el formulario: un reintento no duplica la compra.
  const requestKey = useRef('');
  const seats = slots(tickets, qty);
  const sum = totals(tickets, qty, code);
  const money = (n: number) => eventPrice({ name: '', price: n, currency: 'CLP' });
  const attendee = (i: number): Attendee => people[i] ?? { self: i === 0, firstName: '', lastName: '', age: '', answers: {} };
  const setAttendee = (i: number, patch: Partial<Attendee>) => setPeople((p) => { const next = [...p]; next[i] = { ...attendee(i), ...patch }; return next; });
  const setB = (key: 'firstName' | 'lastName' | 'email' | 'phone' | 'campusId') => (ev: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setBuyer((b) => ({ ...b, [key]: ev.target.value }));
  const step = (t: TicketType, d: 1 | -1) => setQty((q) => {
    const key = t.id ?? FREE_KEY; const n = Math.max(0, Math.min(maxFor(t, e.capacityLeft), (q[key] ?? 0) + d));
    const others = sum.count - (q[key] ?? 0);
    return others + n > 10 ? q : { ...q, [key]: n };
  });

  async function applyCode() {
    if (!codeInput.trim()) return;
    setCodeState({ busy: true, error: '' });
    try {
      const r: AppliedCode = await post(`/public-events/${encodeURIComponent(e.slug)}/code`, { code: codeInput.trim() });
      setCode(r); setCodeOpen(false); setCodeState({ busy: false, error: '' });
      if (r.unlockedTickets.length === 1 && !sum.count) setQty({ [r.unlockedTickets[0].id!]: 1 });
    } catch (err) {
      setCodeState({ busy: false, error: apiErrorMessage(err, 'No pudimos comprobar el código.') });
    }
  }
  function removeCode() {
    const hidden = new Set(code?.unlockedTickets.map((t) => t.id));
    setQty((q) => Object.fromEntries(Object.entries(q).filter(([k]) => !hidden.has(k))));
    setCode(null); setCodeInput('');
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setError('');
    if (!sum.count) { setError('Elige al menos una entrada.'); return; }
    const missing = seats.map((_, i) => missingAnswer(questions, attendee(i))).findIndex(Boolean);
    if (missing >= 0) { setError(`Falta responder «${missingAnswer(questions, attendee(missing))!.label}» en la entrada ${missing + 1}.`); return; }
    setBusy(true);
    try {
      if (!requestKey.current) requestKey.current = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, '0')).join('');
      const items = seats.map((t, i) => {
        const a = attendee(i); const self = i === 0 && a.self;
        return { ...(t.id && t.id !== FREE_KEY ? { ticketTypeId: t.id } : {}), firstName: self ? buyer.firstName : a.firstName, lastName: self ? buyer.lastName : a.lastName,
          ...(a.age ? { age: Number(a.age) } : {}), ...(questions.length ? { answers: a.answers } : {}) };
      });
      const r: Receipt = await post(`/public-events/${encodeURIComponent(e.slug)}/registrations`, {
        firstName: buyer.firstName, lastName: buyer.lastName, email: buyer.email, phone: buyer.phone, campusId: Number(buyer.campusId), consent: buyer.consent,
        requestKey: requestKey.current, items, ...(code ? { code: code.code } : {}),
      });
      remember(e.slug, r);
      window.location.assign(`/eventos/${encodeURIComponent(e.slug)}/inscripcion#id=${r.id}&token=${r.token}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'No pudimos registrar tu inscripción. Inténtalo nuevamente.'));
      setBusy(false);
    }
  }

  const buyerInput = (key: 'firstName' | 'lastName' | 'email' | 'phone', label: string, type: string, autoComplete: string, extra?: { wide?: boolean; hint?: string; placeholder?: string }) => (
    <label className={`${c.field} ${extra?.wide ? c.wide : ''}`}>
      <span>{label}</span>
      <input aria-label={label} type={type} autoComplete={autoComplete} required placeholder={extra?.placeholder} maxLength={key === 'email' ? 254 : key === 'phone' ? 25 : 80} value={buyer[key]} onChange={setB(key)} />
      {extra?.hint && <small>{extra.hint}</small>}
    </label>
  );
  const askPerson = seats.length > 1 || questions.length > 0 || e.details.minimumAge != null;
  const total = paid ? (sum.count ? (sum.total > 0 ? money(sum.total) : 'Sin costo') : '—') : 'Gratis';

  return (
    <section className={c.panel} id="inscribirme" aria-labelledby="inscribirme-title">
      <p className={c.eyebrow}>Inscripción</p>
      <h2 id="inscribirme-title" className={c.title}>Consigue tus entradas</h2>
      <p className={c.lead}>{paid ? 'Elige cuántas entradas quieres, completa los datos y paga en línea con Mercado Pago.' : 'Elige cuántas entradas quieres y completa los datos: las entradas llegan a tu correo.'}</p>
      <Steps current={0} paid={paid && sum.total > 0} />
      <form onSubmit={submit} noValidate={false}>
        <fieldset disabled={busy} className={c.fieldset}>
          <div className={c.group}>
            <h3>Elige tus entradas</h3>
            <div className={c.ticketChoices} role="group" aria-label="Entradas">
              {tickets.map((t) => {
                const key = t.id ?? FREE_KEY; const n = qty[key] ?? 0; const max = maxFor(t, e.capacityLeft);
                const note = t.soldOut ? 'Agotada' : t.sale === 'soon' ? `Disponible desde el ${momentLabel(t.salesStart, e.details.timezone)}` : t.sale === 'over' ? 'Venta terminada'
                  : t.remaining != null && t.remaining <= 10 ? `Quedan ${t.remaining}` : '';
                return (
                  <div key={key} className={c.qtyRow} data-off={max === 0 || undefined}>
                    <div className={c.qtyInfo}>
                      <span className={c.ticketChoiceName}>{t.name}</span>
                      {t.description && <small>{t.description}</small>}
                      {note && <small className={c.qtyNote}>{note}</small>}
                    </div>
                    <strong>{t.price > 0 ? eventPrice(t) : paid ? 'Sin costo' : 'Gratis'}</strong>
                    <div className={c.stepper}>
                      <button type="button" onClick={() => step(t, -1)} disabled={n === 0} aria-label={`Quitar una entrada ${t.name}`}><Minus size={16} /></button>
                      <output aria-live="polite" aria-label={`Cantidad de ${t.name}`}>{n}</output>
                      <button type="button" onClick={() => step(t, 1)} disabled={n >= max || sum.count >= 10} aria-label={`Agregar una entrada ${t.name}`}><Plus size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            {e.codesEnabled && (
              code
                ? <p className={c.codeApplied}><Tag size={15} aria-hidden="true" /><span><b>{code.code}</b> · {describeCode(code, tickets, money)}</span><button type="button" className={c.textButton} onClick={removeCode}>Quitar</button></p>
                : codeOpen
                  ? <div className={c.codeRow}>
                    <input aria-label="Código" value={codeInput} maxLength={30} autoCapitalize="characters" placeholder="Escribe tu código" onChange={(ev) => setCodeInput(ev.target.value)} onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); void applyCode(); } }} />
                    <button type="button" className={c.secondary} disabled={codeState.busy} onClick={() => void applyCode()}>{codeState.busy ? 'Revisando…' : 'Aplicar'}</button>
                    {codeState.error && <p className={c.error} role="alert">{codeState.error}</p>}
                  </div>
                  : <button type="button" className={c.textButton} onClick={() => setCodeOpen(true)}><Tag size={14} aria-hidden="true" />¿Tienes un código?</button>
            )}
          </div>

          <div className={c.group}>
            <h3>Tus datos</h3>
            <div className={c.grid}>
              {buyerInput('firstName', 'Nombre', 'text', 'given-name')}
              {buyerInput('lastName', 'Apellido', 'text', 'family-name')}
              {buyerInput('email', 'Correo electrónico', 'email', 'email', { wide: true, hint: seats.length > 1 ? 'Aquí te enviaremos todas las entradas.' : 'Aquí te enviaremos tu entrada.', placeholder: 'tu@correo.com' })}
              {buyerInput('phone', 'Teléfono / WhatsApp', 'tel', 'tel', { placeholder: '+56 9 1234 5678' })}
              <label className={c.field}>
                <span>Campus</span>
                <select aria-label="Campus" required value={buyer.campusId} onChange={setB('campusId')}>
                  <option value="">Selecciona tu campus</option>
                  {e.campusOptions?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          {askPerson && seats.map((t, i) => {
            const a = attendee(i); const self = i === 0 && a.self;
            return (
              <div className={c.person} key={i} role="group" aria-label={`Entrada ${i + 1}`}>
                <h3>Entrada {i + 1}<span> · {t.name}</span></h3>
                {i === 0 && <label className={c.consent}><input type="checkbox" checked={a.self} onChange={(ev) => setAttendee(0, { self: ev.target.checked })} /><span>Esta entrada es para mí</span></label>}
                <div className={c.grid}>
                  {!self && <>
                    <label className={c.field}><span>Nombre</span><input aria-label={`Nombre (entrada ${i + 1})`} required maxLength={80} value={a.firstName} onChange={(ev) => setAttendee(i, { firstName: ev.target.value })} /></label>
                    <label className={c.field}><span>Apellido</span><input aria-label={`Apellido (entrada ${i + 1})`} required maxLength={80} value={a.lastName} onChange={(ev) => setAttendee(i, { lastName: ev.target.value })} /></label>
                  </>}
                  {e.details.minimumAge != null && (
                    <label className={c.field}><span>Edad</span>
                      <input aria-label={`Edad (entrada ${i + 1})`} type="number" inputMode="numeric" required min={e.details.minimumAge} max={120} value={a.age} onChange={(ev) => setAttendee(i, { age: ev.target.value })} />
                      <small>Desde {e.details.minimumAge} años.</small></label>
                  )}
                  {questions.map((q) => q.type === 'yesno'
                    ? <label key={q.id} className={`${c.consent} ${c.wide}`}><input type="checkbox" required={q.required} checked={a.answers[q.id] === true} onChange={(ev) => setAttendee(i, { answers: { ...a.answers, [q.id]: ev.target.checked } })} /><span>{q.label}</span></label>
                    : <label key={q.id} className={`${c.field} ${c.wide}`}><span>{q.label}{!q.required && <small> · Opcional</small>}</span>
                      {q.type === 'select'
                        ? <select aria-label={`${q.label} (entrada ${i + 1})`} required={q.required} value={String(a.answers[q.id] ?? '')} onChange={(ev) => setAttendee(i, { answers: { ...a.answers, [q.id]: ev.target.value } })}><option value="">Elige una opción</option>{(q.options ?? []).map((o) => <option key={o}>{o}</option>)}</select>
                        : <input aria-label={`${q.label} (entrada ${i + 1})`} required={q.required} maxLength={500} value={String(a.answers[q.id] ?? '')} onChange={(ev) => setAttendee(i, { answers: { ...a.answers, [q.id]: ev.target.value } })} />}
                    </label>)}
                </div>
              </div>
            );
          })}

          {(e.details.conditions || e.details.cancellationPolicy) && (
            <details className={c.conditions}>
              <summary>Ver condiciones del evento</summary>
              {e.details.conditions && <p>{e.details.conditions}</p>}
              {e.details.cancellationPolicy && <p>{e.details.cancellationPolicy}</p>}
            </details>
          )}
          <label className={c.consent}>
            <input required type="checkbox" checked={buyer.consent} onChange={(ev) => setBuyer((b) => ({ ...b, consent: ev.target.checked }))} />
            <span>Acepto las condiciones del evento y el uso de los datos para gestionar esta inscripción y recibir sus comunicaciones.</span>
          </label>

          <div className={c.summary}>
            {sum.lines.length > 0 && (
              <dl className={c.lines} aria-label="Resumen de la compra">
                {sum.lines.map((l) => <div key={l.ticket.id ?? FREE_KEY}><dt>{l.n} × {l.ticket.name}</dt><dd>{paid ? (l.subtotal > 0 ? money(l.subtotal) : 'Sin costo') : 'Gratis'}</dd></div>)}
                {sum.discount > 0 && <div className={c.discountLine}><dt>Descuento {code?.code}</dt><dd>−{money(sum.discount)}</dd></div>}
              </dl>
            )}
            <div className={c.total}><span>Total</span><strong>{total}</strong></div>
            {paid && sum.total > 0 && e.paymentMode === 'test' && <p className={c.notice}>Modo de prueba: no uses tarjetas reales.</p>}
            {error && <p className={c.error} role="alert">{error}</p>}
            <button className={c.cta} type="submit" disabled={!sum.count}>
              {busy ? <><Loader2 size={18} className={c.spin} aria-hidden="true" />Reservando tus cupos…</>
                : paid && sum.total > 0 ? <>Continuar al pago · {money(sum.total)}</>
                  : sum.count > 1 ? `Confirmar ${sum.count} entradas` : 'Confirmar mi inscripción'}
            </button>
            {paid && sum.total > 0
              ? <p className={c.fine}><Lock size={13} aria-hidden="true" />Tus cupos quedan reservados y en el siguiente paso pagas de forma segura con Mercado Pago.</p>
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
  const firstName = receipt?.buyerName.split(' ')[0] ?? '';
  const ready = receipt?.tickets.filter((t) => t.code) ?? [];
  const many = (receipt?.tickets.length ?? 0) > 1;
  const st = receipt?.status;
  const checking = st === 'pending_payment' && polling;

  const icon = (tone: 'ok' | 'wait' | 'bad', node: ReactNode) => <div className={c.statusIcon} data-tone={tone} aria-hidden="true">{node}</div>;

  let body: ReactNode = null;
  if (receipt) {
    if (st === 'confirmed') body = <>
      <Steps current={paid ? 2 : 1} paid={paid} />
      {icon('ok', <CheckCircle2 size={30} />)}
      <h1 className={c.title}>{many ? '¡Tus entradas están listas!' : '¡Tu entrada está lista!'}</h1>
      <p className={c.lead}>{firstName ? `${firstName}, ya` : 'Ya'} {many ? `tienen sus ${ready.length} lugares` : 'tienes tu lugar'}. {receipt.emailSent ? (many ? 'También te las enviamos por correo.' : 'También te la enviamos por correo.') : 'Guarda esta página: es tu comprobante.'}</p>
      {ready.map((t, i) => (
        <article key={t.id} className={c.ticket} aria-label={many ? `Entrada de ${t.name}` : 'Tu entrada'}>
          <div className={c.ticketHead}><span>{many ? `Entrada ${i + 1} de ${ready.length}` : 'Tu entrada'}</span><strong>{event?.title || receipt.title}</strong></div>
          <dl className={c.ticketInfo}>
            <div><dt>Participante</dt><dd>{t.name}</dd></div>
            <div><dt>Entrada</dt><dd>{t.ticketName}{t.amount > 0 ? ` · ${money(t.amount, receipt.currency)}` : ''}</dd></div>
            {day && <div><dt>Fecha</dt><dd>{cap(day.full)}</dd></div>}
            {time && <div><dt>Horario</dt><dd>{time}</dd></div>}
            {place && <div className={c.span2}><dt>Lugar</dt><dd>{place}</dd></div>}
          </dl>
          <div className={c.ticketCode}><TicketQr code={t.code!} /><small>Código de la entrada</small><code>{t.code}</code><small>Muestra este código QR en la entrada del evento.</small></div>
        </article>
      ))}
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
        <h1 className={c.title}>{many ? 'Último paso: paga tus entradas' : 'Último paso: paga tu entrada'}</h1>
        <p className={c.lead}>{firstName ? `Hola ${firstName}, ` : ''}{many ? 'tus cupos están reservados. Completa el pago para confirmar las entradas.' : 'tu cupo está reservado. Completa el pago para confirmar tu entrada.'}</p>
        <div className={c.order}>
          {receipt.tickets.map((t) => <div key={t.id} className={c.orderLine}><div><strong>{t.ticketName}</strong><small>{t.name}{day ? ` · ${day.full}` : ''}</small></div><span>{t.amount > 0 ? money(t.amount, receipt.currency) : 'Sin costo'}</span></div>)}
          {receipt.discount > 0 && <p className={c.discountNote}><Tag size={14} aria-hidden="true" />Incluye {money(receipt.discount, receipt.currency)} de descuento con el código {receipt.code}.</p>}
          <div className={c.orderTotal}><span>Total a pagar</span><strong>{price}</strong></div>
        </div>
        {expires && <p className={c.reserve}><Clock size={16} aria-hidden="true" /><span>{many ? "Tus cupos están reservados" : "Tu cupo está reservado"} hasta el <b>{expires}</b>.</span></p>}
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
