'use client';
// Mensajes del equipo a los inscritos: a quién, una prueba primero, y el historial de envíos.
import { FormEvent, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Users } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { EventShell } from './EventWorkspace';
import { EventSubnav } from './EventSubnav';
import { EventProgram } from './event-types';
import i from './event-insights.module.css';

export const AUDIENCE_LABELS: Record<string, string> = {
  confirmed: 'Entradas confirmadas', all: 'Todas las inscripciones vigentes (confirmadas, por pagar y en espera)', not_checked_in: 'Confirmadas que aún no ingresan',
  checked_in: 'Quienes ya ingresaron', pending: 'Reservas por pagar', waitlisted: 'Lista de espera',
};
type Message = { id: string; subject: string; body: string; audience: { audience: string }; recipients: number; sent: number; failed: number; createdAt: string; sentBy: string };

export function EventMessages({ id }: { id: string }) {
  const qc = useQueryClient();
  const event = useQuery({ queryKey: ['event-program', id], queryFn: async () => (await api.get<EventProgram & { campusOptions?: never }>(`/event-management/${id}`)).data });
  const history = useQuery({ queryKey: ['event-messages', id], queryFn: async () => (await api.get<Message[]>(`/event-management/${id}/messages`)).data });
  const [form, setForm] = useState({ subject: '', body: '', audience: 'confirmed', ticketTypeId: '' });
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<'' | 'test' | 'send'>('');
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const filters = { audience: form.audience, ...(form.ticketTypeId ? { ticketTypeId: form.ticketTypeId } : {}) };

  useEffect(() => {
    let alive = true; setCount(null); setConfirming(false);
    api.post<{ recipients: number }>(`/event-management/${id}/messages`, { subject: 'x', body: 'x', ...filters, dryRun: true }).then((r) => { if (alive) setCount(r.data.recipients); }).catch(() => { if (alive) setCount(null); });
    return () => { alive = false; };
  }, [id, form.audience, form.ticketTypeId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(kind: 'test' | 'send') {
    setBusy(kind); setNote(null);
    try {
      const { data } = await api.post<{ message: string }>(`/event-management/${id}/messages`, { subject: form.subject, body: form.body, ...filters, ...(kind === 'test' ? { test: true } : {}) });
      setNote({ tone: 'ok', text: data.message });
      if (kind === 'send') { setForm((f) => ({ ...f, subject: '', body: '' })); setConfirming(false); await qc.invalidateQueries({ queryKey: ['event-messages', id] }); }
    } catch (err) { setNote({ tone: 'error', text: apiErrorMessage(err, 'No pudimos enviar el mensaje.') }); }
    finally { setBusy(''); }
  }
  const ready = form.subject.trim() && form.body.trim();
  const submit = (e: FormEvent) => { e.preventDefault(); if (ready) setConfirming(true); };

  return (
    <EventShell title={event.data?.title ?? 'Mensajes'} description="Avisos a quienes se inscribieron: cambios de horario, qué traer, recordatorios.">
      <EventSubnav id={id} />
      <div className={i.two}>
        <form className={i.card} onSubmit={submit} aria-labelledby="msg-title">
          <h2 id="msg-title">Nuevo mensaje</h2>
          <label className={i.field}><span>Para</span>
            <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>{Object.entries(AUDIENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {(event.data?.ticketTypes.length ?? 0) > 1 && <label className={i.field}><span>Solo de la entrada</span>
            <select value={form.ticketTypeId} onChange={(e) => setForm({ ...form, ticketTypeId: e.target.value })}><option value="">Todas las entradas</option>{event.data!.ticketTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
          <p className={i.count} aria-live="polite"><Users size={15} aria-hidden="true" />{count == null ? 'Contando destinatarios…' : count === 1 ? 'Llegará a 1 persona.' : `Llegará a ${count} personas.`}</p>
          <label className={i.field}><span>Asunto</span><input required maxLength={150} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ej.: Cambio de horario del sábado" /></label>
          <label className={i.field}><span>Mensaje</span><textarea required maxLength={5000} rows={9} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={'Hola:\n\nTe escribimos para contarte que…'} />
            <small>Texto simple; deja una línea en blanco entre párrafos. Se envía con la portada y el color del evento, y un botón a la página del evento.</small></label>
          {note && <p className={note.tone === 'ok' ? i.ok : i.error} role={note.tone === 'ok' ? 'status' : 'alert'}>{note.text}</p>}
          {confirming ? (
            <div className={i.confirm} role="group" aria-label="Confirmar envío">
              <p>¿Enviar «{form.subject}» a <b>{count ?? '…'} personas</b>? Esto no se puede deshacer.</p>
              <div className={i.actions}><button type="button" className={i.secondary} onClick={() => setConfirming(false)}>Revisar</button><button type="button" className={i.primary} disabled={busy !== ''} onClick={() => void send('send')}><Send size={15} aria-hidden="true" />{busy === 'send' ? 'Enviando…' : 'Sí, enviar ahora'}</button></div>
            </div>
          ) : (
            <div className={i.actions}>
              <button type="button" className={i.secondary} disabled={!ready || busy !== ''} onClick={() => void send('test')}>{busy === 'test' ? 'Enviando prueba…' : 'Enviarme una prueba'}</button>
              <button className={i.primary} disabled={!ready || !count}>Revisar y enviar</button>
            </div>
          )}
        </form>
        <section className={i.card} aria-labelledby="msg-history">
          <h2 id="msg-history">Enviados</h2>
          {history.data?.length === 0 && <p className={i.empty}>Aún no se han enviado mensajes.</p>}
          <ul className={i.history}>
            {history.data?.map((m) => (
              <li key={m.id}>
                <b>{m.subject}</b>
                <span>{new Date(m.createdAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })} · {m.sentBy}</span>
                <span>{AUDIENCE_LABELS[m.audience?.audience] ?? 'Inscritos'} · {m.sent} de {m.recipients} enviados{m.failed ? ` · ${m.failed} con error` : ''}</span>
                <details><summary>Ver mensaje</summary><p>{m.body}</p></details>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </EventShell>
  );
}
