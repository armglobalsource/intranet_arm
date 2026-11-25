'use client';
/* eslint-disable @next/next/no-img-element */
// Puerta del evento: escanea el QR de la entrada (o busca por nombre) y registra el ingreso.
// Pensado para el teléfono de quien recibe: un resultado grande y claro, sonido y vibración.
import Link from 'next/link';
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Briefcase, CheckCircle2, CircleSlash, List, ScanLine, Search, Users } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { EventShell } from './EventWorkspace';
import { useAttendance } from './EventAttendees';
import { AttendanceData, Attendee, CheckInReply, Counts, DoorEvent, STATUS_LABELS, clock, filterAttendees, fullName } from './attendance';
import { QrScanner, feedback } from './QrScanner';
import { LuggageDialog } from './EventLuggage';
import { eventDay } from './event-helpers';
import a from './event-attendance.module.css';

const TITLES: Record<CheckInReply['result'], string> = { ok: 'Puede entrar', already: 'Ya ingresó', invalid: 'No puede entrar', not_found: 'Código no reconocido' };
const ICONS = { ok: CheckCircle2, already: AlertTriangle, invalid: CircleSlash, not_found: CircleSlash };
type Shown = CheckInReply & { at: number };

export function EventCheckIn({ id }: { id: string }) {
  const qc = useQueryClient();
  const query = useAttendance(id, 20000);
  const data = query.data;
  const [mode, setMode] = useState<'scan' | 'search'>('scan');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [recent, setRecent] = useState<Shown[]>([]);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [luggage, setLuggage] = useState<Attendee | null>(null);
  const tz = data?.event.timezone;

  // Después de mostrar un resultado, vuelve a escanear solo (salvo que esté abierto el equipaje).
  useEffect(() => {
    if (!shown || luggage || mode !== 'scan') return;
    const t = setTimeout(() => setShown(null), shown.result === 'ok' ? 2200 : 4000);
    return () => clearTimeout(t);
  }, [shown, luggage, mode]);
  const openLuggage = (r: Attendee) => { setShown(null); setLuggage(r); };

  const liveCounts = useMemo<Counts | null>(() => {
    if (!data) return counts;
    const confirmed = data.registrations.filter((r) => r.status === 'confirmed');
    const fromList = { confirmed: confirmed.length, checkedIn: confirmed.filter((r) => r.checkedInAt).length };
    return counts && counts.checkedIn > fromList.checkedIn ? counts : fromList;
  }, [data, counts]);

  const patch = useCallback((next: Attendee | null) => {
    if (!next) return;
    qc.setQueryData<AttendanceData>(['event-attendees', id], (old) => old && { ...old, registrations: old.registrations.map((r) => (r.id === next.id ? next : r)) });
  }, [qc, id]);

  const submit = useCallback(async (code: string) => {
    setBusy(true);
    try {
      const { data: reply } = await api.post<CheckInReply>(`/event-management/${id}/check-in`, { code });
      const item = { ...reply, at: Date.now() };
      setShown(item); setCounts(reply.counts); patch(reply.attendee);
      setRecent((r) => [item, ...r].slice(0, 6));
      feedback(reply.result === 'ok');
    } catch (err) {
      const item: Shown = { result: 'not_found', message: apiErrorMessage(err, 'No hay conexión. Revisa la señal e inténtalo de nuevo.'), attendee: null, counts: liveCounts ?? { confirmed: 0, checkedIn: 0 }, at: Date.now() };
      setShown(item); feedback(false);
    } finally { setBusy(false); }
  }, [id, patch, liveCounts]);

  async function undo(r: Attendee) {
    setBusy(true);
    try {
      const { data: reply } = await api.post<{ attendee: Attendee; counts: Counts }>(`/event-management/${id}/registrations/${r.id}/undo-check-in`);
      patch(reply.attendee); setCounts(reply.counts); setShown(null);
    } catch (err) {
      setShown({ result: 'invalid', message: apiErrorMessage(err, 'No se pudo deshacer el ingreso.'), attendee: r, counts: liveCounts ?? { confirmed: 0, checkedIn: 0 }, at: Date.now() });
    } finally { setBusy(false); }
  }

  const color = data?.event.color && /^#[0-9a-f]{6}$/i.test(data.event.color) ? data.event.color : '#96523f';
  const pct = liveCounts?.confirmed ? Math.round((liveCounts.checkedIn / liveCounts.confirmed) * 100) : 0;
  const matches = useMemo(() => (search.trim().length < 2 ? [] : filterAttendees(data?.registrations ?? [], { search, status: '', campus: '', presence: '' }).slice(0, 12)), [data, search]);

  return (
    <EventShell door title="Control de acceso" description="Escanea el código QR de cada entrada o busca a la persona por su nombre.">
      <div className={a.door} style={{ '--event-color': color } as CSSProperties}>
        <div className={a.doorHead}>
          <Link className={a.back} href="/dashboard/eventos/acceso"><ArrowLeft size={15} aria-hidden="true" />Eventos</Link>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className={a.back} href={`/dashboard/eventos/${id}/equipaje`}><Briefcase size={15} aria-hidden="true" />Equipaje</Link>
            <Link className={a.back} href={`/dashboard/eventos/${id}/inscritos`}><Users size={15} aria-hidden="true" />Ver inscritos</Link>
          </span>
        </div>
        {query.isError && <div role="alert" className={a.notice} data-tone="error">{apiErrorMessage(query.error, 'No pudimos cargar el evento.')}</div>}
        <div className={a.counter} aria-live="polite">
          <p className={a.eyebrow} style={{ color: '#e8b9a8' }}>{data?.event.title ?? 'Cargando evento…'}</p>
          <b>{liveCounts?.checkedIn ?? '—'}</b><span>de {liveCounts?.confirmed ?? '—'} ingresaron{liveCounts?.confirmed ? ` · ${pct}%` : ''}</span>
          <div className={a.meter} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        </div>

        <div className={a.tabs} role="tablist" aria-label="Forma de registrar el ingreso">
          <button type="button" role="tab" aria-selected={mode === 'scan'} onClick={() => setMode('scan')}><ScanLine size={17} aria-hidden="true" />Escanear QR</button>
          <button type="button" role="tab" aria-selected={mode === 'search'} onClick={() => setMode('search')}><List size={17} aria-hidden="true" />Buscar por nombre</button>
        </div>

        {mode === 'scan'
          ? <QrScanner paused={busy || !!shown || !!luggage} busy={busy} onCode={submit}
            overlay={shown && <ResultCard shown={shown} tz={tz} busy={busy} onDismiss={() => setShown(null)} onUndo={undo} onLuggage={openLuggage} />}
            idleText="Apunta la cámara al código QR de la entrada. Funciona con la entrada impresa o en la pantalla del teléfono."
            readyText="Listo para escanear la siguiente entrada." busyText="Revisando la entrada…"
            manualLabel="Código de la entrada" manualPlaceholder="¿El QR no se lee? Escribe el código y presiona Enter" />
          : <>
            {shown && <ResultCard shown={shown} tz={tz} inline onDismiss={() => setShown(null)} onUndo={undo} onLuggage={openLuggage} busy={busy} />}
            <label className={a.searchBox}><span className="sr-only">Buscar persona</span><Search size={17} aria-hidden="true" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, correo o código de la entrada" autoFocus /></label>
            {search.trim().length >= 2 && !matches.length && <p className={a.scanHint}>Nadie coincide. Si la persona no está inscrita, pídele a quien administra el evento que la agregue.</p>}
            <div className={a.manualList}>
              {matches.map((r) => (
                <div className={a.manualItem} key={r.id}>
                  <div className={a.person}><strong>{fullName(r)}</strong><span>{r.ticketName ?? 'Entrada'} · {r.campusName}</span>
                    <span>{r.checkedInAt ? `Ingresó a las ${clock(r.checkedInAt, tz)}` : r.status === 'confirmed' ? 'Aún no ingresa' : STATUS_LABELS[r.status] ?? r.status}</span></div>
                  {r.status === 'confirmed' && <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button type="button" className={a.btn} onClick={() => openLuggage(r)} aria-label={`Equipaje de ${fullName(r)}`}><Briefcase size={16} aria-hidden="true" />Equipaje</button>
                    {!r.checkedInAt && <button type="button" className={a.btnPrimary} disabled={busy} onClick={() => void submit(r.ticketCode ?? r.id)}>Marcar ingreso</button>}
                  </span>}
                </div>
              ))}
            </div>
          </>}

        {recent.length > 0 && (
          <section className={a.recent} aria-label="Últimos registros">
            <h3>Últimos registros</h3>
            <ul>{recent.map((r) => <li key={r.at}><span>{r.attendee ? fullName(r.attendee) : 'Código desconocido'}</span><span data-result={r.result}>{TITLES[r.result]} · {clock(new Date(r.at).toISOString(), tz)}</span></li>)}</ul>
          </section>
        )}
        {luggage && data && <LuggageDialog eventId={id} eventTitle={data.event.title} registrationId={luggage.id} onClose={() => setLuggage(null)} />}
      </div>
    </EventShell>
  );
}

