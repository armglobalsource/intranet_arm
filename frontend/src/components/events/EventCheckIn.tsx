'use client';
/* eslint-disable @next/next/no-img-element */
// Puerta del evento: escanea el QR de la entrada (o busca por nombre) y registra el ingreso.
// Pensado para el teléfono de quien recibe: un resultado grande y claro, sonido y vibración.
import Link from 'next/link';
import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, CircleSlash, List, QrCode, ScanLine, Search, Users } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { EventShell } from './EventWorkspace';
import { useAttendance } from './EventAttendees';
import { AttendanceData, Attendee, CheckInReply, Counts, DoorEvent, STATUS_LABELS, clock, filterAttendees, fullName, ticketCodeIn } from './attendance';
import { eventDay } from './event-helpers';
import a from './event-attendance.module.css';

const TITLES: Record<CheckInReply['result'], string> = { ok: 'Puede entrar', already: 'Ya ingresó', invalid: 'No puede entrar', not_found: 'Código no reconocido' };
const ICONS = { ok: CheckCircle2, already: AlertTriangle, invalid: CircleSlash, not_found: CircleSlash };
type Shown = CheckInReply & { at: number };

/** Tono corto: agudo si puede entrar, grave si no. */
function feedback(ok: boolean) {
  try { navigator.vibrate?.(ok ? 80 : [120, 80, 120]); } catch { /* sin vibración */ }
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220; gain.gain.value = 0.08;
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
    osc.onended = () => void ctx.close();
  } catch { /* sin sonido */ }
}

