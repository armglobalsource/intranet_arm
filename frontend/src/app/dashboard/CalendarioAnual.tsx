'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  useEvents,
  useCreateEvent,
  useDeleteEvent,
  ArmEvent,
  EventCategory,
  CreateEventPayload,
} from '@/hooks/useEvents';

// ── Constantes ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

const CATEGORIES: Record<EventCategory, { label: string; color: string; bg: string }> = {
  culto:        { label: 'Culto',        color: '#7c3aed', bg: '#f5f3ff' },
  conferencia:  { label: 'Conferencia',  color: '#2563eb', bg: '#eff6ff' },
  retiro:       { label: 'Retiro',       color: '#059669', bg: '#ecfdf5' },
  capacitacion: { label: 'Capacitación', color: '#d97706', bg: '#fffbeb' },
  social:       { label: 'Social',       color: '#db2777', bg: '#fdf2f8' },
  otro:         { label: 'Otro',         color: '#6b7280', bg: '#f9fafb' },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORIES) as [EventCategory, { label: string; color: string; bg: string }][];

// ── Utilidades de fecha ───────────────────────────────────────────────────────

/** "YYYY-MM-DD" → { year, month (0-indexed), day } — sin UTC shift */
function parseDateStr(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

/** Retorna "YYYY-MM-DD" de un año, mes (0-indexed) y día */
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Avanza N días a una fecha "YYYY-MM-DD" */
function addDays(dateStr: string, n: number) {
  const { year, month, day } = parseDateStr(dateStr);
  const d = new Date(year, month, day + n);
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

/** ¿El día 'dateStr' cae dentro del rango [start, end]? */
function isInRange(dateStr: string, start: string, end: string | null | undefined) {
  if (!end || end === start) return dateStr === start;
  return dateStr >= start && dateStr <= end;
}

/** Formatea "YYYY-MM-DD" → "15 de enero de 2026" */
function formatFullDate(dateStr: string) {
  const { year, month, day } = parseDateStr(dateStr);
  return `${day} de ${MONTH_NAMES[month].toLowerCase()} de ${year}`;
}

// ── "Add to calendar" helpers ─────────────────────────────────────────────────

function buildGoogleUrl(ev: ArmEvent) {
  const startStr = ev.date.replace(/-/g, '');
  const endStr   = addDays(ev.endDate || ev.date, 1).replace(/-/g, '');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text:   ev.title,
    dates:  `${startStr}/${endStr}`,
  });
  if (ev.description) p.set('details',  ev.description);
  if (ev.location)    p.set('location', ev.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function downloadIcs(ev: ArmEvent) {
  const startStr = ev.date.replace(/-/g, '');
  const endStr   = addDays(ev.endDate || ev.date, 1).replace(/-/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ARM Global//Intranet//ES',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${startStr}`,
    `DTEND;VALUE=DATE:${endStr}`,
    `SUMMARY:${ev.title}`,
    ev.description ? `DESCRIPTION:${ev.description.replace(/\n/g, '\\n')}` : '',
    ev.location    ? `LOCATION:${ev.location}`    : '',
    `UID:${ev.id}@armglobal.com`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${ev.title.replace(/\s+/g, '_')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── MonthGrid ─────────────────────────────────────────────────────────────────

interface MonthGridProps {
  year:        number;
  month:       number; // 0-indexed
  events:      ArmEvent[];
  selectedDay: string | null;
  today:       string;
  onSelect:    (day: string) => void;
}

function MonthGrid({ year, month, events, selectedDay, today, onSelect }: MonthGridProps) {
  const firstDow    = new Date(year, month, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Construir celda: null = placeholder vacío
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Agrupar eventos por día "YYYY-MM-DD"
  const eventsByDay = new Map<string, ArmEvent[]>();
  events.forEach((ev) => {
    // Marcar cada día del rango (hasta 31 días por seguridad)
    let cursor = ev.date;
    const limit = ev.endDate || ev.date;
    let iters = 0;
    while (cursor <= limit && iters < 32) {
      const { year: ey, month: em } = parseDateStr(cursor);
      if (ey === year && em === month) {
        if (!eventsByDay.has(cursor)) eventsByDay.set(cursor, []);
        eventsByDay.get(cursor)!.push(ev);
      }
      cursor = addDays(cursor, 1);
      iters++;
    }
  });

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      {/* Nombre del mes */}
      <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
        {MONTH_NAMES[month]}
      </p>

      {/* Cabecera días */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((l, i) => (
          <span key={i} className="text-center text-[9px] font-semibold text-slate-400">
            {l}
          </span>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />;
          }

          const dateStr   = toDateStr(year, month, day);
          const dayEvents = eventsByDay.get(dateStr) ?? [];
          const isToday   = dateStr === today;
          const isSelected = dateStr === selectedDay;
          const hasEvents = dayEvents.length > 0;

          // Colores únicos para los dots (deduplicados por categoría)
          const dotColors = Array.from(new Set(dayEvents.map((e) => CATEGORIES[e.category]?.color ?? '#6b7280'))).slice(0, 3);

          return (
            <button
              key={day}
              onClick={() => hasEvents && onSelect(dateStr)}
              className={[
                'flex flex-col items-center justify-center rounded-md py-0.5 transition-all',
                hasEvents ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default',
                isSelected ? 'ring-1 ring-slate-900 bg-slate-900' : '',
                isToday && !isSelected ? 'font-bold' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'text-[11px] leading-none',
                  isSelected  ? 'text-white'         :
                  isToday     ? 'text-slate-900'      :
                  hasEvents   ? 'text-slate-800'      :
                                'text-slate-400',
                ].join(' ')}
              >
                {isToday && !isSelected ? (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 text-white text-[10px]">
                    {day}
                  </span>
                ) : day}
              </span>

              {/* Dots de eventos */}
              {hasEvents && (
                <div className="flex gap-[2px] mt-[2px]">
                  {dotColors.map((color, ci) => (
                    <span
                      key={ci}
                      className="w-[4px] h-[4px] rounded-full flex-shrink-0"
                      style={{ background: isSelected ? '#fff' : color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── EventCard ─────────────────────────────────────────────────────────────────

interface EventCardProps {
  event:    ArmEvent;
  isAdmin:  boolean;
  year:     number;
  onDelete: () => void;
}

function EventCard({ event, isAdmin, year, onDelete }: EventCardProps) {
  const [showCalMenu, setShowCalMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cat = CATEGORIES[event.category] ?? CATEGORIES.otro;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCalMenu(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      className="flex items-start gap-3 p-3.5 rounded-xl border"
      style={{ borderColor: `${cat.color}30`, background: cat.bg }}
    >
      {/* Barra izquierda de color */}
      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: cat.color }} />

      <div className="flex-1 min-w-0">
        {/* Badge categoría + título */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: cat.color, color: '#fff' }}
          >
            {cat.label}
          </span>
          <h4 className="text-[13px] font-semibold text-slate-900 truncate">{event.title}</h4>
        </div>

        {/* Detalles: hora + lugar */}
        <div className="flex items-center gap-3 mt-1 text-[11.5px] text-slate-500">
          {event.time && (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {event.time}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-1 truncate">
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {event.location}
            </span>
          )}
          {event.endDate && event.endDate !== event.date && (
            <span className="text-slate-400">
              hasta {formatFullDate(event.endDate)}
            </span>
          )}
        </div>

        {/* Descripción */}
        {event.description && (
          <p className="text-[11.5px] text-slate-500 mt-1 line-clamp-2">{event.description}</p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Agregar a mi calendario */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setShowCalMenu((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all"
            title="Agregar a mi calendario"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
            </svg>
            <span className="hidden sm:inline">Agregar</span>
          </button>

          {showCalMenu && (
            <div
              className="absolute right-0 top-full mt-1 z-20 rounded-lg overflow-hidden shadow-lg border border-slate-200 bg-white min-w-[160px]"
            >
              <a
                href={buildGoogleUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowCalMenu(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-[12px] text-slate-700 hover:bg-slate-50 transition-all"
              >
                <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm5.562 8.248l-2.01 2.01c-.38-.38-.886-.587-1.427-.587-.54 0-1.047.207-1.428.587L11.27 11.69c-.38.38-.586.887-.586 1.427 0 .54.206 1.048.586 1.428l1.427 1.427c.38.38.888.587 1.428.587.54 0 1.047-.207 1.427-.587l2.01-2.01c.38-.381.587-.888.587-1.428 0-.54-.207-1.047-.587-1.427z"/>
                </svg>
                Google Calendar
              </a>
              <button
                onClick={() => { downloadIcs(event); setShowCalMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-[12px] text-slate-700 hover:bg-slate-50 transition-all"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Descargar .ics
              </button>
            </div>
          )}
        </div>

        {/* Eliminar (solo admin) */}
        {isAdmin && (
          <button
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all"
            title="Eliminar evento"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── AddEventModal ─────────────────────────────────────────────────────────────

interface AddEventModalProps {
  defaultDate?: string;
  onClose:      () => void;
  onCreated:    () => void;
}

function AddEventModal({ defaultDate, onClose, onCreated }: AddEventModalProps) {
  const create = useCreateEvent();
  const today  = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [form, setForm] = useState<CreateEventPayload>({
    title:       '',
    description: '',
    date:        defaultDate ?? todayStr,
    endDate:     '',
    time:        '',
    category:    'culto',
    location:    '',
  });

  const [error, setError] = useState('');

  function set<K extends keyof CreateEventPayload>(key: K, val: CreateEventPayload[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    if (!form.date)         { setError('La fecha de inicio es obligatoria'); return; }

    const payload: CreateEventPayload = {
      title:       form.title.trim(),
      description: form.description?.trim() || null,
      date:        form.date,
      endDate:     form.endDate?.trim()  || null,
      time:        form.time?.trim()     || null,
      category:    form.category,
      location:    form.location?.trim() || null,
    };

    try {
      await create.mutateAsync(payload);
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Error al crear el evento');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-[15px] font-bold text-slate-900">Nueva actividad</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all text-slate-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Título *
            </label>
            <input
              className="input"
              placeholder="Ej: Retiro de Adoración"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Categoría *
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set('category', key)}
                  className="px-3 py-1.5 rounded-full text-[11.5px] font-semibold border transition-all"
                  style={
                    form.category === key
                      ? { background: cfg.color, color: '#fff', borderColor: cfg.color }
                      : { background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}40` }
                  }
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fechas + hora */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Fecha inicio *
              </label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Fecha fin
              </label>
              <input
                type="date"
                className="input"
                value={form.endDate ?? ''}
                onChange={(e) => set('endDate', e.target.value)}
                min={form.date}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Hora
              </label>
              <input
                type="time"
                className="input"
                value={form.time ?? ''}
                onChange={(e) => set('time', e.target.value)}
              />
            </div>
          </div>

          {/* Lugar */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Lugar
            </label>
            <input
              className="input"
              placeholder="Ej: Auditorio principal · Santiago"
              value={form.location ?? ''}
              onChange={(e) => set('location', e.target.value)}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Descripción
            </label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Descripción opcional del evento..."
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-500 font-medium">{error}</p>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="btn-primary text-sm"
            >
              {create.isPending ? 'Guardando…' : 'Crear evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Leyenda de categorías ─────────────────────────────────────────────────────

function Leyenda() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-slate-100">
      {CATEGORY_OPTIONS.map(([key, cfg]) => (
        <span key={key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
          {cfg.label}
        </span>
      ))}
    </div>
  );
}

// ── CalendarioAnual ───────────────────────────────────────────────────────────

export function CalendarioAnual() {
  const { user }         = useAuthStore();
  const isAdmin          = user?.role?.name === 'admin';
  const today            = (() => {
    const d = new Date();
    return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
  })();
  const currentYear      = Number(today.slice(0, 4));

  const [year, setYear]          = useState(currentYear);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: events = [], isLoading } = useEvents(year);
  const deleteEvent = useDeleteEvent();

  // Eventos del día seleccionado
  const dayEvents = selectedDay
    ? events.filter((ev) => isInRange(selectedDay, ev.date, ev.endDate))
    : [];

  function handleSelectDay(day: string) {
    setSelectedDay((prev) => (prev === day ? null : day));
  }

  async function handleDelete(ev: ArmEvent) {
    if (!confirm(`¿Eliminar "${ev.title}"?`)) return;
    await deleteEvent.mutateAsync({ id: ev.id, year });
    if (dayEvents.length <= 1) setSelectedDay(null);
  }

  return (
    <>
      <div className="card p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <div>
            <h2 className="text-[15px] font-bold text-slate-900">Calendario ARM Global</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">Actividades y eventos de la organización</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Navegación de año */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => { setYear((y) => y - 1); setSelectedDay(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white transition-all text-slate-500 hover:text-slate-900"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="text-[13px] font-bold text-slate-800 px-2 min-w-[3.5rem] text-center">
                {year}
              </span>
              <button
                onClick={() => { setYear((y) => y + 1); setSelectedDay(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white transition-all text-slate-500 hover:text-slate-900"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Volver a hoy */}
            {year !== currentYear && (
              <button
                onClick={() => { setYear(currentYear); setSelectedDay(null); }}
                className="text-[11.5px] font-medium text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-all"
              >
                Hoy
              </button>
            )}

            {/* Nueva actividad (admin) */}
            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 btn-primary text-[12px] py-1.5 px-3"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nueva actividad
              </button>
            )}
          </div>
        </div>

        {/* Grid de 12 meses */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 h-32 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, m) => (
              <MonthGrid
                key={m}
                year={year}
                month={m}
                events={events}
                selectedDay={selectedDay}
                today={today}
                onSelect={handleSelectDay}
              />
            ))}
          </div>
        )}

        {/* Leyenda */}
        <Leyenda />

        {/* Panel de eventos del día seleccionado */}
        {selectedDay && dayEvents.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-slate-800">
                {formatFullDate(selectedDay)}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 transition-all text-slate-400"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-2.5">
              {dayEvents.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  isAdmin={isAdmin}
                  year={year}
                  onDelete={() => handleDelete(ev)}
                />
              ))}
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-700 transition-all"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar evento en esta fecha
              </button>
            )}
          </div>
        )}

        {/* Sin eventos — info de ayuda */}
        {!isLoading && events.length === 0 && (
          <p className="text-center text-[12px] text-slate-400 mt-4 pb-1">
            No hay eventos registrados para {year}.
            {isAdmin && ' Haz clic en "Nueva actividad" para agregar el primero.'}
          </p>
        )}
      </div>

      {/* Modal crear evento */}
      {showAddModal && (
        <AddEventModal
          defaultDate={selectedDay ?? undefined}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {}}
        />
      )}
    </>
  );
}
