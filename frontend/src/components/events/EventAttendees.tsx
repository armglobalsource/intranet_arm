'use client';
// Inscritos de un evento: resumen, búsqueda, ingreso manual, acciones del equipo y descarga a Excel.
import Link from 'next/link';
import { CSSProperties, FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Download, Mail, QrCode, Search, Undo2, UserPlus, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { EventShell } from './EventWorkspace';
import { EventSubnav } from './EventSubnav';
import { eventPrice } from './event-types';
import {
  AttendanceData, Attendee, AttendeeFilter, CheckInReply, STATUS_LABELS, VERIFIABLE,
  answerText, boughtBy, clock, exportRows, fileSlug, filterAttendees, fullName, summarize,
} from './attendance';
import a from './event-attendance.module.css';

type Note = { tone: 'ok' | 'error'; text: string };
const money = (n: number) => eventPrice({ name: '', price: n, currency: 'CLP' });

export function useAttendance(id: string, refetchInterval?: number) {
  return useQuery({
    queryKey: ['event-attendees', id],
    queryFn: async () => (await api.get<AttendanceData>(`/event-management/${id}/attendees`)).data,
    refetchInterval,
  });
}

export function EventAttendees({ id }: { id: string }) {
  const qc = useQueryClient();
  const query = useAttendance(id);
  const [filter, setFilter] = useState<AttendeeFilter>({ search: '', status: '', campus: '', presence: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [banner, setBanner] = useState<Note | null>(null);

  const data = query.data;
  const list = useMemo(() => data?.registrations ?? [], [data]);
  const shown = useMemo(() => filterAttendees(list, filter), [list, filter]);
  const stats = useMemo(() => summarize(list, data?.event.capacity ?? null), [list, data]);
  const tz = data?.event.timezone;
  const paid = list.some((r) => Number(r.amount) > 0);

  /** Reemplaza una fila sin recargar toda la lista. */
  function patch(next: Attendee | null | undefined) {
    if (!next) return;
    qc.setQueryData<AttendanceData>(['event-attendees', id], (old) => old && { ...old, registrations: old.registrations.map((r) => (r.id === next.id ? next : r)) });
  }
  async function act(rowId: string, run: () => Promise<Note | void>) {
    setBusy(rowId);
    try {
      const note = await run();
      if (note) setNotes((n) => ({ ...n, [rowId]: note }));
    } catch (err) {
      setNotes((n) => ({ ...n, [rowId]: { tone: 'error', text: apiErrorMessage(err, 'No se pudo completar la acción. Inténtalo de nuevo.') } }));
    } finally { setBusy(null); }
  }
  const checkIn = (r: Attendee) => act(r.id, async () => {
    const { data: reply } = await api.post<CheckInReply>(`/event-management/${id}/check-in`, { code: r.ticketCode ?? r.id });
    patch(reply.attendee);
    return { tone: reply.result === 'ok' ? 'ok' : 'error', text: reply.result === 'ok' ? 'Ingreso registrado.' : reply.message };
  });
  const undo = (r: Attendee) => act(r.id, async () => {
    const { data: reply } = await api.post<{ attendee: Attendee }>(`/event-management/${id}/registrations/${r.id}/undo-check-in`);
    patch(reply.attendee);
    return { tone: 'ok', text: 'Ingreso deshecho.' };
  });
  const resend = (r: Attendee) => act(r.id, async () => {
    const { data: reply } = await api.post<{ message: string }>(`/event-management/${id}/registrations/${r.id}/resend`);
    return { tone: 'ok', text: reply.message };
  });
  /** Solo entradas con pago de Mercado Pago, monto y sin devolver; requiere el permiso de devolución. */
  const canRefund = (r: Attendee) => !!data?.canRefund && !!r.paymentId && Number(r.amount) > 0 && !r.refundedAt && ['confirmed', 'payment_review', 'cancelled'].includes(r.status);
  const refund = (r: Attendee, wholeOrder: boolean) => act(r.id, async () => {
    const { data: reply } = await api.post<{ message: string }>(`/event-management/${id}/registrations/${r.id}/refund`, { wholeOrder });
    setRefunding(null);
    await query.refetch();
    return { tone: 'ok', text: reply.message };
  });
  const cancel = (r: Attendee) => act(r.id, async () => {
    setConfirming(null);
    const { data: reply } = await api.post<{ attendee: Attendee; message: string }>(`/event-management/${id}/registrations/${r.id}/cancel`);
    patch(reply.attendee);
    return { tone: 'ok', text: reply.message };
  });
  const verify = (r: Attendee) => act(r.id, async () => {
    const { data: reply } = await api.post<{ status: string; message: string }>(`/event-management/${id}/registrations/${r.id}/verify-payment`);
    await query.refetch();
    return { tone: reply.status === 'confirmed' ? 'ok' : 'error', text: reply.message };
  });

  async function download() {
    if (!data) return;
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.json_to_sheet(exportRows(shown, tz, data.event.questions));
    sheet['!cols'] = [14, 16, 28, 16, 6, 16, 18, 16, 10, 18, 22, 8, 16, 18, 18, 24, 22, 28, 16, 38, ...(data.event.questions ?? []).map(() => 20), 38].map((wch) => ({ wch }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Inscritos');
    XLSX.writeFile(book, `inscritos-${fileSlug(data.event.title)}.xlsx`);
  }

  const color = data?.event.color && /^#[0-9a-f]{6}$/i.test(data.event.color) ? data.event.color : '#96523f';
  return (
    <EventShell door title={data?.event.title ?? 'Inscritos'} description="Quién viene, quién ya llegó y qué falta por resolver.">
      <EventSubnav id={id} manage={data?.manage ?? false} />
      <div className={a.page} style={{ '--event-color': color } as CSSProperties}>
        <div className={a.top}>
          <div>
            <p className={a.eyebrow}>Inscritos</p>
            <h2 className={a.title}>{list.length ? `${list.length} ${list.length === 1 ? 'inscripción' : 'inscripciones'}` : 'Inscripciones'}</h2>
          </div>
          <div className={a.toolbarActions}>
            <Link className={a.btn} href={`/dashboard/eventos/${id}/acceso`}><QrCode size={16} aria-hidden="true" />Control de acceso</Link>
            <button type="button" className={a.btn} onClick={() => void download()} disabled={!shown.length}><Download size={16} aria-hidden="true" />Descargar Excel</button>
            {data?.manage && <button type="button" className={a.btnPrimary} onClick={() => setAdding(true)}><UserPlus size={16} aria-hidden="true" />Agregar persona</button>}
          </div>
        </div>

        {query.isPending && <p role="status" className={a.count}>Cargando inscritos…</p>}
        {query.isError && <div role="alert" className={a.notice} data-tone="error">{apiErrorMessage(query.error, 'No pudimos cargar los inscritos.')}<button type="button" className={`${a.btn} ${a.small}`} onClick={() => query.refetch()}>Reintentar</button></div>}
        {banner && <div role="status" className={a.notice} data-tone={banner.tone}>{banner.text}<button type="button" className={a.btnGhost} aria-label="Cerrar aviso" onClick={() => setBanner(null)}><X size={15} /></button></div>}

        {data && <>
          <div className={a.metrics}>
            <div className={a.metric}><strong>{stats.confirmed}</strong><span>Entradas confirmadas{stats.courtesy ? ` · ${stats.courtesy} del equipo` : ''}</span></div>
            <div className={a.metric}><strong>{stats.checkedIn}</strong><span>Ingresaron</span><div className={a.meter} aria-hidden="true"><i style={{ width: `${stats.confirmed ? Math.round((stats.checkedIn / stats.confirmed) * 100) : 0}%` }} /></div></div>
            <div className={a.metric}><strong>{stats.capacityLeft ?? '—'}</strong><span>{stats.capacityLeft == null ? 'Sin límite de cupos' : `Cupos libres de ${data.event.capacity}`}</span></div>
            <div className={a.metric}><strong>{stats.pending + stats.waitlisted}</strong><span>{stats.pending} pago pendiente · {stats.waitlisted} en espera</span></div>
            <div className={a.metric}><strong>{paid ? money(stats.revenue) : 'Gratis'}</strong><span>{paid ? 'Recaudado (pagos reales)' : 'Evento sin cobro'}</span></div>
          </div>

          <div className={a.filters}>
            <label className={a.searchBox}><span className="sr-only">Buscar persona</span><Search size={17} aria-hidden="true" />
              <input type="search" value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} placeholder="Buscar por nombre, correo, teléfono o código" /></label>
            <label><span className="sr-only">Estado</span><select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
              <option value="">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label><span className="sr-only">Campus</span><select value={filter.campus} onChange={(e) => setFilter({ ...filter, campus: e.target.value })}>
              <option value="">Todos los campus</option>{Array.from(new Map(list.map((r) => [String(r.campusId), r.campusName])).entries()).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label><span className="sr-only">Asistencia</span><select value={filter.presence} onChange={(e) => setFilter({ ...filter, presence: e.target.value as AttendeeFilter['presence'] })}>
              <option value="">Con y sin ingreso</option><option value="in">Ya ingresaron</option><option value="out">Aún no llegan</option></select></label>
          </div>
          <p className={a.count} aria-live="polite">{shown.length === list.length ? `${list.length} personas` : `${shown.length} de ${list.length} personas`}</p>

          <div className={a.tableWrap}>
            {!shown.length ? <p className={a.empty}>{list.length ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay inscripciones.'}</p> : (
              <table className={a.table}>
                <thead><tr><th>Persona</th><th>Entrada</th><th>Estado</th><th>Ingreso</th>{data.manage && <th><span className="sr-only">Acciones</span></th>}</tr></thead>
                <tbody>
                  {shown.map((r) => {
                    const note = notes[r.id];
                    return (
                      <tr key={r.id}>
                        <td className={a.person}><strong>{fullName(r)}</strong><span>{r.email}</span>{r.phone && <span>{r.phone}</span>}<span>{r.campusName}</span>{boughtBy(r) && <span>Compra de {boughtBy(r)}</span>}{(data.event.questions ?? []).filter((q) => answerText(r.answers?.[q.id]) !== '').map((q) => <span key={q.id} className={a.answer}>{q.label}: <b>{answerText(r.answers?.[q.id])}</b></span>)}</td>
                        <td data-label="Entrada">{r.ticketName ?? '—'}<br /><span className={a.tagMuted}>{Number(r.amount) > 0 ? money(Number(r.amount)) : r.source === 'manual' ? `Agregada por ${r.createdBy ?? 'el equipo'}` : 'Sin costo'}</span>{r.note && <div className={a.tagMuted}>«{r.note}»</div>}</td>
                        <td data-label="Estado"><span className={a.tag} data-status={r.status}>{STATUS_LABELS[r.status] ?? r.status}</span>{r.testPayment && <span className={a.tagMuted}>Prueba</span>}{r.transferredAt && <span className={a.tagMuted}>Transferida</span>}{r.refundedAt && <span className={a.tagMuted}>Devuelta</span>}{r.paymentId && <div className={a.tagMuted}>Pago N° {r.paymentId}</div>}</td>
                        <td data-label="Ingreso">
                          <div className={a.presence}>
                            {r.checkedInAt
                              ? <><span className={a.inside}><Check size={15} aria-hidden="true" />{clock(r.checkedInAt, tz)} <small>{r.checkedInBy ? `· ${r.checkedInBy}` : ''}</small></span>
                                <button type="button" className={`${a.btnGhost} ${a.small}`} disabled={busy === r.id} onClick={() => void undo(r)}>Deshacer</button></>
                              : r.status === 'confirmed'
                                ? <button type="button" className={`${a.btn} ${a.small}`} disabled={busy === r.id} onClick={() => void checkIn(r)}>Marcar ingreso</button>
                                : <span className={a.tagMuted}>Sin entrada válida</span>}
                          </div>
                        </td>
                        {data.manage && (
                          <td>
                            {refunding === r.id
                              ? <RefundBox r={r} busy={busy === r.id} onCancel={() => setRefunding(null)} onConfirm={(whole) => void refund(r, whole)} />
                              : confirming === r.id
                              ? <div className={a.confirmBox}>¿Anular la inscripción de {r.firstName}?
                                <button type="button" className={`${a.btnDanger} ${a.small}`} disabled={busy === r.id} onClick={() => void cancel(r)}>Sí, anular</button>
                                <button type="button" className={`${a.btnGhost} ${a.small}`} onClick={() => setConfirming(null)}>No</button></div>
                              : <div className={a.rowActions}>
                                {Number(r.amount) > 0 && VERIFIABLE.includes(r.status) && <button type="button" className={`${a.btn} ${a.small}`} disabled={busy === r.id} onClick={() => void verify(r)}>{busy === r.id ? 'Consultando…' : 'Verificar pago'}</button>}
                                {!['cancelled', 'expired'].includes(r.status) && <button type="button" className={`${a.btnGhost} ${a.small}`} disabled={busy === r.id} onClick={() => void resend(r)}><Mail size={14} aria-hidden="true" />{r.status === 'confirmed' ? 'Reenviar entrada' : 'Reenviar correo'}</button>}
                                {canRefund(r) && <button type="button" className={`${a.btnGhost} ${a.small}`} disabled={busy === r.id} onClick={() => { setConfirming(null); setRefunding(r.id); }}><Undo2 size={14} aria-hidden="true" />Devolver {money(Number(r.amount))}</button>}
                                {r.status !== 'cancelled' && <button type="button" className={`${a.btnGhost} ${a.small}`} disabled={busy === r.id} onClick={() => setConfirming(r.id)}>Anular</button>}
                              </div>}
                            {note && <p className={a.rowNote} data-tone={note.tone} role={note.tone === 'ok' ? 'status' : 'alert'}>{note.text}</p>}
                          </td>
                        )}
                        {!data.manage && note && <td><p className={a.rowNote} data-tone={note.tone}>{note.text}</p></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>}
        {adding && data && <AddPersonDialog id={id} data={data} onClose={() => setAdding(false)} onAdded={(r, emailSent) => {
          setAdding(false);
          qc.setQueryData<AttendanceData>(['event-attendees', id], (old) => old && { ...old, registrations: [r, ...old.registrations] });
          setBanner({ tone: 'ok', text: `${fullName(r)} quedó inscrita/o con entrada confirmada.${emailSent ? ` Le enviamos la entrada a ${r.email}.` : ''}` });
        }} />}
      </div>
    </EventShell>
  );
}

/** Confirmación de devolución: monto de la entrada o, si la compra tiene más, todo lo que queda por devolver. */
function RefundBox({ r, busy, onCancel, onConfirm }: { r: Attendee; busy: boolean; onCancel: () => void; onConfirm: (wholeOrder: boolean) => void }) {
  const remaining = Number(r.orderAmount ?? r.amount) - Number(r.orderRefunded ?? 0);
  const [whole, setWhole] = useState(false);
  const amount = whole ? remaining : Math.min(Number(r.amount), remaining);
  return (
    <div className={a.refundBox} role="group" aria-label={'Devolver el pago de ' + fullName(r)}>
      <p>¿Devolver <b>{money(amount)}</b> a {r.buyerName || fullName(r)} con Mercado Pago? {whole ? 'Se anulan todas las entradas de la compra' : 'Se anula esta entrada'} y no se puede deshacer.</p>
      {remaining > Number(r.amount) && <label className={a.refundWhole}><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} />Devolver toda la compra ({money(remaining)})</label>}
      <div className={a.confirmBox}>
        <button type="button" className={a.btnDanger + ' ' + a.small} disabled={busy} onClick={() => onConfirm(whole)}>{busy ? 'Devolviendo…' : 'Sí, devolver'}</button>
        <button type="button" className={a.btnGhost + ' ' + a.small} onClick={onCancel}>No</button>
      </div>
    </div>
  );
}

function AddPersonDialog({ id, data, onClose, onAdded }: { id: string; data: AttendanceData; onClose: () => void; onAdded: (r: Attendee, emailSent: boolean) => void }) {
  const campuses = data.event.campuses;
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', campusId: campuses.length === 1 ? String(campuses[0].id) : '', ticketTypeId: '', note: '', sendEmail: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const body = { firstName: form.firstName, lastName: form.lastName, email: form.email, campusId: Number(form.campusId), sendEmail: form.sendEmail,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}), ...(form.ticketTypeId ? { ticketTypeId: form.ticketTypeId } : {}), ...(form.note.trim() ? { note: form.note.trim() } : {}) };
      const { data: reply } = await api.post<{ attendee: Attendee; emailSent: boolean }>(`/event-management/${id}/registrations`, body);
      onAdded(reply.attendee, reply.emailSent);
    } catch (err) {
      setError(apiErrorMessage(err, 'No pudimos agregar a esta persona. Revisa los datos.'));
    } finally { setSaving(false); }
  }
  return (
    <div className={a.overlay} role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className={a.dialog} role="dialog" aria-modal="true" aria-labelledby="add-person-title" onSubmit={submit} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
        <h2 id="add-person-title">Agregar persona</h2>
        <p className={a.sub}>Para cortesías, equipo de servicio o pagos fuera de línea. Queda con entrada confirmada y sin cobro.</p>
        <div className={a.grid2}>
          <label className={a.field}>Nombre<input required maxLength={80} value={form.firstName} onChange={set('firstName')} autoFocus /></label>
          <label className={a.field}>Apellido<input required maxLength={80} value={form.lastName} onChange={set('lastName')} /></label>
          <label className={`${a.field} ${a.wide}`}>Correo electrónico<input required type="email" maxLength={254} value={form.email} onChange={set('email')} /></label>
          <label className={a.field}>Teléfono <small>Opcional</small><input type="tel" value={form.phone} onChange={set('phone')} pattern="\+?[0-9 ()\-]{7,25}" /></label>
          <label className={a.field}>Campus<select required value={form.campusId} onChange={set('campusId')}>
            <option value="">Elige un campus</option>{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          {data.event.tickets.length > 0 && <label className={`${a.field} ${a.wide}`}>Entrada<select value={form.ticketTypeId} onChange={set('ticketTypeId')}>
            <option value="">{data.event.pricing === 'paid' ? 'Cortesía' : 'Entrada gratuita'}</option>{data.event.tickets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <small>Solo define el nombre de la entrada: no se cobra.</small></label>}
          <label className={`${a.field} ${a.wide}`}>Nota interna <small>Opcional · por ejemplo, «Pagó en efectivo»</small><textarea maxLength={300} value={form.note} onChange={set('note')} /></label>
          <label className={`${a.check} ${a.wide}`}><input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />Enviarle su entrada por correo</label>
        </div>
        {!campuses.length && <p className={a.notice} data-tone="info">Este evento no tiene campus participantes. Agrégalos en el editor del evento.</p>}
        {error && <p role="alert" className={a.notice} data-tone="error">{error}</p>}
        <div className={a.dialogActions}>
          <button type="button" className={a.btn} onClick={onClose}>Cancelar</button>
          <button className={a.btnPrimary} disabled={saving || !campuses.length}>{saving ? 'Agregando…' : 'Agregar persona'}</button>
        </div>
      </form>
    </div>
  );
}
