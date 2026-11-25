'use client';
// Equipaje: registrar bolsos e imprimir sus etiquetas (en la puerta o en la mesa de equipaje)
// y entregarlos escaneando la etiqueta y la entrada del dueño.
import Link from 'next/link';
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Briefcase, CheckCircle2, CircleSlash, Contact, List, Minus, PackageCheck, Plus, Printer, ScanLine, Search, Trash2, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { EventShell } from './EventWorkspace';
import { useAttendance } from './EventAttendees';
import { EventSubnav } from './EventSubnav';
import { Attendee, clock, filterAttendees, fold, fullName, ticketCodeIn, STATUS_LABELS } from './attendance';
import { Bag, DeliverReply, LABEL_SIZES, LabelSize, LuggageList, LuggageOwner, bagCodeIn, bagLabel, printLabels, saveLabelSize, savedLabelSize } from './luggage';
import { QrScanner, feedback } from './QrScanner';
import a from './event-attendance.module.css';
import g from './event-luggage.module.css';

const BAG_STATUS: Record<Bag['status'], string> = { stored: 'Guardado', delivered: 'Entregado', void: 'Anulado' };

/** Tamaño de etiqueta de la impresora (se recuerda en este dispositivo). */
export function LabelSizePicker() {
  const [size, setSize] = useState<LabelSize>('62x100');
  useEffect(() => setSize(savedLabelSize()), []);
  return (
    <label className={g.sizePicker}><Printer size={15} aria-hidden="true" /><span>Etiqueta</span>
      <select value={size} onChange={(e) => { const v = e.target.value as LabelSize; setSize(v); saveLabelSize(v); }} aria-label="Tamaño de la etiqueta">
        {Object.entries(LABEL_SIZES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
      </select>
    </label>
  );
}

/** Bolsos de una persona: registrar más, imprimir, reimprimir o anular. */
export function LuggagePanel({ eventId, eventTitle, registrationId, onClose, onChanged }: { eventId: string; eventTitle: string; registrationId: string; onClose?: () => void; onChanged?: () => void }) {
  const qc = useQueryClient();
  const key = ['event-luggage-owner', eventId, registrationId];
  const query = useQuery({ queryKey: key, queryFn: async () => (await api.get<{ owner: LuggageOwner; bags: Bag[] }>(`/event-management/${eventId}/luggage/registrations/${registrationId}`)).data });
  const [count, setCount] = useState(1);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [confirmVoid, setConfirmVoid] = useState<string | null>(null);
  const owner = query.data?.owner; const bags = query.data?.bags ?? [];
  const room = 10 - bags.length;

  const print = (list: Bag[]) => printLabels(list, eventTitle, savedLabelSize()).catch(() => setError('No se pudo abrir la impresión. Revisa que el navegador permita imprimir.'));
  async function add() {
    setBusy(true); setError(''); setDone('');
    try {
      const { data } = await api.post<{ owner: LuggageOwner; bags: Bag[]; created: string[] }>(`/event-management/${eventId}/luggage`, { registrationId, count, ...(description.trim() ? { description: description.trim() } : {}) });
      qc.setQueryData(key, { owner: data.owner, bags: data.bags });
      const created = data.bags.filter((b) => data.created.includes(b.id));
      setDone(`${created.length === 1 ? 'Bolso registrado' : `${created.length} bolsos registrados`}. Imprimiendo ${created.length === 1 ? 'la etiqueta' : 'las etiquetas'}…`);
      setCount(1); setDescription(''); onChanged?.();
      feedback(true);
      await print(created);
    } catch (err) { setError(apiErrorMessage(err, 'No se pudo registrar el equipaje.')); feedback(false); }
    finally { setBusy(false); }
  }
  async function voidBag(b: Bag) {
    setBusy(true); setError(''); setDone('');
    try {
      const { data } = await api.post<{ bags: Bag[] }>(`/event-management/${eventId}/luggage/${b.id}/void`);
      qc.setQueryData(key, { owner, bags: data.bags }); setConfirmVoid(null); setDone(`Etiqueta ${bagLabel(b.code)} anulada.`); onChanged?.();
    } catch (err) { setError(apiErrorMessage(err, 'No se pudo anular la etiqueta.')); }
    finally { setBusy(false); }
  }

  return (
    <section className={g.panel} aria-label={owner ? `Equipaje de ${owner.name}` : 'Equipaje'}>
      <header className={g.panelHead}>
        <span className={g.panelIcon} aria-hidden="true"><Briefcase size={20} /></span>
        <div><p className={a.eyebrow}>Equipaje</p><h2>{owner?.name ?? 'Cargando…'}</h2>{owner && <p>{owner.ticketName} · {owner.campusName}</p>}</div>
        {onClose && <button type="button" className={g.close} onClick={onClose} aria-label="Cerrar equipaje"><X size={20} /></button>}
      </header>
      {query.isError && <p role="alert" className={a.notice} data-tone="error">{apiErrorMessage(query.error, 'No pudimos cargar el equipaje.')}</p>}
      {owner && owner.status !== 'confirmed' && <p role="alert" className={a.notice} data-tone="error">{STATUS_LABELS[owner.status] ?? owner.status}: solo se registra equipaje de entradas confirmadas.</p>}
      {done && <p role="status" className={a.notice} data-tone="ok">{done}</p>}
      {error && <p role="alert" className={a.notice} data-tone="error">{error}</p>}

      {bags.length > 0 && (
        <ul className={g.bagList} aria-label="Bolsos registrados">
          {bags.map((b) => (
            <li key={b.id} data-status={b.status}>
              <div><b>Bolso {b.number}</b><code>{bagLabel(b.code)}</code>{b.description && <small>{b.description}</small>}</div>
              <span className={g.state}>{BAG_STATUS[b.status]}</span>
              {b.status === 'stored' && (confirmVoid === b.id
                ? <span className={g.rowActions}><button type="button" className={`${a.btnDanger} ${a.small}`} disabled={busy} onClick={() => void voidBag(b)}>Sí, anular</button><button type="button" className={`${a.btnGhost} ${a.small}`} onClick={() => setConfirmVoid(null)}>No</button></span>
                : <span className={g.rowActions}><button type="button" className={`${a.btnGhost} ${a.small}`} onClick={() => void print([b])} aria-label={`Reimprimir etiqueta del bolso ${b.number}`}><Printer size={14} aria-hidden="true" />Reimprimir</button>
                  <button type="button" className={`${a.btnGhost} ${a.small}`} onClick={() => setConfirmVoid(b.id)} aria-label={`Anular etiqueta del bolso ${b.number}`}><Trash2 size={14} aria-hidden="true" />Anular</button></span>)}
            </li>
          ))}
        </ul>
      )}

      {owner?.status === 'confirmed' && room > 0 && (
        <div className={g.addRow}>
          <div className={g.counter} role="group" aria-label="Bolsos a registrar">
            <button type="button" onClick={() => setCount((n) => Math.max(1, n - 1))} disabled={count <= 1} aria-label="Un bolso menos"><Minus size={18} /></button>
            <output aria-live="polite" aria-label="Cantidad de bolsos">{count}</output>
            <button type="button" onClick={() => setCount((n) => Math.min(room, n + 1))} disabled={count >= room} aria-label="Un bolso más"><Plus size={18} /></button>
          </div>
          <label className={g.desc}><span className="sr-only">Descripción (opcional)</span><input value={description} maxLength={80} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción opcional: maleta negra, saco de dormir…" /></label>
          <button type="button" className={`${a.btnPrimary} ${g.addBtn}`} disabled={busy || !owner} onClick={() => void add()}><Printer size={17} aria-hidden="true" />{busy ? 'Registrando…' : `Registrar ${count === 1 ? '1 bolso' : `${count} bolsos`} e imprimir`}</button>
        </div>
      )}
      <div className={g.panelFoot}>
        <LabelSizePicker />
        {bags.filter((b) => b.status === 'stored').length > 1 && <button type="button" className={`${a.btnGhost} ${a.small}`} onClick={() => void print(bags.filter((b) => b.status === 'stored'))}><Printer size={14} aria-hidden="true" />Imprimir todas</button>}
      </div>
    </section>
  );
}

/** Ventana sobre la puerta: el equipaje de quien acaba de ingresar. */
export function LuggageDialog(props: { eventId: string; eventTitle: string; registrationId: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [props]);
  return <div className={g.backdrop} role="dialog" aria-modal="true" aria-label="Equipaje"><div className={g.sheet}><LuggagePanel {...props} /></div></div>;
}

type Shown = DeliverReply & { at: number };
type Step = { stage: 'bag' } | { stage: 'ticket'; bag: Bag; idCheck: boolean };

/** Mesa de equipaje: recibir (registrar e imprimir), entregar y la lista completa. */
export function EventLuggage({ id }: { id: string }) {
  const qc = useQueryClient();
  const attendance = useAttendance(id, 30000);
  const list = useQuery({ queryKey: ['event-luggage', id], queryFn: async () => (await api.get<LuggageList>(`/event-management/${id}/luggage`)).data, refetchInterval: 20000 });
  const [tab, setTab] = useState<'receive' | 'deliver' | 'list'>('receive');
  const refresh = useCallback(() => { void qc.invalidateQueries({ queryKey: ['event-luggage', id] }); }, [qc, id]);
  const title = list.data?.event.title ?? attendance.data?.event.title ?? '';
  const color = /^#[0-9a-f]{6}$/i.test(list.data?.event.color ?? '') ? list.data!.event.color! : '#96523f';
  const counts = list.data?.counts;
  const manage = attendance.data?.manage ?? false;

  return (
    <EventShell door title="Equipaje" description="Registra los bolsos con su etiqueta y entrégalos escaneando la etiqueta y la entrada del dueño.">
      {manage && <EventSubnav id={id} />}
      <div className={a.door} style={{ '--event-color': color } as CSSProperties}>
        <div className={a.doorHead}>
          <Link className={a.back} href={`/dashboard/eventos/${id}/acceso`}><ArrowLeft size={15} aria-hidden="true" />Control de acceso</Link>
          <LabelSizePicker />
        </div>
        {(list.isError || attendance.isError) && <div role="alert" className={a.notice} data-tone="error">{apiErrorMessage(list.error ?? attendance.error, 'No pudimos cargar el equipaje.')}</div>}
        <div className={a.counter} aria-live="polite">
          <p className={a.eyebrow} style={{ color: '#e8b9a8' }}>{title || 'Cargando evento…'}</p>
          <b>{counts?.stored ?? '—'}</b><span>{counts?.stored === 1 ? 'bolso guardado' : 'bolsos guardados'}{counts ? ` · ${counts.delivered} entregados · ${counts.owners} ${counts.owners === 1 ? 'persona' : 'personas'}` : ''}</span>
        </div>
        <div className={`${a.tabs} ${g.tabs3}`} role="tablist" aria-label="Mesa de equipaje">
          <button type="button" role="tab" aria-selected={tab === 'receive'} onClick={() => setTab('receive')}><Briefcase size={17} aria-hidden="true" />Recibir</button>
          <button type="button" role="tab" aria-selected={tab === 'deliver'} onClick={() => setTab('deliver')}><PackageCheck size={17} aria-hidden="true" />Entregar</button>
          <button type="button" role="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}><List size={17} aria-hidden="true" />Lista</button>
        </div>
        {tab === 'receive' && <Receive id={id} title={title} people={attendance.data?.registrations ?? []} onChanged={refresh} />}
        {tab === 'deliver' && <Deliver id={id} tz={list.data?.event.timezone} onChanged={refresh} people={attendance.data?.registrations ?? []} />}
        {tab === 'list' && <BagTable bags={list.data?.bags ?? []} tz={list.data?.event.timezone} title={title} />}
      </div>
    </EventShell>
  );
}

function Receive({ id, title, people, onChanged }: { id: string; title: string; people: Attendee[]; onChanged: () => void }) {
  const [mode, setMode] = useState<'scan' | 'search'>('scan');
  const [owner, setOwner] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const matches = useMemo(() => (search.trim().length < 2 ? [] : filterAttendees(people, { search, status: 'confirmed', campus: '', presence: '' }).slice(0, 12)), [people, search]);
  const onCode = (text: string) => {
    const code = ticketCodeIn(text);
    if (!code) { setMessage(bagCodeIn(text) ? 'Eso es una etiqueta de bolso. Para recibir, escanea la entrada de la persona.' : 'No reconocemos este código. Busca a la persona por su nombre.'); feedback(false); return; }
    const person = people.find((p) => (p.ticketCode ?? p.id) === code);
    if (!person) { setMessage('Esta entrada no corresponde a este evento.'); feedback(false); return; }
    if (person.status !== 'confirmed') { setMessage(`${fullName(person)}: ${STATUS_LABELS[person.status] ?? person.status}. Solo se registra equipaje de entradas confirmadas.`); feedback(false); return; }
    setMessage(''); setOwner(person.id); feedback(true);
  };
  if (owner) return (
    <>
      <LuggagePanel eventId={id} eventTitle={title} registrationId={owner} onChanged={onChanged} />
      <button type="button" className={`${a.btn} ${g.next}`} onClick={() => { setOwner(null); setSearch(''); }}><ScanLine size={17} aria-hidden="true" />Siguiente persona</button>
    </>
  );
  return (
    <>
      <div className={a.tabs} role="tablist" aria-label="Cómo encontrar a la persona">
        <button type="button" role="tab" aria-selected={mode === 'scan'} onClick={() => setMode('scan')}><ScanLine size={17} aria-hidden="true" />Escanear entrada</button>
        <button type="button" role="tab" aria-selected={mode === 'search'} onClick={() => setMode('search')}><Search size={17} aria-hidden="true" />Buscar por nombre</button>
      </div>
      {message && <p role="alert" className={a.notice} data-tone="error">{message}</p>}
      {mode === 'scan'
        ? <QrScanner paused={false} busy={false} onCode={onCode} idleText="Escanea el QR de la entrada de la persona para registrar sus bolsos." readyText="Listo: escanea la entrada." busyText="Buscando…" manualLabel="Código de la entrada" manualPlaceholder="¿No se lee? Escribe el código de la entrada" />
        : <>
          <label className={a.searchBox}><span className="sr-only">Buscar persona</span><Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, correo o código de la entrada" autoFocus /></label>
          {search.trim().length >= 2 && !matches.length && <p className={a.scanHint}>Nadie con entrada confirmada coincide.</p>}
          <div className={a.manualList}>
            {matches.map((r) => (
              <div className={a.manualItem} key={r.id}>
                <div className={a.person}><strong>{fullName(r)}</strong><span>{r.ticketName ?? 'Entrada'} · {r.campusName}</span></div>
                <button type="button" className={a.btnPrimary} onClick={() => { setMessage(''); setOwner(r.id); }}><Briefcase size={16} aria-hidden="true" />Equipaje</button>
              </div>
            ))}
          </div>
        </>}
    </>
  );
}

const DELIVER_TITLE: Record<DeliverReply['result'], string> = { ok: 'Entregado', mismatch: 'No coincide', already: 'Ya se entregó', void: 'Etiqueta anulada', not_found: 'Etiqueta no reconocida' };

function Deliver({ id, tz, people, onChanged }: { id: string; tz?: string; people: Attendee[]; onChanged: () => void }) {
  const [step, setStep] = useState<Step>({ stage: 'bag' });
  const [shown, setShown] = useState<Shown | null>(null);
  const [busy, setBusy] = useState(false);
  const [idOk, setIdOk] = useState(false);
  const [recent, setRecent] = useState<Shown[]>([]);
  // Tras entregar con la entrada, los demás bolsos de la misma persona salen solo con su etiqueta por 2 minutos.
  const verified = useRef<{ registrationId: string; ticketCode: string; until: number } | null>(null);

  useEffect(() => { if (!shown) return; const t = setTimeout(() => setShown(null), shown.result === 'ok' ? 2200 : 4500); return () => clearTimeout(t); }, [shown]);

  const show = (reply: DeliverReply) => {
    const item = { ...reply, at: Date.now() }; setShown(item); setRecent((r) => [item, ...r].slice(0, 6)); feedback(reply.result === 'ok');
    if (reply.result === 'ok') onChanged();
  };
  const deliver = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data } = await api.post<DeliverReply>(`/event-management/${id}/luggage/deliver`, body);
      show(data); setStep({ stage: 'bag' }); setIdOk(false);
      return data;
    } catch (err) { show({ result: 'not_found', message: apiErrorMessage(err, 'No hay conexión. Inténtalo de nuevo.'), bag: null, counts: { stored: 0, delivered: 0, owners: 0 } }); return null; }
    finally { setBusy(false); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCode = async (text: string) => {
    if (step.stage === 'bag') {
      if (!bagCodeIn(text)) { show({ result: 'not_found', message: ticketCodeIn(text) ? 'Eso es una entrada. Primero escanea la etiqueta del bolso.' : 'No reconocemos esta etiqueta.', bag: null, counts: { stored: 0, delivered: 0, owners: 0 } }); return; }
      setBusy(true);
      try {
        const { data } = await api.post<{ bag: Bag }>(`/event-management/${id}/luggage/lookup`, { code: text });
        const b = data.bag;
        if (b.status !== 'stored') { show({ result: b.status === 'void' ? 'void' : 'already', message: b.status === 'void' ? 'Esta etiqueta fue anulada: no sirve para retirar.' : `Este bolso ya se entregó${b.deliveredAt ? ` a las ${clock(b.deliveredAt, tz)}` : ''}.`, bag: b, counts: { stored: 0, delivered: 0, owners: 0 } }); return; }
        const v = verified.current;
        if (v && v.registrationId === b.registrationId && Date.now() < v.until) { setBusy(false); await deliver({ bagCode: b.code, ticketCode: v.ticketCode }); return; }
        setStep({ stage: 'ticket', bag: b, idCheck: false }); feedback(true);
      } catch (err) { show({ result: 'not_found', message: apiErrorMessage(err, 'No reconocemos esta etiqueta.'), bag: null, counts: { stored: 0, delivered: 0, owners: 0 } }); }
      finally { setBusy(false); }
      return;
    }
    if (bagCodeIn(text) && !ticketCodeIn(text)) { show({ result: 'mismatch', message: 'Eso es otra etiqueta. Ahora escanea la entrada del dueño.', bag: step.bag, counts: { stored: 0, delivered: 0, owners: 0 } }); return; }
    const reply = await deliver({ bagCode: step.bag.code, ticketCode: text });
    if (reply?.result === 'ok') verified.current = { registrationId: step.bag.registrationId, ticketCode: text, until: Date.now() + 120_000 };
  };

  const owner = step.stage === 'ticket' ? people.find((p) => p.id === step.bag.registrationId) : undefined;
  const overlay = shown && (
    <div className={a.result} data-result={shown.result === 'ok' ? 'ok' : shown.result === 'already' ? 'already' : 'invalid'} role="alert" onClick={() => setShown(null)}>
      {shown.result === 'ok' ? <CheckCircle2 size={54} aria-hidden="true" /> : <CircleSlash size={54} aria-hidden="true" />}
      <h2>{DELIVER_TITLE[shown.result]}</h2>
      {shown.bag && <p className={a.who}>{shown.bag.ownerName}</p>}
      {shown.bag && <p>Bolso {shown.bag.number}{shown.bag.total > 1 ? ` de ${shown.bag.total}` : ''} · {bagLabel(shown.bag.code)}</p>}
      <p>{shown.result === 'ok' ? '' : shown.message}</p>
    </div>
  );

  return (
    <>
      <ol className={g.steps} aria-label="Pasos para entregar">
        <li data-on={step.stage === 'bag' || undefined}><span>1</span>Escanea la etiqueta del bolso</li>
        <li data-on={step.stage === 'ticket' || undefined}><span>2</span>Escanea la entrada del dueño</li>
      </ol>
      {step.stage === 'ticket' && (
        <div className={g.pending} role="status">
          <div><p className={a.eyebrow}>Bolso {step.bag.number}{step.bag.total > 1 ? ` de ${step.bag.total}` : ''} · {bagLabel(step.bag.code)}</p>
            <strong>{step.bag.ownerName}</strong><span>{[step.bag.campusName, step.bag.ticketName, step.bag.description].filter(Boolean).join(' · ')}</span></div>
          <button type="button" className={`${a.btnGhost} ${a.small}`} onClick={() => { setStep({ stage: 'bag' }); setIdOk(false); }}>Cancelar</button>
        </div>
      )}
      <QrScanner paused={busy || !!shown || (step.stage === 'ticket' && step.idCheck)} busy={busy} overlay={overlay} onCode={onCode}
        idleText={step.stage === 'bag' ? 'Escanea la etiqueta del bolso. Después te pediremos la entrada del dueño.' : 'Escanea la entrada del dueño: en su correo o en su Wallet.'}
        readyText={step.stage === 'bag' ? 'Listo: escanea la etiqueta del bolso.' : `Ahora escanea la entrada de ${step.bag.ownerName}.`} busyText="Revisando…"
        manualLabel={step.stage === 'bag' ? 'Código de la etiqueta' : 'Código de la entrada'} manualPlaceholder={step.stage === 'bag' ? 'Código de la etiqueta (ej.: 7K3Q-9XHM)' : 'Código de la entrada del dueño'} />
      {step.stage === 'ticket' && (
        step.idCheck
          ? <div className={g.idCheck}>
            <label className={g.check}><input type="checkbox" checked={idOk} onChange={(e) => setIdOk(e.target.checked)} />Revisé su carnet y es {step.bag.ownerName}{owner?.email ? ` (${owner.email})` : ''}.</label>
            <div className={g.rowActions}>
              <button type="button" className={a.btnPrimary} disabled={!idOk || busy} onClick={() => void deliver({ bagCode: step.bag.code, registrationId: step.bag.registrationId, idChecked: true })}><PackageCheck size={17} aria-hidden="true" />Entregar bolso</button>
              <button type="button" className={a.btnGhost} onClick={() => { setStep({ ...step, idCheck: false }); setIdOk(false); }}>Volver a escanear</button>
            </div>
          </div>
          : <button type="button" className={`${a.btnGhost} ${g.next}`} onClick={() => setStep({ ...step, idCheck: true })}><Contact size={17} aria-hidden="true" />No tiene su entrada: verificar con carnet</button>
      )}
      {recent.length > 0 && (
        <section className={a.recent} aria-label="Últimas entregas">
          <h3>Últimas entregas</h3>
          <ul>{recent.map((r) => <li key={r.at}><span>{r.bag ? `${r.bag.ownerName} · bolso ${r.bag.number}` : 'Etiqueta desconocida'}</span><span data-result={r.result === 'ok' ? 'ok' : r.result === 'already' ? 'already' : 'invalid'}>{DELIVER_TITLE[r.result]} · {clock(new Date(r.at).toISOString(), tz)}</span></li>)}</ul>
        </section>
      )}
    </>
  );
}

function BagTable({ bags, tz, title }: { bags: Bag[]; tz?: string; title: string }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | Bag['status']>('stored');
  const words = fold(search).split(/\s+/).filter(Boolean);
  const shown = bags.filter((b) => (!status || b.status === status) && words.every((w) => fold(`${b.ownerName} ${b.code} ${bagLabel(b.code)} ${b.campusName} ${b.description ?? ''}`).includes(w)));
  return (
    <>
      <div className={g.filters}>
        <label className={a.searchBox}><span className="sr-only">Buscar bolso</span><Search size={17} aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, código o campus" /></label>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Estado del bolso">
          <option value="stored">Guardados</option><option value="delivered">Entregados</option><option value="void">Anulados</option><option value="">Todos</option>
        </select>
      </div>
      <p className={a.count}>{shown.length} {shown.length === 1 ? 'bolso' : 'bolsos'}</p>
      <ul className={g.bagList} aria-label="Bolsos">
        {shown.map((b) => (
          <li key={b.id} data-status={b.status}>
            <div><b>{b.ownerName}</b><small>Bolso {b.number}{b.total > 1 ? ` de ${b.total}` : ''} · {b.campusName}{b.description ? ` · ${b.description}` : ''}</small><code>{bagLabel(b.code)}</code></div>
            <span className={g.state}>{BAG_STATUS[b.status]}{b.status === 'delivered' && b.deliveredAt ? ` · ${clock(b.deliveredAt, tz)}${b.deliveredMethod === 'id_check' ? ' (con carnet)' : ''}` : ''}</span>
            {b.status === 'stored' && <span className={g.rowActions}><button type="button" className={`${a.btnGhost} ${a.small}`} onClick={() => void printLabels([b], title, savedLabelSize())} aria-label={`Reimprimir etiqueta de ${b.ownerName}, bolso ${b.number}`}><Printer size={14} aria-hidden="true" />Reimprimir</button></span>}
          </li>
        ))}
      </ul>
      {!shown.length && <p className={a.empty}>{bags.length ? 'Ningún bolso coincide.' : 'Aún no hay bolsos registrados.'}</p>}
    </>
  );
}