function ResultCard({ shown, tz, inline, busy, onDismiss, onUndo, onLuggage }: { shown: Shown; tz?: string; inline?: boolean; busy: boolean; onDismiss: () => void; onUndo: (r: Attendee) => void; onLuggage: (r: Attendee) => void }) {
  const Icon = ICONS[shown.result];
  const r = shown.attendee;
  return (
    <div className={`${a.result} ${inline ? a.resultInline : ''}`} data-result={shown.result} role="alert" onClick={inline ? undefined : onDismiss}>
      <Icon size={54} aria-hidden="true" />
      <h2>{TITLES[shown.result]}</h2>
      {r && <p className={a.who}>{fullName(r)}</p>}
      {r && <p>{r.ticketName ?? 'Entrada'} · {r.campusName}</p>}
      <p>{shown.result === 'already' && r?.checkedInAt ? `Ingresó a las ${clock(r.checkedInAt, tz)}${r.checkedInBy ? ` (registró ${r.checkedInBy})` : ''}.` : shown.result === 'ok' ? '' : shown.message}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(shown.result === 'ok' || shown.result === 'already') && r?.status === 'confirmed' && <button type="button" className={a.btn} onClick={(e) => { e.stopPropagation(); onLuggage(r); }}><Briefcase size={16} aria-hidden="true" />Registrar equipaje</button>}
        {shown.result === 'ok' && r && <button type="button" className={a.btn} disabled={busy} onClick={(e) => { e.stopPropagation(); onUndo(r); }}>Deshacer ingreso</button>}
        <button type="button" className={a.btn} onClick={(e) => { e.stopPropagation(); onDismiss(); }}>{inline ? 'Cerrar' : 'Siguiente'}</button>
      </div>
    </div>
  );
}

