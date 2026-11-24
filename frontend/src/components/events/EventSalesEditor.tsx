'use client';
// Editor de venta: tipos de entrada con sus reglas (cupo, máximo por compra, fechas, ocultas)
// y preguntas que responde cada asistente al inscribirse.
import { ReactNode, useId } from 'react';
import { ChevronDown, ChevronUp, EyeOff, Plus, Trash2 } from 'lucide-react';
import { EventQuestion, TicketType } from './event-types';
import s from './events.module.css';
import x from './event-editor.module.css';
import v from './event-sales.module.css';

export function localDate(value: string | null | undefined) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export function isoDate(value: string) { return value ? new Date(value).toISOString() : ''; }

function Input({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={`${s.field} ${wide ? s.wide : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id, hint ? `${id}-hint` : undefined)}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}

const newTicket = (paid: boolean): TicketType => ({ name: paid ? 'Entrada general' : 'Entrada', price: 0, currency: 'CLP', description: '', capacity: null, salesStart: null, salesEnd: null, hidden: false, maxPerOrder: 10 });

export function TicketsEditor({ tickets, paid, onChange }: { tickets: TicketType[]; paid: boolean; onChange: (next: TicketType[]) => void }) {
  const set = (i: number, patch: Partial<TicketType>) => onChange(tickets.map((t, j) => (i === j ? { ...t, ...patch } : t)));
  const move = (i: number, d: -1 | 1) => { const next = [...tickets]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next); };
  return (
    <div className={s.wide}>
      <span className={x.miniLabel}>Tipos de entrada</span>
      <p className={x.help}>{paid
        ? 'Por ejemplo: General, Niños (sin costo) o Preventa. Cada persona elige cuántas quiere de cada una.'
        : 'Opcional. Sin tipos, cada persona elige cuántas entradas gratuitas quiere (hasta 10). Úsalos para separar cupos, como Adultos y Niños.'}</p>
      {tickets.map((t, i) => (
        <fieldset key={t.id ?? `new-${i}`} className={v.ticket} aria-label={`Entrada ${t.name || i + 1}`}>
          <div className={v.ticketHead}>
            <strong>{t.name || `Entrada ${i + 1}`}{t.hidden && <span className={v.pill}><EyeOff size={12} aria-hidden="true" />Oculta</span>}</strong>
            <span className={v.ticketTools}>
              <button type="button" className={v.icon} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${t.name}`}><ChevronUp size={16} /></button>
              <button type="button" className={v.icon} disabled={i === tickets.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar ${t.name}`}><ChevronDown size={16} /></button>
              <button type="button" className={v.icon} onClick={() => onChange(tickets.filter((_, j) => j !== i))} aria-label={`Quitar entrada ${t.name || i + 1}`}><Trash2 size={16} /></button>
            </span>
          </div>
          <div className={v.grid}>
            <Input label="Nombre">{(id) => <input id={id} value={t.name} maxLength={80} onChange={(e) => set(i, { name: e.target.value })} />}</Input>
            {paid
              ? <Input label="Valor (CLP)" hint="0 para una entrada sin costo.">{(id, d) => <input id={id} aria-describedby={d} type="number" min={0} step={1} max={999999999} value={t.price} onChange={(e) => set(i, { price: Number(e.target.value), currency: 'CLP' })} />}</Input>
              : <div className={s.field}><span className={v.free}>Gratuita</span></div>}
            <Input label="Descripción" hint="Qué incluye o para quién es. Opcional." wide>{(id, d) => <input id={id} aria-describedby={d} value={t.description ?? ''} maxLength={300} onChange={(e) => set(i, { description: e.target.value })} />}</Input>
            <Input label="Cupos de esta entrada" hint="Vacío: usa el cupo total del evento.">{(id, d) => <input id={id} aria-describedby={d} type="number" min={1} max={1000000} value={t.capacity ?? ''} onChange={(e) => set(i, { capacity: e.target.value ? Number(e.target.value) : null })} />}</Input>
            <Input label="Máximo por compra">{(id) => <select id={id} value={t.maxPerOrder ?? 10} onChange={(e) => set(i, { maxPerOrder: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, n) => <option key={n + 1} value={n + 1}>{n + 1}</option>)}</select>}</Input>
            <Input label="A la venta desde" hint="Vacío: desde que abren las inscripciones.">{(id, d) => <input id={id} aria-describedby={d} type="datetime-local" value={localDate(t.salesStart)} onChange={(e) => set(i, { salesStart: isoDate(e.target.value) || null })} />}</Input>
            <Input label="A la venta hasta" hint="Útil para preventas.">{(id, d) => <input id={id} aria-describedby={d} type="datetime-local" value={localDate(t.salesEnd)} onChange={(e) => set(i, { salesEnd: isoDate(e.target.value) || null })} />}</Input>
            <label className={`${s.check} ${s.wide}`}><input type="checkbox" checked={!!t.hidden} onChange={(e) => set(i, { hidden: e.target.checked })} />Entrada oculta: solo aparece con un código (por ejemplo, para el equipo de servicio)</label>
          </div>
        </fieldset>
      ))}
      <button type="button" className={s.button} disabled={tickets.length >= 20} onClick={() => onChange([...tickets, newTicket(paid)])}><Plus size={16} />Agregar tipo de entrada</button>
    </div>
  );
}

const TYPES: { value: EventQuestion['type']; label: string }[] = [
  { value: 'text', label: 'Respuesta escrita' },
  { value: 'select', label: 'Elegir una opción' },
  { value: 'yesno', label: 'Casilla para marcar' },
];
const newId = () => Math.random().toString(36).slice(2, 10).padEnd(6, '0');

export function QuestionsEditor({ questions, onChange }: { questions: EventQuestion[]; onChange: (next: EventQuestion[]) => void }) {
  const set = (i: number, patch: Partial<EventQuestion>) => onChange(questions.map((q, j) => (i === j ? { ...q, ...patch } : q)));
  return (
    <div className={s.wide}>
      {!questions.length && <p className={x.help}>Sin preguntas, solo se pide nombre y apellido de cada asistente.</p>}
      {questions.map((q, i) => (
        <fieldset key={q.id} className={v.ticket} aria-label={`Pregunta ${i + 1}`}>
          <div className={v.ticketHead}>
            <strong>Pregunta {i + 1}</strong>
            <button type="button" className={v.icon} onClick={() => onChange(questions.filter((_, j) => j !== i))} aria-label={`Quitar pregunta ${i + 1}`}><Trash2 size={16} /></button>
          </div>
          <div className={v.grid}>
            <Input label="Pregunta" wide>{(id) => <input id={id} maxLength={200} value={q.label} placeholder="Ej.: Talla de polera" onChange={(e) => set(i, { label: e.target.value })} />}</Input>
            <Input label="Tipo de respuesta">{(id) => <select id={id} value={q.type} onChange={(e) => set(i, { type: e.target.value as EventQuestion['type'], options: e.target.value === 'select' ? (q.options?.length ? q.options : ['']) : undefined })}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>}</Input>
            <label className={s.check}><input type="checkbox" checked={q.required} onChange={(e) => set(i, { required: e.target.checked })} />{q.type === 'yesno' ? 'Debe marcarla para inscribirse' : 'Respuesta obligatoria'}</label>
            {q.type === 'select' && (
              <Input label="Opciones" hint="Una por línea. Ej.: S, M, L, XL." wide>{(id, d) => <textarea id={id} aria-describedby={d} rows={4} value={(q.options ?? []).join('\n')} onChange={(e) => set(i, { options: e.target.value.split('\n').map((o) => o.slice(0, 80)).slice(0, 20) })} />}</Input>
            )}
          </div>
        </fieldset>
      ))}
      <button type="button" className={s.button} disabled={questions.length >= 15} onClick={() => onChange([...questions, { id: newId(), label: '', type: 'text', required: false }])}><Plus size={16} />Agregar pregunta</button>
    </div>
  );
}

/** Antes de guardar: opciones sin líneas vacías. */
export function cleanQuestions(questions: EventQuestion[] | undefined) {
  return (questions ?? []).map((q) => (q.type === 'select' ? { ...q, options: (q.options ?? []).map((o) => o.trim()).filter(Boolean) } : { ...q, options: undefined }));
}
