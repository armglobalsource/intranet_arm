'use client';
// Editor de eventos: cuatro pasos guiados por preguntas (qué, cuándo, dónde, quién),
// lista de lo que falta para publicar y la portada en vivo al lado del formulario.

import { useEffect, useState, useId, Children, cloneElement, isValidElement, ReactElement, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, Eye, Save, Plus, Trash2, Check, CircleDashed, Monitor, Smartphone,
  CalendarDays, MapPin, Users, Sparkles, Image as ImageIcon, Ticket, Globe2, Building2, Shuffle, X, Upload, Loader2, Mail,
  ScanLine,
} from 'lucide-react';
import Link from 'next/link';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';
import { EventShell, useEventAccess, useEventOptions } from './EventWorkspace';
import { EventProgram, EventDetails, EventOptions, newEvent, eventStatuses, PublicEvent } from './event-types';
import { EVENT_COLORS, EVENT_TIMEZONES, PUBLISH_STATES, PublishState, eventReadiness, missingToPublish, publishStateOf, slugify, withPublishState } from './event-helpers';
import { EventLanding } from './EventLanding';
import { uploadCover } from './cover-upload';
import { QuestionsEditor, TicketsEditor, cleanQuestions } from './EventSalesEditor';
import { EventSubnav } from './EventSubnav';
import s from './events.module.css';
import x from './event-editor.module.css';

const STEPS = [
  { title: 'Lo esencial', hint: 'Qué, cuándo, dónde y quién' },
  { title: 'Portada y contenido', hint: 'Imagen, invitación y detalles' },
  { title: 'Entradas y pago', hint: 'Valor, cupos y fechas' },
  { title: 'Revisar y publicar', hint: 'Lista final y estado' },
];