/** Eventos en curso o próximos donde esta persona puede registrar ingresos. */
export function EventDoorList() {
  const query = useQuery({ queryKey: ['event-door-events'], queryFn: async () => (await api.get<DoorEvent[]>('/event-door/events')).data });
  const now = Date.now();
  return (
    <EventShell door title="Control de acceso" description="Elige el evento y registra quién llega, con el QR de su entrada o por su nombre.">
      <div className={a.page}>
        {query.isPending && <p role="status" className={a.count}>Cargando eventos…</p>}
        {query.isError && <div role="alert" className={a.notice} data-tone="error">{apiErrorMessage(query.error, 'No pudimos cargar los eventos.')}</div>}
        {query.data?.length === 0 && <p className={a.empty}>No hay eventos publicados próximos o en curso para tu campus.</p>}
        <div className={a.doorGrid}>
          {query.data?.map((e) => {
            const live = Date.parse(e.startsAt) - 3 * 3600_000 <= now && now <= Date.parse(e.endsAt);
            return (
              <article key={e.id} className={a.doorCard}>
                <div className={a.doorCover}>{e.bannerUrl && <img src={e.bannerUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />}</div>
                <div className={a.doorBody}>
                  {live && <span className={a.live}>Hoy</span>}
                  <h2>{e.title}</h2>
                  <p>{eventDay(e.startsAt, e.timezone)?.full ?? ""} · {e.campusName}</p>
                  <p><b>{e.checkedIn}</b> de <b>{e.confirmed}</b> ingresaron{e.capacity ? ` · cupo ${e.capacity}` : ''}</p>
                  <Link className={a.btnPrimary} href={`/dashboard/eventos/${e.id}/acceso`}><ScanLine size={17} aria-hidden="true" />Abrir control de acceso</Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </EventShell>
  );
}
