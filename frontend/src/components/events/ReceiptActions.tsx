'use client';
// Acciones de quien compró sobre sus entradas: transferir a otra persona o cancelar.
// Solo aparecen si el evento lo permite y antes del plazo; el servidor vuelve a comprobarlo.
import { FormEvent, useState } from 'react';
import axios from 'axios';
import { Send, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { momentLabel } from './event-helpers';
import c from './event-checkout.module.css';

export type SelfService = { transfer: boolean; cancel: boolean; until: string; open: boolean };
type Ticket = { id: string; name: string; checkedIn?: boolean; transferred?: boolean };
const post = async <T,>(path: string, body: unknown) => (await axios.post<T>(`${api.defaults.baseURL}${path}`, body)).data;

/** «Puedes transferir o cancelar tus entradas hasta el …», o nada si el evento no lo permite. */
export function selfServiceNote(policy: SelfService | null | undefined, timeZone?: string) {
  if (!policy || (!policy.transfer && !policy.cancel)) return '';
  const what = policy.transfer && policy.cancel ? 'transferir o cancelar' : policy.transfer ? 'transferir' : 'cancelar';
  return policy.open ? `Puedes ${what} tus entradas hasta el ${momentLabel(policy.until, timeZone)}.` : `El plazo para ${what} entradas terminó.`;
}

export function TicketActions<R>({ orderId, token, ticket, policy, onDone }: { orderId: string; token: string; ticket: Ticket; policy: SelfService | null | undefined; onDone: (receipt: R, message: string) => void }) {
  const [mode, setMode] = useState<'' | 'transfer' | 'cancel'>('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!policy?.open || ticket.checkedIn || (!policy.transfer && !policy.cancel)) return null;

  async function transfer(ev: FormEvent) {
    ev.preventDefault(); setBusy(true); setError('');
    try {
      const r = await post<R>(`/event-registrations/${orderId}/tickets/${ticket.id}/transfer`, { token, firstName: form.firstName, lastName: form.lastName, ...(form.email.trim() ? { email: form.email.trim() } : {}) });
      setMode(''); onDone(r, form.email.trim() ? `Entrada transferida a ${form.firstName} ${form.lastName}. Le enviamos su entrada a ${form.email.trim()}.` : `Entrada transferida a ${form.firstName} ${form.lastName}. Compártele el nuevo código QR.`);
    } catch (err) { setError(apiErrorMessage(err, 'No pudimos transferir la entrada.')); } finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true); setError('');
    try {
      const r = await post<R>(`/event-registrations/${orderId}/cancel`, { token, ticketId: ticket.id });
      setMode(''); onDone(r, `Cancelamos la entrada de ${ticket.name}. El cupo quedó libre para otra persona.`);
    } catch (err) { setError(apiErrorMessage(err, 'No pudimos cancelar la entrada.')); } finally { setBusy(false); }
  }

  return (
    <div className={c.ticketActions}>
      {!mode && <>
        {policy.transfer && <button type="button" className={c.textButton} onClick={() => setMode('transfer')}><Send size={14} aria-hidden="true" />Transferir a otra persona</button>}
        {policy.cancel && <button type="button" className={c.textButton} onClick={() => setMode('cancel')}><X size={14} aria-hidden="true" />Cancelar esta entrada</button>}
      </>}
      {mode === 'transfer' && (
        <form className={c.actionBox} onSubmit={transfer} aria-label={`Transferir la entrada de ${ticket.name}`}>
          <p>¿A quién le das esta entrada? El código QR actual dejará de servir y se crea uno nuevo.</p>
          <div className={c.grid}>
            <label className={c.field}><span>Nombre</span><input aria-label="Nombre de quien recibe" required maxLength={80} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
            <label className={c.field}><span>Apellido</span><input aria-label="Apellido de quien recibe" required maxLength={80} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
            <label className={`${c.field} ${c.wide}`}><span>Correo de quien recibe</span><input aria-label="Correo de quien recibe" type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><small>Opcional: le enviamos su entrada con el nuevo QR.</small></label>
          </div>
          {error && <p className={c.error} role="alert">{error}</p>}
          <div className={c.row}><button type="button" className={c.secondary} onClick={() => setMode('')}>Volver</button><button className={c.cta} disabled={busy}>{busy ? 'Transfiriendo…' : 'Transferir entrada'}</button></div>
        </form>
      )}
      {mode === 'cancel' && (
        <div className={c.actionBox} role="group" aria-label={`Cancelar la entrada de ${ticket.name}`}>
          <p>¿Cancelar la entrada de <b>{ticket.name}</b>? El cupo queda libre para otra persona y no se puede deshacer.</p>
          {error && <p className={c.error} role="alert">{error}</p>}
          <div className={c.row}><button type="button" className={c.secondary} onClick={() => setMode('')}>No, mantenerla</button><button type="button" className={c.danger} disabled={busy} onClick={() => void cancel()}>{busy ? 'Cancelando…' : 'Sí, cancelar entrada'}</button></div>
        </div>
      )}
    </div>
  );
}

/** Cancelar una reserva sin pagar o un lugar en la lista de espera (completa). */
export function CancelReservation<R>({ orderId, token, label, onDone }: { orderId: string; token: string; label: string; onDone: (receipt: R, message: string) => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function cancel() {
    setBusy(true); setError('');
    try { const r = await post<R>(`/event-registrations/${orderId}/cancel`, { token }); onDone(r, 'Cancelamos tu reserva. Si cambias de opinión, puedes inscribirte de nuevo mientras haya cupos.'); }
    catch (err) { setError(apiErrorMessage(err, 'No pudimos cancelar la reserva.')); } finally { setBusy(false); }
  }
  return asking ? (
    <div className={c.actionBox} role="group" aria-label={label}>
      <p>¿Seguro? Liberarás {label === 'Salir de la lista de espera' ? 'tu lugar en la lista de espera' : 'los cupos reservados'}.</p>
      {error && <p className={c.error} role="alert">{error}</p>}
      <div className={c.row}><button type="button" className={c.secondary} onClick={() => setAsking(false)}>No</button><button type="button" className={c.danger} disabled={busy} onClick={() => void cancel()}>{busy ? 'Cancelando…' : `Sí, ${label.toLowerCase()}`}</button></div>
    </div>
  ) : <button type="button" className={c.textButton} onClick={() => setAsking(true)}><X size={14} aria-hidden="true" />{label}</button>;
}