type Detector = (source: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>;
/** Usa el lector nativo del navegador si existe (Chrome/Android) y, si no, jsQR (iPhone). */
async function makeDetector(): Promise<Detector> {
  const Native = (window as any).BarcodeDetector;
  if (Native) {
    try {
      if ((await Native.getSupportedFormats?.())?.includes('qr_code')) {
        const detector = new Native({ formats: ['qr_code'] });
        return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
      }
    } catch { /* se usa jsQR */ }
  }
  const jsQR = (await import('jsqr')).default;
  return async (video, canvas) => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 720 / Math.max(w, h));
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

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
  const tz = data?.event.timezone;

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
          <Link className={a.back} href={`/dashboard/eventos/${id}/inscritos`}><Users size={15} aria-hidden="true" />Ver inscritos</Link>
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
          ? <Scanner busy={busy} shown={shown} tz={tz} onCode={submit} onDismiss={() => setShown(null)} onUndo={undo} />
          : <>
            {shown && <ResultCard shown={shown} tz={tz} inline onDismiss={() => setShown(null)} onUndo={undo} busy={busy} />}
            <label className={a.searchBox}><span className="sr-only">Buscar persona</span><Search size={17} aria-hidden="true" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, correo o código de la entrada" autoFocus /></label>
            {search.trim().length >= 2 && !matches.length && <p className={a.scanHint}>Nadie coincide. Si la persona no está inscrita, pídele a quien administra el evento que la agregue.</p>}
            <div className={a.manualList}>
              {matches.map((r) => (
                <div className={a.manualItem} key={r.id}>
                  <div className={a.person}><strong>{fullName(r)}</strong><span>{r.ticketName ?? 'Entrada'} · {r.campusName}</span>
                    <span>{r.checkedInAt ? `Ingresó a las ${clock(r.checkedInAt, tz)}` : r.status === 'confirmed' ? 'Aún no ingresa' : STATUS_LABELS[r.status] ?? r.status}</span></div>
                  {r.status === 'confirmed' && !r.checkedInAt && <button type="button" className={a.btnPrimary} disabled={busy} onClick={() => void submit(r.id)}>Marcar ingreso</button>}
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
      </div>
    </EventShell>
  );
}

function ResultCard({ shown, tz, inline, busy, onDismiss, onUndo }: { shown: Shown; tz?: string; inline?: boolean; busy: boolean; onDismiss: () => void; onUndo: (r: Attendee) => void }) {
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
        {shown.result === 'ok' && r && <button type="button" className={a.btn} disabled={busy} onClick={(e) => { e.stopPropagation(); onUndo(r); }}>Deshacer ingreso</button>}
        <button type="button" className={a.btn} onClick={(e) => { e.stopPropagation(); onDismiss(); }}>{inline ? 'Cerrar' : 'Siguiente'}</button>
      </div>
    </div>
  );
}

function Scanner({ busy, shown, tz, onCode, onDismiss, onUndo }: { busy: boolean; shown: Shown | null; tz?: string; onCode: (code: string) => Promise<void>; onDismiss: () => void; onUndo: (r: Attendee) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const paused = useRef(false);
  const [state, setState] = useState<'idle' | 'starting' | 'on' | 'error'>('idle');
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  paused.current = busy || !!shown;
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  // Después de mostrar un resultado, vuelve a escanear solo.
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(onDismiss, shown.result === 'ok' ? 2200 : 4000);
    return () => clearTimeout(t);
  }, [shown, onDismiss]);

  async function start() {
    setError(''); setState('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.current = media;
      const el = video.current!;
      el.srcObject = media; await el.play();
      setState('on');
      try { await (navigator as any).wakeLock?.request('screen'); } catch { /* la pantalla puede apagarse */ }
      const detect = await makeDetector();
      canvas.current ??= document.createElement('canvas');
      const loop = async () => {
        if (!stream.current) return;
        if (!paused.current && el.readyState >= 2) {
          try {
            const text = await detect(el, canvas.current!);
            if (text) {
              // El mismo código frente a la cámara no se envía dos veces seguidas.
              const key = ticketCodeIn(text) ?? text;
              const now = Date.now();
              if (key !== last.current.code || now - last.current.at > 8000) {
                last.current = { code: key, at: now };
                await onCodeRef.current(key);
              }
            }
          } catch { /* cuadro ilegible: se intenta con el siguiente */ }
        }
        setTimeout(() => requestAnimationFrame(() => void loop()), 120);
      };
      void loop();
    } catch (err) {
      stop(); setState('error');
      const name = (err as any)?.name;
      setError(name === 'NotAllowedError' ? 'No tenemos permiso para usar la cámara. Actívalo en el candado de la barra de direcciones o usa «Buscar por nombre».'
        : name === 'NotFoundError' ? 'Este dispositivo no tiene cámara disponible. Usa «Buscar por nombre».'
          : 'No pudimos abrir la cámara. Usa «Buscar por nombre» o escribe el código.');
    }
  }

  return (
    <>
      <div className={a.camera}>
        <video ref={video} playsInline muted aria-label="Vista de la cámara" />
        {state === 'on' && <div className={a.frame} aria-hidden="true" />}
        {state !== 'on' && (
          <div className={a.cameraIdle}>
            {state === 'error' ? <Camera size={40} aria-hidden="true" /> : <QrCode size={44} aria-hidden="true" />}
            <p>{state === 'error' ? error : 'Apunta la cámara al código QR de la entrada. Funciona con la entrada impresa o en la pantalla del teléfono.'}</p>
            <button type="button" className={a.btnPrimary} onClick={() => void start()} disabled={state === 'starting'}><Camera size={18} aria-hidden="true" />{state === 'starting' ? 'Abriendo cámara…' : state === 'error' ? 'Intentar de nuevo' : 'Activar cámara'}</button>
          </div>
        )}
        {shown && <ResultCard shown={shown} tz={tz} busy={busy} onDismiss={onDismiss} onUndo={onUndo} />}
      </div>
      <p className={a.scanHint}>{state === 'on' ? (busy ? 'Revisando la entrada…' : 'Listo para escanear la siguiente entrada.') : ''}</p>
      <form className={a.searchBox} style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { void onCode(manual.trim()); setManual(''); } }}>
        <label className="sr-only" htmlFor="ticket-code">Código de la entrada</label>
        <QrCode size={17} aria-hidden="true" />
        <input id="ticket-code" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="¿El QR no se lee? Escribe el código y presiona Enter" autoComplete="off" />
      </form>
    </>
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