function Field({ title, children, wide = false, hint, count }: { title: string; children: ReactNode; wide?: boolean; hint?: string; count?: string }) {
  const id = useId();
  return (
    <div className={`${s.field} ${wide ? s.wide : ''}`}>
      <span className={x.labelRow}><label htmlFor={id}>{title}</label>{count && <span className={x.counter}>{count}</span>}</span>
      {Children.map(children, (child) => isValidElement(child) && ['input', 'select', 'textarea'].includes(String(child.type))
        ? cloneElement(child as ReactElement<any>, { id, 'aria-describedby': hint ? `${id}-hint` : undefined }) : child)}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
function Card({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children: ReactNode }) {
  return (
    <section className={x.card}>
      <header><span className={x.cardIcon} aria-hidden="true">{icon}</span><div><h3>{title}</h3>{text && <p>{text}</p>}</div></header>
      <div className={s.formGrid}>{children}</div>
    </section>
  );
}
/** Portada: se sube desde el equipo (o se pega un enlace) y se ve al instante. */
function CoverPicker({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputId = useId();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [drag, setDrag] = useState(false); const [showUrl, setShowUrl] = useState(false);
  async function pick(file?: File | null) {
    if (!file || busy) return;
    setBusy(true); setError('');
    try { onChange(await uploadCover(file)); }
    catch (e) { setError(apiErrorMessage(e, e instanceof Error ? e.message : 'No se pudo subir la imagen. Inténtalo de nuevo.')); }
    finally { setBusy(false); }
  }
  return (
    <div className={`${s.wide} ${x.cover}`}>
      <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" className={x.fileInput} disabled={busy} aria-label="Subir imagen de portada" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {value ? (
        <div className={x.coverCurrent}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Imagen de portada actual" referrerPolicy="no-referrer" />
          {busy && <span className={x.coverBusy} role="status"><Loader2 size={18} className={x.spin} />Subiendo imagen…</span>}
          <div className={x.coverActions}>
            <label htmlFor={inputId} className={s.button}><Upload size={15} />Cambiar imagen</label>
            <button type="button" className={s.button} disabled={busy} onClick={() => onChange('')}><X size={15} />Quitar</button>
          </div>
        </div>
      ) : (
        <label htmlFor={inputId} className={`${x.dropzone} ${drag ? x.dragging : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void pick(e.dataTransfer.files?.[0]); }}>
          {busy ? <Loader2 size={26} className={x.spin} aria-hidden="true" /> : <Upload size={26} aria-hidden="true" />}
          <b>{busy ? 'Subiendo imagen…' : 'Sube la imagen de portada'}</b>
          <span>Arrastra una imagen aquí o toca para elegirla · JPG, PNG o WebP · ideal 1600 × 900 px</span>
        </label>
      )}
      {error && <p role="alert" className={s.error}>{error}</p>}
      <button type="button" className={x.linkButton} onClick={() => setShowUrl(!showUrl)}>{showUrl ? 'Ocultar enlace' : '¿La imagen ya está en internet? Pega su enlace'}</button>
      {showUrl && <Field title="Enlace de la imagen" hint="Enlace público https."><input type="url" maxLength={2000} placeholder="https://…" value={value} onChange={(e) => onChange(e.target.value)} /></Field>}
    </div>
  );
}

function localDate(value: string | null) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function isoDate(value: string) { return value ? new Date(value).toISOString() : ''; }

export function EventEditor({ id }: { id?: string }) {
  const access = useEventAccess(); const options = useEventOptions(); const user = useAuthStore((u) => u.user); const [draft, setDraft] = useState<EventProgram | null>(null);
  const query = useQuery({ queryKey: ['event-program', id], enabled: !!id && access.allowed, queryFn: () => api.get<EventProgram>(`/event-management/${id}`).then((r) => r.data) });
  useEffect(() => { if (!draft) { if (id && query.data) setDraft(query.data); else if (!id && user) setDraft(newEvent(user.id, user.campusId ?? 0)); } }, [id, query.data, user, draft]);
  return (
    <EventShell title={id ? 'Edita tu evento' : 'Crea un nuevo evento'} description="Completa los pasos y mira en vivo cómo lo verán los participantes." action={<Link className={s.button} href="/dashboard/eventos/gestion"><ArrowLeft size={16} />Volver</Link>}>
      {id && <EventSubnav id={id} />}
      {(options.isError || query.isError) && <div className={s.error} role="alert">{apiErrorMessage(options.error ?? query.error, 'No se pudo cargar el evento o su configuración.')} <button className={s.button} onClick={() => { options.refetch(); if (id) query.refetch(); }}>Reintentar</button></div>}
      {(!draft || !options.data) && !options.isError && !query.isError && <p role="status">Preparando el editor…</p>}
      {draft && options.data && <EditorForm initial={draft} options={options.data} onReload={async () => { if (id) { const r = await query.refetch(); if (r.data) setDraft(r.data); } }} key={`${id ?? 'new'}-${draft.version}`} />}
    </EventShell>
  );
}

function EditorForm({ initial, options, onReload }: { initial: EventProgram; options: EventOptions; onReload: () => void }) {
  const router = useRouter(); const qc = useQueryClient();
  const [event, setEvent] = useState(initial); const [tab, setTab] = useState(0); const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const [dirty, setDirty] = useState(false); const [savedStatus, setSavedStatus] = useState(initial.status); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  // El enlace se arma solo a partir del nombre hasta que alguien lo edita a mano.
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  const access = useEventAccess(); const user = useAuthStore((u) => u.user);
  useEffect(() => { if (!dirty) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  function change<K extends keyof EventProgram>(key: K, value: EventProgram[K]) { setEvent((e) => ({ ...e, [key]: value })); setDirty(true); setSaved(false); }
  function detail<K extends keyof EventDetails>(key: K, value: EventDetails[K]) { setEvent((e) => ({ ...e, details: { ...e.details, [key]: value } })); setDirty(true); setSaved(false); }
  function setTitle(title: string) { setEvent((e) => ({ ...e, title, slug: slugTouched ? e.slug : slugify(title) })); setDirty(true); setSaved(false); }
  function setStart(value: string) {
    const startsAt = isoDate(value);
    // Si no hay término (o quedó antes del inicio), se propone el mismo día, 3 horas después.
    setEvent((e) => ({ ...e, startsAt, endsAt: startsAt && (!e.endsAt || new Date(e.endsAt) < new Date(startsAt)) ? new Date(new Date(startsAt).getTime() + 3 * 3600_000).toISOString() : e.endsAt }));
    setDirty(true); setSaved(false);
  }

  const save = useMutation({
    // `next` permite guardar un cambio de estado en el mismo clic (p. ej. «Publicar ahora»).
    mutationFn: async (next?: EventProgram) => {
      const event = next ?? current;
      if (!event.title.trim() || !event.slug || !event.campusId || !event.organizerId || !event.startsAt || !event.endsAt) throw new Error('Completa nombre, enlace, campus, responsable y fechas en «Lo esencial».');
      if (new Date(event.endsAt) < new Date(event.startsAt)) throw new Error('El término debe ser posterior al inicio.');
      const missing = event.status === 'published' ? missingToPublish(event) : [];
      if (missing.length) throw new Error(`Para publicar falta: ${missing.map((m) => m.label.toLowerCase()).join(', ')}. Revisa «Revisar y publicar».`);
      const { id, audit, ...rest } = event;
      // La fecha límite de pago ya no se pide: el pago se cierra con las inscripciones (y cada reserva dura 24 horas).
      const body = { ...rest, details: { ...rest.details, paymentDueAt: null, questions: cleanQuestions(rest.details.questions) } };
      return (await (id ? api.patch(`/event-management/${id}`, body) : api.post('/event-management', body))).data as { id: string; version: number };
    },
    onSuccess: (r, next) => { setSavedStatus((next ?? current).status); setEvent((e) => ({ ...e, id: r.id, version: r.version })); setDirty(false); setSaved(true); setError(''); qc.invalidateQueries({ queryKey: ['event-programs'] }); qc.invalidateQueries({ queryKey: ['event-program', r.id] }); if (!initial.id) router.replace(`/dashboard/eventos/${r.id}`); },
    onError: (e) => setError(apiErrorMessage(e, e instanceof Error ? e.message : 'No se pudo guardar el evento')),
  });
  const current = event;
  const state = publishStateOf(event);
  const wasLive = savedStatus !== 'draft';
  function setState(next: PublishState) { setEvent((e) => withPublishState(e, next)); setDirty(true); setSaved(false); }
  function publishNow() { const next = withPublishState(event, 'open'); setEvent(next); setError(''); save.mutate(next); }
  const paymentCheck = useMutation({ mutationFn: async () => (await api.post('/event-management/payments/check')).data as { mode: string; collectorId: string; message: string } });

  const editableOwner = options.access.global || (options.access.campus && Number(event.campusId) === Number(user?.campusId));
  const previewData: PublicEvent = { ...event, paymentMode: options.paymentMode, campusName: options.campuses.find((c) => c.id === event.campusId)?.name ?? '', categoryName: options.categories.find((c) => c.id === event.categoryId)?.name ?? '', campuses: options.campuses.filter((c) => event.campusIds.includes(c.id)).map((c) => c.name), registrationEnabled: false };
  const readiness = eventReadiness(event);
  const required = readiness.filter((i) => i.required);
  const ready = required.filter((i) => i.done).length;
  const stepDone = (i: number) => readiness.filter((r) => r.step === i && r.required).every((r) => r.done);
  const d = event.details;
  const dateField = (title: string, key: 'registrationOpensAt' | 'registrationClosesAt' | 'paymentDueAt', hint?: string) => <Field title={title} hint={hint}><input type="datetime-local" value={localDate(d[key])} onChange={(e) => detail(key, isoDate(e.target.value) || null)} /></Field>;
  const go = (i: number) => { setTab(i); setPreview(false); requestAnimationFrame(() => document.getElementById('event-panel')?.scrollIntoView({ block: 'start', behavior: 'smooth' })); };

  const live = (
    <div className={x.previewShell}>
      <div className={x.previewBar}>
        <span className={x.dots} aria-hidden="true"><i /><i /><i /></span>
        <span className={x.url}>ecosistema.armglobal.org/eventos/{event.slug || 'tu-evento'}</span>
        <span className={x.deviceToggle} role="group" aria-label="Tamaño de la vista previa">
          <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')} aria-label="Ver como teléfono"><Smartphone size={15} /></button>
          <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')} aria-label="Ver como computador"><Monitor size={15} /></button>
        </span>
      </div>
      <div className={`${x.previewViewport} ${device === 'phone' ? x.phone : x.desktop}`}>
        <EventLanding event={previewData} preview />
      </div>
    </div>
  );

  return (
    <>
      {error && <div className={s.error} role="alert">{error}{(save.error as any)?.response?.status === 409 && <button className={s.button} onClick={() => { if (confirm('¿Descartar tus cambios locales y cargar la versión guardada?')) onReload(); }}>Recargar versión guardada</button>}</div>}
      {saved && <div className={s.success} role="status">Cambios guardados. {event.status === 'published' ? 'La portada está publicada.' : 'El evento sigue en el estado seleccionado.'}</div>}

      <div className={x.topline}>
        <span className={`${x.statusBadge} ${x[`status_${event.status}`]}`}>{eventStatuses[event.status]}</span>
        <div className={x.progress} aria-label={`Listo para publicar: ${ready} de ${required.length}`}>
          <span className={x.progressTrack}><span style={{ width: `${(ready / required.length) * 100}%` }} /></span>
          <span>Listo para publicar · <b>{ready}/{required.length}</b></span>
        </div>
        <div className={x.toplineActions}>
          <button className={`${s.button} ${x.previewToggle}`} onClick={() => setPreview(!preview)}><Eye size={16} />{preview ? 'Volver al editor' : 'Vista previa'}</button>
          {event.id && event.status !== 'draft' && <Link href={`/eventos/${event.slug}`} className={s.button} target="_blank">Abrir página pública</Link>}
        </div>
      </div>

      <div className={x.stepper} role="tablist" aria-label="Pasos del evento">
        {STEPS.map((st, i) => (
          <button type="button" key={st.title} role="tab" id={`event-tab-${i}`} aria-selected={tab === i && !preview} aria-controls="event-panel" onClick={() => go(i)} className={stepDone(i) && i < 3 ? x.stepDone : ''}>
            <span className={x.stepNum}>{stepDone(i) && i < 3 ? <Check size={14} /> : i + 1}</span>
            <span><b>{st.title}</b><small>{st.hint}</small></span>
          </button>
        ))}
      </div>

      {preview ? <div className={x.previewOnly}>{live}</div> : (
        <div className={x.layout}>
          <section className={x.form} role="tabpanel" id="event-panel" aria-labelledby={`event-tab-${tab}`}>
            {tab === 0 && <>
              <Card icon={<Sparkles size={18} />} title="¿Qué evento es?" text="El nombre es lo primero que verán. El enlace se arma solo.">
                <Field title="Nombre del evento *" wide><input maxLength={160} value={event.title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Retiro de Hombres 2027" required /></Field>
                <Field title="Enlace público *" wide hint={`ecosistema.armglobal.org/eventos/${event.slug || 'nombre-del-evento'}`}><input maxLength={120} value={event.slug} onChange={(e) => { setSlugTouched(true); change('slug', slugify(e.target.value)); }} required /></Field>
                <Field title="Categoría">
                  <select value={event.categoryId ?? ''} onChange={(e) => change('categoryId', e.target.value || null)}><option value="">Elige una categoría</option>{options.categories.filter((c) => c.active || c.id === event.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}{!c.active ? ' (inactiva)' : ''}</option>)}</select>
                  {!options.categories.length && <small>Pide al administrador que cree las categorías.</small>}
                </Field>
              </Card>
              <Card icon={<CalendarDays size={18} />} title="¿Cuándo?" text="Al elegir el inicio te proponemos un término 3 horas después.">
                <Field title="Inicio *"><input type="datetime-local" value={localDate(event.startsAt)} onChange={(e) => setStart(e.target.value)} /></Field>
                <Field title="Término *"><input type="datetime-local" value={localDate(event.endsAt)} onChange={(e) => change('endsAt', isoDate(e.target.value))} /></Field>
                <Field title="Zona horaria del evento" wide hint={`Escribes las horas en la zona de tu equipo (${Intl.DateTimeFormat().resolvedOptions().timeZone}); la portada las muestra en la del evento.`}>
                  <select value={d.timezone} onChange={(e) => detail('timezone', e.target.value)}>
                    {!EVENT_TIMEZONES.some((t) => t.value === d.timezone) && <option value={d.timezone}>{d.timezone}</option>}
                    {EVENT_TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
              </Card>
              <Card icon={<MapPin size={18} />} title="¿Dónde?">
                <div className={s.wide}>
                  <span className={x.miniLabel}>Modalidad</span>
                  <div className={x.segmented} role="radiogroup" aria-label="Modalidad">
                    {([['onsite', 'Presencial', <Building2 key="a" size={16} />], ['online', 'Online', <Globe2 key="b" size={16} />], ['hybrid', 'Presencial y online', <Shuffle key="c" size={16} />]] as const).map(([value, label, icon]) => (
                      <button key={value} type="button" role="radio" aria-checked={d.modality === value} onClick={() => detail('modality', value)}>{icon}{label}</button>
                    ))}
                  </div>
                </div>
                {d.modality !== 'online' && <>
                  <Field title="Lugar *" hint="Ej.: Centro de eventos Casa ARM"><input value={d.location} onChange={(e) => detail('location', e.target.value)} maxLength={200} /></Field>
                  <Field title="Dirección" hint="Se usa para el botón «Cómo llegar»."><input value={d.address} onChange={(e) => detail('address', e.target.value)} maxLength={400} /></Field>
                </>}
              </Card>
              <Card icon={<Users size={18} />} title="¿Quién organiza?">
                <Field title="Campus organizador *"><select disabled={!options.access.global && !!initial.id} value={event.campusId || ''} onChange={(e) => change('campusId', Number(e.target.value))}><option value="">Elige el campus</option>{options.campuses.filter((c) => options.access.global || c.id === user?.campusId || c.id === initial.campusId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
                <Field title="Responsable *"><select disabled={!editableOwner} value={event.organizerId || ''} onChange={(e) => change('organizerId', Number(e.target.value))}><option value="">Elige al responsable</option>{options.organizers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
                <div className={s.wide}>
                  <span className={x.miniLabel}>Campus que pueden inscribirse *</span>
                  <p className={x.help}>Cada persona elige uno de estos al inscribirse y se muestran en la portada. No dan permisos de administración.</p>
                  <div className={x.chipPicker}>
                    {options.campuses.map((c) => { const on = event.campusIds.includes(c.id); return <button key={c.id} type="button" aria-pressed={on} onClick={() => change('campusIds', on ? event.campusIds.filter((cid) => cid !== c.id) : [...event.campusIds, c.id])}>{on && <Check size={14} />}{c.name}</button>; })}
                  </div>
                </div>
              </Card>
            </>}

            {tab === 1 && <>
              <Card icon={<ImageIcon size={18} />} title="Imagen y color de portada" text="Una buena imagen hace que el evento se sienta real. Sin imagen, la portada usa el color elegido.">
                <CoverPicker value={d.bannerUrl} onChange={(url) => detail('bannerUrl', url)} />
                <div className={s.wide}>
                  <span className={x.miniLabel}>Color del evento</span>
                  <div className={x.swatches} role="radiogroup" aria-label="Color del evento">
                    {EVENT_COLORS.map((c) => <button key={c.value} type="button" role="radio" aria-checked={d.color.toLowerCase() === c.value} aria-label={c.name} title={c.name} style={{ background: c.value }} onClick={() => detail('color', c.value)}>{d.color.toLowerCase() === c.value && <Check size={16} />}</button>)}
                    <label className={x.customColor} title="Otro color"><input type="color" aria-label="Otro color" value={d.color} onChange={(e) => detail('color', e.target.value)} /><span>Otro</span></label>
                  </div>
                </div>
              </Card>
              <Card icon={<Sparkles size={18} />} title="La invitación" text="Escribe como si invitaras a una persona: breve, cálido y claro.">
                <Field title="Invitación breve" wide count={`${d.summary.length}/240`} hint="Aparece bajo el nombre, en grande."><textarea maxLength={240} rows={3} value={d.summary} onChange={(e) => detail('summary', e.target.value)} placeholder="Ej.: Un fin de semana para renovar la fe y la amistad entre hombres de todos los campus." /></Field>
                <Field title="Sobre el evento" wide hint="Qué vivirán, para quién es y qué necesitan saber."><textarea style={{ minHeight: 180 }} maxLength={15000} value={d.description} onChange={(e) => detail('description', e.target.value)} /></Field>
              </Card>
              <Card icon={<Check size={18} />} title="Preguntas frecuentes" text="Responde lo que siempre preguntan: qué llevar, alimentación, estacionamiento…">
                <div className={s.wide}>
                  {d.faqs.map((f, i) => (
                    <div className={x.faqItem} key={i}>
                      <Field title={`Pregunta ${i + 1}`} wide><input maxLength={200} value={f.question} onChange={(e) => detail('faqs', d.faqs.map((q, j) => j === i ? { ...q, question: e.target.value } : q))} /></Field>
                      <Field title="Respuesta" wide><textarea maxLength={2000} value={f.answer} onChange={(e) => detail('faqs', d.faqs.map((q, j) => j === i ? { ...q, answer: e.target.value } : q))} /></Field>
                      <button className={s.button} onClick={() => detail('faqs', d.faqs.filter((_, j) => j !== i))}><Trash2 size={15} />Quitar pregunta</button>
                    </div>
                  ))}
                  <button className={s.button} disabled={d.faqs.length >= 20} onClick={() => detail('faqs', [...d.faqs, { question: '', answer: '' }])}><Plus size={16} />Agregar pregunta</button>
                </div>
              </Card>
              <Card icon={<Check size={18} />} title="Condiciones" text="Se muestran en la portada y la persona las acepta al inscribirse.">
                <Field title="Condiciones y requisitos" wide><textarea maxLength={5000} value={d.conditions} onChange={(e) => detail('conditions', e.target.value)} placeholder="Ej.: Trae tu identificación y ropa cómoda." /></Field>
                <Field title="Política de cancelación" wide><textarea maxLength={5000} value={d.cancellationPolicy} onChange={(e) => detail('cancellationPolicy', e.target.value)} placeholder="Ej.: Puedes cancelar hasta 7 días antes; el equipo gestiona la devolución." /></Field>
              </Card>
            </>}

            {tab === 2 && <>
              <Card icon={<Ticket size={18} />} title="¿Cómo se participa?" text="Con «Pagado», la entrada se confirma solo cuando Mercado Pago aprueba el pago.">
                <div className={`${s.wide} ${x.choiceCards}`} role="radiogroup" aria-label="Tipo de acceso">
                  <button type="button" role="radio" aria-checked={d.pricing === 'paid'} onClick={() => { detail('pricing', 'paid'); if (!event.ticketTypes.length) change('ticketTypes', [{ name: 'Entrada general', price: 0, currency: 'CLP', maxPerOrder: 10 }]); }}><b>Pagado</b><span>Reserva el cupo y paga con Mercado Pago.</span></button>
                  <button type="button" role="radio" aria-checked={d.pricing === 'free'} onClick={() => { detail('pricing', 'free'); change('ticketTypes', event.ticketTypes.map((t) => ({ ...t, price: 0 }))); }}><b>Gratuito</b><span>Se confirma el cupo sin pago.</span></button>
                </div>
                {d.pricing === 'paid' && <div className={s.wide}>
                  <div className={s.notice}>{options.paymentMode === 'production' ? 'Mercado Pago Chile · Pagos reales.' : options.paymentMode === 'test' ? 'Mercado Pago Chile · Modo de prueba: no uses tarjetas reales.' : 'Mercado Pago aún no está configurado: nadie podrá pagar.'} Cada reserva dura hasta 24 horas; si no se paga, el cupo se libera solo.</div>
                  <div className={x.inlineCheck}>
                    <button type="button" className={s.button} disabled={paymentCheck.isPending} onClick={() => paymentCheck.mutate()}>{paymentCheck.isPending ? 'Comprobando…' : 'Comprobar conexión de pagos'}</button>
                    {paymentCheck.isSuccess && <p role="status" className={s.success}>{paymentCheck.data.mode === 'production' ? 'Producción' : 'Pruebas'} · Cuenta {paymentCheck.data.collectorId}. {paymentCheck.data.message}</p>}
                    {paymentCheck.isError && <p role="alert" className={s.error}>{apiErrorMessage(paymentCheck.error, 'No se pudo verificar la configuración de pagos.')}</p>}
                  </div>
                </div>}
                <TicketsEditor tickets={event.ticketTypes} paid={d.pricing === 'paid'} onChange={(next) => change('ticketTypes', next)} />
                <Field title="Cupos totales del evento" hint="Vacío: sin límite. Cada tipo de entrada puede tener además su propio cupo."><input type="number" min={1} max={1000000} value={event.capacity ?? ''} onChange={(e) => change('capacity', e.target.value ? Number(e.target.value) : null)} /></Field>
                {event.id && <p className={`${x.help} ${s.wide}`}>¿Descuentos o acceso a entradas ocultas? Crea códigos en <Link href={`/dashboard/eventos/${event.id}/codigos`}><b>Códigos de descuento</b></Link>.</p>}
              </Card>
              <Card icon={<CalendarDays size={18} />} title="¿Cuándo y quién puede inscribirse?" text="Sin fechas, se puede inscribir desde que publicas hasta el inicio del evento.">
                {dateField('Abrir inscripciones desde', 'registrationOpensAt', 'Vacío: desde que publicas.')}{dateField('Cerrar inscripciones el', 'registrationClosesAt', d.pricing === 'paid' ? 'También cierra las compras nuevas.' : 'Vacío: hasta el inicio del evento.')}
                <Field title="Edad mínima" hint="Opcional. Se pide la edad de cada asistente."><input type="number" min={0} max={120} value={d.minimumAge ?? ''} onChange={(e) => detail('minimumAge', e.target.value ? Number(e.target.value) : null)} /></Field>
                <label className={`${s.check} ${s.wide}`}><input type="checkbox" checked={d.waitlist} onChange={(e) => detail('waitlist', e.target.checked)} />Abrir lista de espera cuando se agoten los cupos</label>
                {d.waitlist && <p className={x.help + ' ' + s.wide}>Cuando se libera un cupo pasa solo a la siguiente persona{d.pricing === 'paid' ? ', que recibe 24 horas para pagar' : ''}.</p>}
              </Card>
              <Card icon={<Users size={18} />} title="Datos de cada asistente" text="Siempre se pide nombre y apellido. Agrega lo que necesites: talla de polera, alergias, contacto de emergencia…">
                <QuestionsEditor questions={d.questions ?? []} onChange={(next) => detail('questions', next)} />
              </Card>
              <Card icon={<Mail size={18} />} title="Correos y cambios" text="Las entradas llegan por correo con la portada y el color del evento.">
                <Field title="Nombre del remitente" hint="Ej.: AR Hombres. Vacío: Ecosistema ARM."><input maxLength={80} value={d.senderName ?? ''} onChange={(e) => detail('senderName', e.target.value)} placeholder="AR Hombres" /></Field>
                <Field title="Correo del remitente" hint="Solo direcciones @armglobal.org. Las respuestas llegan a este buzón."><input type="email" maxLength={254} value={d.senderEmail ?? ''} onChange={(e) => detail('senderEmail', e.target.value.trim())} placeholder="arhombres@armglobal.org" /></Field>
                {!!d.senderEmail && !/^[A-Za-z0-9._%+-]+@armglobal\.org$/i.test(d.senderEmail) && <p role="alert" className={`${s.error} ${s.wide}`}>Usa un correo que termine en @armglobal.org.</p>}
                <label className={s.check + ' ' + s.wide}><input type="checkbox" checked={d.reminders ?? true} onChange={(e) => detail('reminders', e.target.checked)} />Enviar recordatorios automáticos por correo una semana y un día antes, con las entradas</label>
                <label className={s.check + ' ' + s.wide}><input type="checkbox" checked={d.selfTransfer ?? true} onChange={(e) => detail('selfTransfer', e.target.checked)} />Puede transferir su entrada a otra persona (el código QR anterior deja de servir)</label>
                <label className={s.check + ' ' + s.wide}><input type="checkbox" checked={d.selfCancel ?? d.pricing !== 'paid'} onChange={(e) => detail('selfCancel', e.target.checked)} />Puede cancelar su entrada y liberar el cupo{d.pricing === 'paid' ? ' (la devolución del dinero la gestiona el equipo)' : ''}</label>
                {((d.selfTransfer ?? true) || (d.selfCancel ?? d.pricing !== 'paid')) && <Field title="Hasta cuántas horas antes del inicio" hint="Después de ese plazo, los cambios los hace el equipo."><input type="number" min={0} max={720} value={d.selfServiceHours ?? 24} onChange={(e) => detail('selfServiceHours', e.target.value === '' ? 24 : Number(e.target.value))} /></Field>}
                <label className={s.check + ' ' + s.wide}><input type="checkbox" checked={d.survey ?? true} onChange={(e) => detail('survey', e.target.checked)} />Enviar una encuesta de satisfacción al día siguiente del evento (anónima)</label>
                {(d.survey ?? true) && <Field title="Pregunta propia de la encuesta" wide hint="Opcional. Se suma a calificación, recomendación, lo mejor y qué mejorar."><input maxLength={200} value={d.surveyQuestion ?? ''} onChange={(e) => detail('surveyQuestion', e.target.value)} placeholder="Ej.: ¿Qué tema te gustaría para el próximo retiro?" /></Field>}
              </Card>
            </>}

            {tab === 3 && <>
              <section className={x.card}>
                <header><span className={x.cardIcon} aria-hidden="true"><Check size={18} /></span><div><h3>Lista para publicar</h3><p>{ready === required.length ? 'Todo lo necesario está completo.' : `Faltan ${required.length - ready} de ${required.length} puntos.`}</p></div></header>
                <ul className={x.checklist}>
                  {readiness.map((r) => (
                    <li key={r.key} className={r.done ? x.itemDone : ''}>
                      {r.done ? <Check size={17} aria-hidden="true" /> : <CircleDashed size={17} aria-hidden="true" />}
                      <span>{r.label}{!r.required && <small> · recomendado</small>}</span>
                      {!r.done && <button type="button" onClick={() => go(r.step)}>Completar</button>}
                    </li>
                  ))}
                </ul>
                {savedStatus === 'draft' && state === 'draft' && (
                  <div className={x.publishNow}>
                    <button type="button" className={s.primary} disabled={ready < required.length || save.isPending || (!initial.id && !access.create)} onClick={publishNow}><Ticket size={16} />{save.isPending ? 'Publicando…' : 'Publicar y abrir inscripciones'}</button>
                    <p className={x.help}>{ready < required.length ? 'Completa los puntos pendientes para poder publicar.' : d.pricing === 'paid' ? 'La portada queda pública y las personas pueden inscribirse y pagar con Mercado Pago.' : 'La portada queda pública y las personas pueden inscribirse.'}</p>
                  </div>
                )}
              </section>
              <section className={x.card} aria-labelledby="event-state-title">
                <header><span className={x.cardIcon} aria-hidden="true"><Eye size={18} /></span><div><h3 id="event-state-title">¿Qué ven las personas?</h3><p>Una sola elección para la portada y las inscripciones.</p></div></header>
                <div className={x.stateList} role="radiogroup" aria-labelledby="event-state-title">
                  {PUBLISH_STATES.filter((p) => wasLive || !['finished', 'cancelled'].includes(p.value)).map((p) => (
                    <button key={p.value} type="button" role="radio" aria-checked={state === p.value} onClick={() => setState(p.value)}>
                      <span className={x.radioDot} aria-hidden="true" /><span><b>{p.title}</b><small>{p.text}</small></span>
                    </button>
                  ))}
                </div>
                {state !== 'draft' && ready < required.length && <div className={s.notice}>Para publicar falta: {missingToPublish(event).map((m) => m.label.toLowerCase()).join(', ')}.</div>}
                {state === 'open' && d.pricing === 'paid' && options.paymentMode !== 'production' && <div className={s.notice}>{options.paymentMode === 'test' ? 'Mercado Pago está en modo de prueba: los pagos no son reales.' : 'Mercado Pago no está configurado: nadie podrá pagar.'}</div>}
                <p className={x.help}>Los cambios se aplican al guardar. Guardar no envía correos.</p>
              </section>
              <section className={x.card}>
                <header><span className={x.cardIcon} aria-hidden="true"><Save size={18} /></span><div><h3>Últimos cambios</h3></div></header>
                {initial.audit?.length ? initial.audit.map((a, i) => <div key={i} className={s.audit}>{a.actor} · {a.action}<br />Versión {a.version} · {new Date(a.createdAt).toLocaleString('es-CL')}</div>) : <p className={x.help}>El historial comienza al guardar este evento.</p>}
              </section>
            </>}

            <nav className={x.stepNav} aria-label="Navegación entre pasos">
              {tab > 0 ? <button type="button" className={s.button} onClick={() => go(tab - 1)}><ArrowLeft size={16} />{STEPS[tab - 1].title}</button> : <span />}
              {tab < 3 && <button type="button" className={s.button} onClick={() => go(tab + 1)}>Siguiente: {STEPS[tab + 1].title}<ArrowRight size={16} /></button>}
            </nav>
          </section>
          <aside className={x.side} aria-label="Vista previa en vivo">
            <p className={x.sideTitle}><Eye size={15} aria-hidden="true" />Vista previa en vivo</p>
            {live}
          </aside>
        </div>
      )}

      <div className={s.savebar}>
        <p>{dirty ? 'Tienes cambios sin guardar' : `Versión ${event.version} · ${eventStatuses[event.status]}`}</p>
        <button className={s.button} onClick={() => setPreview(!preview)}><Eye size={16} />{preview ? 'Editar' : 'Vista previa'}</button>
        <button className={s.primary} disabled={save.isPending || (!initial.id && !access.create)} onClick={() => { setError(''); save.mutate(undefined); }}><Save size={16} />{save.isPending ? 'Guardando…' : event.status === 'draft' ? 'Guardar evento' : savedStatus === 'draft' ? 'Guardar y publicar' : 'Guardar cambios'}</button>
      </div>
    </>
  );
}
