'use client';
// Códigos de descuento de un evento: porcentaje o monto por entrada, para todas o algunas
// entradas, con usos y vigencia. Un código con 0 de descuento sirve para desbloquear entradas ocultas.
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Pencil, Plus, Tag } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { EventShell } from './EventWorkspace';
import { DiscountCode, EventProgram, eventPrice } from './event-types';
import { isoDate, localDate } from './EventSalesEditor';
import s from './events.module.css';
import a from './event-attendance.module.css';
import v from './event-sales.module.css';

const blank: DiscountCode = { code: '', kind: 'percent', value: 10, maxUses: null, startsAt: null, endsAt: null, ticketTypeIds: [], active: true };
const money = (n: number) => eventPrice({ name: '', price: n, currency: 'CLP' });

export function describeDiscount(c: Pick<DiscountCode, 'kind' | 'value'>) {
  if (!c.value) return 'Solo da acceso';
  return c.kind === 'percent' ? `${c.value} % de descuento` : `${money(c.value)} menos por entrada`;
}

export function EventCodes({ id }: { id: string }) {
  const qc = useQueryClient();
  const event = useQuery({ queryKey: ['event-program', id], queryFn: async () => (await api.get<EventProgram>(`/event-management/${id}`)).data });
  const codes = useQuery({ queryKey: ['event-codes', id], queryFn: async () => (await api.get<DiscountCode[]>(`/event-management/${id}/codes`)).data });
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState('');
  const tickets = event.data?.ticketTypes ?? [];
  const nameOf = (tid: string) => tickets.find((t) => t.id === tid)?.name ?? 'Entrada eliminada';

  async function save(ev: FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    setSaving(true); setError('');
    try {
      const { id: codeId, uses: _u, given: _g, ...body } = editing;
      await (codeId ? api.patch(`/event-management/${id}/codes/${codeId}`, body) : api.post(`/event-management/${id}/codes`, body));
      await qc.invalidateQueries({ queryKey: ['event-codes', id] });
      setDone(`Código ${editing.code.toUpperCase()} guardado.`); setEditing(null);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el código.'));
    } finally { setSaving(false); }
  }
  async function toggle(c: DiscountCode) {
    const { id: codeId, uses: _u, given: _g, ...body } = c;
    try { await api.patch(`/event-management/${id}/codes/${codeId}`, { ...body, active: !c.active }); await qc.invalidateQueries({ queryKey: ['event-codes', id] }); setDone(`Código ${c.code} ${c.active ? 'desactivado' : 'activado'}.`); }
    catch (err) { setError(apiErrorMessage(err, 'No se pudo cambiar el código.')); }
  }

  const e = editing;
  const set = (patch: Partial<DiscountCode>) => setEditing((c) => (c ? { ...c, ...patch } : c));
  return (
    <EventShell title={event.data?.title ?? 'Códigos de descuento'} description="Descuentos para familias, becas, preventas o acceso a entradas reservadas.">
      <div className={a.page}>
        <div className={a.top}>
          <div>
            <Link className={a.back} href={`/dashboard/eventos/${id}`}><ArrowLeft size={15} aria-hidden="true" />Volver al evento</Link>
            <p className={a.eyebrow}>Códigos</p>
            <h2 className={a.title}>Códigos de descuento</h2>
          </div>
          {!e && <button type="button" className={a.btnPrimary} onClick={() => { setEditing({ ...blank }); setDone(''); }}><Plus size={16} aria-hidden="true" />Crear código</button>}
        </div>
        {(event.isError || codes.isError) && <p className={a.notice} data-tone="error" role="alert">{apiErrorMessage(event.error ?? codes.error, 'No pudimos cargar los códigos.')}</p>}
        {done && <p className={a.notice} data-tone="ok" role="status"><Check size={16} aria-hidden="true" />{done}</p>}

        {e && (
          <form className={s.panel} onSubmit={save} aria-label={e.id ? `Editar código ${e.code}` : 'Nuevo código'}>
            <h2>{e.id ? `Editar ${e.code}` : 'Nuevo código'}</h2>
            <div className={s.formGrid}>
              <label className={s.field}>Código
                <input required value={e.code} maxLength={30} pattern="[A-Za-z0-9_\-]{3,30}" placeholder="FAMILIA2027" style={{ textTransform: 'uppercase' }} onChange={(ev) => set({ code: ev.target.value.replace(/\s/g, '') })} />
                <small>Letras, números y guiones. Las personas lo escriben al inscribirse.</small>
              </label>
              <div className={s.field}>Descuento
                <div className={v.segmented} role="group" aria-label="Tipo de descuento">
                  <button type="button" aria-pressed={e.kind === 'percent'} onClick={() => set({ kind: 'percent', value: Math.min(e.value, 100) })}>Porcentaje</button>
                  <button type="button" aria-pressed={e.kind === 'amount'} onClick={() => set({ kind: 'amount' })}>Monto fijo</button>
                </div>
              </div>
              <label className={s.field}>{e.kind === 'percent' ? 'Porcentaje (%)' : 'Monto por entrada (CLP)'}
                <input type="number" required min={0} max={e.kind === 'percent' ? 100 : 999999999} step={1} value={e.value} onChange={(ev) => set({ value: Number(ev.target.value) })} />
                <small>{e.value === 0 ? 'Con 0, el código solo desbloquea entradas ocultas.' : e.kind === 'percent' ? '100 % deja la entrada sin costo.' : 'Nunca baja una entrada de $0.'}</small>
              </label>
              <label className={s.field}>Usos máximos
                <input type="number" min={1} max={1000000} value={e.maxUses ?? ''} placeholder="Sin límite" onChange={(ev) => set({ maxUses: ev.target.value ? Number(ev.target.value) : null })} />
                <small>Cada compra cuenta como un uso, aunque traiga varias entradas.</small>
              </label>
              <div className={`${s.field} ${s.wide}`}>Aplica a
                <div className={v.chips} role="group" aria-label="Entradas a las que aplica">
                  <button type="button" aria-pressed={!e.ticketTypeIds.length} onClick={() => set({ ticketTypeIds: [] })}>Todas las entradas</button>
                  {tickets.filter((t) => t.id).map((t) => {
                    const on = e.ticketTypeIds.includes(t.id!);
                    return <button key={t.id} type="button" aria-pressed={on} onClick={() => set({ ticketTypeIds: on ? e.ticketTypeIds.filter((x) => x !== t.id) : [...e.ticketTypeIds, t.id!] })}>{on && <Check size={14} aria-hidden="true" />}{t.name}{t.hidden ? ' (oculta)' : ''}</button>;
                  })}
                </div>
                {!tickets.some((t) => t.id) && <small>Guarda el evento con sus entradas para poder elegirlas aquí.</small>}
                {tickets.some((t) => t.hidden) && <small>Si eliges una entrada oculta, quien use el código podrá verla y comprarla.</small>}
              </div>
              <label className={s.field}>Válido desde<input type="datetime-local" value={localDate(e.startsAt)} onChange={(ev) => set({ startsAt: isoDate(ev.target.value) || null })} /><small>Vacío: desde ya.</small></label>
              <label className={s.field}>Válido hasta<input type="datetime-local" value={localDate(e.endsAt)} onChange={(ev) => set({ endsAt: isoDate(ev.target.value) || null })} /><small>Vacío: sin vencimiento.</small></label>
              <label className={`${s.check} ${s.wide}`}><input type="checkbox" checked={e.active} onChange={(ev) => set({ active: ev.target.checked })} />Código activo</label>
            </div>
            {error && <p className={a.notice} data-tone="error" role="alert">{error}</p>}
            <div className={s.actions}>
              <button type="button" className={s.button} onClick={() => { setEditing(null); setError(''); }}>Cancelar</button>
              <button className={s.primary} disabled={saving || !e.code.trim()}>{saving ? 'Guardando…' : 'Guardar código'}</button>
            </div>
          </form>
        )}

        {codes.isPending && <p className={a.count} role="status">Cargando códigos…</p>}
        {codes.data?.length === 0 && !e && (
          <div className={s.empty}><Tag className="mx-auto mb-4" size={30} aria-hidden="true" /><h2 className="font-semibold">Aún no hay códigos</h2><p className={s.muted}>Crea uno para dar un descuento a un grupo, becar a alguien o abrir una entrada reservada.</p></div>
        )}
        <div className={v.codes}>
          {codes.data?.map((c) => (
            <article key={c.id} className={v.code} data-active={c.active}>
              <div><div className={v.codeName}>{c.code}</div><div className={v.codeMeta}>{describeDiscount(c)}{c.active ? '' : ' · Inactivo'}</div></div>
              <div className={v.codeMeta}>{c.ticketTypeIds.length ? c.ticketTypeIds.map(nameOf).join(', ') : 'Todas las entradas'}<br />{c.endsAt ? `Hasta el ${new Date(c.endsAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Sin vencimiento'}</div>
              <div className={v.codeMeta}><b>{c.uses ?? 0}</b>{c.maxUses ? ` de ${c.maxUses}` : ''} usos<br />{(c.given ?? 0) > 0 ? `${money(c.given ?? 0)} descontados` : 'Sin descuentos aún'}</div>
              <div className={v.codeActions}>
                <button type="button" className={`${a.btnGhost} ${a.small}`} onClick={() => { setEditing({ ...c }); setDone(''); setError(''); }}><Pencil size={14} aria-hidden="true" />Editar</button>
                <button type="button" className={`${a.btnGhost} ${a.small}`} onClick={() => void toggle(c)}>{c.active ? 'Desactivar' : 'Activar'}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </EventShell>
  );
}
