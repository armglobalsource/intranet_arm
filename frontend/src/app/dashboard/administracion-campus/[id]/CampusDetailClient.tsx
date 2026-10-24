'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { useCampus } from '@/hooks/useCampus';
import {
  useAdministradores, useCreateAdministrador, useUpdateAdministrador,
  useEquipos, useCreateEquipo,
  useTurnos, useGenerarCalendario, useUpdateTurno,
  type Administrador, type Equipo, type Turno, type CampusTurnoTipo, type Modalidad,
} from '@/hooks/useCampusTurnos';

// Solo 'lideres_voluntarios' usa modalidad (dos rotaciones en paralelo, AM y PM);
// 'administradores' sigue siendo una sola rotación semanal, sin cambios.
const MODALIDAD_LABEL: Record<Modalidad, string> = {
  AM: 'Miércoles AM + PM · Dom. AM',
  PM: 'Domingo PM',
};

const ACCENT = '#059669'; // emerald-600, consistente con los acentos ya usados en esta pantalla

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function mesLabel(fecha: string): string {
  const [y, m] = fecha.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

const MESES_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatFechaCompacta(fecha: string): { dia: string; mes: string } {
  const [, m, d] = fecha.split('-').map(Number);
  return { dia: String(d).padStart(2, '0'), mes: MESES_ABBR[m - 1] };
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function formatFechaServicio(fecha: string, diaSemana: string): string {
  const [, m, d] = fecha.split('-').map(Number);
  return `${diaSemana} ${String(d).padStart(2, '0')} ${MESES_ABBR[m - 1]}`;
}

/** true si `fecha` (lunes) cae dentro de la semana calendario actual. */
function isSemanaActual(fecha: string): boolean {
  const [y, m, d] = fecha.split('-').map(Number);
  const lunes = new Date(y, m - 1, d);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return now >= lunes && now <= domingo;
}

// Paleta cíclica por equipo (estable por id, no por posición en la lista) para que la
// rotación se pueda escanear visualmente de un vistazo en vez de leer cada nombre.
const TEAM_COLORS = [
  { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  { bg: 'bg-rose-50',   text: 'text-rose-700',   dot: 'bg-rose-500' },
  { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  { bg: 'bg-cyan-50',   text: 'text-cyan-700',   dot: 'bg-cyan-500' },
  { bg: 'bg-lime-50',   text: 'text-lime-700',   dot: 'bg-lime-500' },
];

function teamColor(equipoId: number) {
  return TEAM_COLORS[equipoId % TEAM_COLORS.length];
}

/** Próximo lunes desde hoy (o hoy si ya es lunes) — default sensato para "fecha de inicio". */
function proximoLunes(): string {
  const d = new Date();
  const dow = d.getDay(); // 0=domingo
  const diff = dow === 1 ? 0 : ((8 - dow) % 7 || 7);
  d.setDate(d.getDate() + (dow === 1 ? 0 : diff));
  return d.toISOString().slice(0, 10);
}

const cardCls  = 'bg-white rounded-2xl border border-gray-200 p-5';
const labelCls = 'text-[10px] font-semibold uppercase tracking-widest text-gray-400';

function CalendarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function SettingsIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

// ── Roster de administradores ─────────────────────────────────────────────────

function RosterSection({ campusId, tipo, titulo, administradores, isAdmin }: {
  campusId: number; tipo: CampusTurnoTipo; titulo: string; administradores: Administrador[]; isAdmin: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const create = useCreateAdministrador(campusId, tipo);
  const update = useUpdateAdministrador(campusId, tipo);

  function handleAdd() {
    const trimmed = nombre.trim();
    if (!trimmed) return;
    create.mutate(trimmed, { onSuccess: () => setNombre('') });
  }

  return (
    <div className={cardCls}>
      <p className={labelCls}>{titulo}</p>
      <p className="text-xs text-gray-400 mt-1 mb-3">
        Personas disponibles para formar equipos. No requieren cuenta en el sistema.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {administradores.map((a) => (
          <span key={a.id}
            className="inline-flex items-center gap-1.5 text-[12.5px] px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-700">
            {a.nombre}
            {isAdmin && (
              <button
                onClick={() => update.mutate({ id: a.id, data: { isActive: false } })}
                title="Quitar del roster"
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            )}
          </span>
        ))}
        {administradores.length === 0 && (
          <span className="text-xs text-gray-400">Sin {titulo.toLowerCase()} aún.</span>
        )}
      </div>

      {isAdmin && (
        <div className="flex gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Nombre completo"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-gray-400"
          />
          <button
            onClick={handleAdd}
            disabled={!nombre.trim() || create.isPending}
            className="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            + Agregar
          </button>
        </div>
      )}
    </div>
  );
}

// ── Equipos rotativos ─────────────────────────────────────────────────────────

function EquiposSection({ campusId, tipo, equipos, administradores, isAdmin }: {
  campusId: number; tipo: CampusTurnoTipo; equipos: Equipo[]; administradores: Administrador[]; isAdmin: boolean;
}) {
  const usaModalidad = tipo === 'lideres_voluntarios';
  const [selected, setSelected] = useState<number[]>([]);
  const [nombre, setNombre]     = useState('');
  const [nombreTouched, setNombreTouched] = useState(false);
  const [modalidad, setModalidad] = useState<Modalidad>('AM');
  const create = useCreateEquipo(campusId, tipo);

  const nombreById = useMemo(
    () => new Map(administradores.map((a) => [a.id, a.nombre])),
    [administradores],
  );

  const nombreSugerido = selected.map((id) => nombreById.get(id)?.split(' ')[0] ?? '').join(' & ');

  function toggleSelected(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleCreate() {
    const finalNombre = (nombreTouched ? nombre : nombreSugerido).trim();
    if (!finalNombre || selected.length === 0) return;
    create.mutate(
      { nombre: finalNombre, administradorIds: selected, ...(usaModalidad ? { modalidad } : {}) },
      { onSuccess: () => { setSelected([]); setNombre(''); setNombreTouched(false); } },
    );
  }

  return (
    <div className={cardCls}>
      <p className={labelCls}>Equipos</p>
      <p className="text-xs text-gray-400 mt-1 mb-3">
        Agrupaciones de personas que rotan juntas semana a semana.
        {usaModalidad && ' El mismo equipo cubre Miércoles AM y PM + Domingo AM; PM cubre Domingo PM.'}
      </p>

      <div className="space-y-2 mb-4">
        {equipos.map((eq) => (
          <div key={eq.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <span className="flex items-center gap-2">
              {usaModalidad && eq.modalidad && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
                  {eq.modalidad}
                </span>
              )}
              <span className="text-[13px] font-medium text-gray-800">{eq.nombre}</span>
            </span>
            {!usaModalidad && (
              <span className="text-[11px] text-gray-400">
                {eq.administradorIds.map((id) => nombreById.get(id)).filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        ))}
        {equipos.length === 0 && (
          <span className="text-xs text-gray-400">Sin equipos aún.</span>
        )}
      </div>

      {isAdmin && (
        <div className="border-t border-gray-100 pt-3 space-y-2.5">
          <p className="text-[11px] font-medium text-gray-500">Nuevo equipo — elige sus integrantes</p>
          {usaModalidad && (
            <div className="flex gap-1.5">
              {(['AM', 'PM'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setModalidad(m)}
                  className={`text-[12px] px-3 py-1 rounded-full border transition-colors ${
                    modalidad === m ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                  style={modalidad === m ? { background: ACCENT } : {}}
                >
                  {m} · {MODALIDAD_LABEL[m]}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {administradores.map((a) => (
              <button
                key={a.id}
                onClick={() => toggleSelected(a.id)}
                className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
                  selected.includes(a.id)
                    ? 'text-white border-transparent'
                    : 'text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
                style={selected.includes(a.id) ? { background: ACCENT } : {}}
              >
                {a.nombre}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={nombreTouched ? nombre : nombreSugerido}
              onChange={(e) => { setNombre(e.target.value); setNombreTouched(true); }}
              placeholder="Nombre del equipo"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-gray-400"
            />
            <button
              onClick={handleCreate}
              disabled={selected.length === 0 || create.isPending}
              className="px-3.5 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              + Crear equipo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Generar calendario ────────────────────────────────────────────────────────

function GenerarCalendarioSection({ campusId, tipo, equipos, modalidad, titulo }: {
  campusId: number; tipo: CampusTurnoTipo; equipos: Equipo[]; modalidad?: Modalidad; titulo?: string;
}) {
  const [orden, setOrden]             = useState<number[]>([]);
  const [fechaInicio, setFechaInicio] = useState(proximoLunes());
  const [semanas, setSemanas]         = useState(12);
  const generar = useGenerarCalendario(campusId, tipo);
  const [msg, setMsg] = useState<string | null>(null);

  const equipoById = useMemo(() => new Map(equipos.map((e) => [e.id, e.nombre])), [equipos]);
  const disponibles = equipos.filter((e) => !orden.includes(e.id));

  function handleGenerar() {
    if (orden.length === 0) return;
    generar.mutate(
      { equipoIds: orden, fechaInicio, semanas, ...(modalidad ? { modalidad } : {}) },
      {
        onSuccess: (data) => { setMsg(`${data.creados} semana(s) generada(s).`); setTimeout(() => setMsg(null), 3000); },
        onError:   () => { setMsg('No se pudo generar el calendario.'); setTimeout(() => setMsg(null), 3000); },
      },
    );
  }

  return (
    <div className={cardCls}>
      <p className={labelCls}>{titulo ?? 'Generar calendario'}</p>
      <p className="text-xs text-gray-400 mt-1 mb-3">
        Define el orden de rotación de los equipos y el rango de semanas a generar. No pisa semanas ya asignadas.
      </p>

      <div className="space-y-2 mb-3">
        <p className="text-[11px] font-medium text-gray-500">Orden de rotación</p>
        <div className="flex flex-wrap gap-1.5">
          {orden.map((id, i) => (
            <span key={id} className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full text-white" style={{ background: ACCENT }}>
              {i + 1}. {equipoById.get(id) ?? '—'}
              <button onClick={() => setOrden((o) => o.filter((x) => x !== id))} className="text-white/70 hover:text-white">✕</button>
            </span>
          ))}
          {orden.length === 0 && <span className="text-xs text-gray-400">Elige equipos abajo, en el orden en que deben rotar.</span>}
        </div>
        {disponibles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {disponibles.map((e) => (
              <button key={e.id} onClick={() => setOrden((o) => [...o, e.id])}
                className="text-[12px] px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300">
                + {e.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">Fecha de inicio (lunes)</span>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-gray-400" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">Semanas</span>
          <input type="number" min={1} value={semanas} onChange={(e) => setSemanas(Number(e.target.value) || 1)}
            className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-gray-400" />
        </label>
        <button
          onClick={handleGenerar}
          disabled={orden.length === 0 || generar.isPending}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          {generar.isPending ? 'Generando…' : 'Generar'}
        </button>
        {msg && <span className="text-[12.5px] text-gray-500">{msg}</span>}
      </div>
    </div>
  );
}

// ── Tabla del calendario ──────────────────────────────────────────────────────

// Un badge de equipo, clicable para editar ese turno puntual (mismo comportamiento
// que antes, pero factorizado para poder renderizar 1 o 2 badges por fila de fecha).
function TurnoBadge({ t, equipos, isAdmin, editingId, setEditingId, onUpdate, showModalidadTag }: {
  t: Turno; equipos: Equipo[]; isAdmin: boolean;
  editingId: number | null; setEditingId: (id: number | null) => void;
  onUpdate: (id: number, equipoId: number) => void; showModalidadTag: boolean;
}) {
  const c = teamColor(t.equipoId);
  // Al editar, solo se ofrecen equipos de la misma modalidad (no tiene sentido
  // poner un equipo PM en el slot AM y viceversa).
  const opciones = t.modalidad ? equipos.filter((eq) => eq.modalidad === t.modalidad) : equipos;

  if (isAdmin && editingId === t.id) {
    return (
      <select
        autoFocus
        defaultValue={t.equipoId}
        onChange={(e) => { onUpdate(t.id, Number(e.target.value)); setEditingId(null); }}
        onBlur={() => setEditingId(null)}
        className="min-w-0 max-w-full text-[12.5px] border border-gray-200 rounded-lg px-2 py-1"
      >
        {opciones.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
      </select>
    );
  }

  return (
    <button
      onClick={() => isAdmin && setEditingId(t.id)}
      className={`flex min-w-0 max-w-full items-center gap-1 text-left ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {showModalidadTag && t.modalidad && (
        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{t.modalidad}</span>
      )}
      <span className={`max-w-full px-2.5 py-1 rounded-xl text-[11.5px] font-medium whitespace-normal leading-snug ${c.bg} ${c.text}`}>
        {t.equipoNombreSnapshot}
      </span>
      {t.isManualOverride && (
        <span title="Editado manualmente" className="text-amber-500 text-[11px] flex-shrink-0">✎</span>
      )}
    </button>
  );
}

function CalendarioTable({ campusId, tipo, turnos, equipos, isAdmin }: {
  campusId: number; tipo: CampusTurnoTipo; turnos: Turno[]; equipos: Equipo[]; isAdmin: boolean;
}) {
  const update = useUpdateTurno(campusId, tipo);
  const [editingId, setEditingId] = useState<number | null>(null);
  const usaModalidad = tipo === 'lideres_voluntarios';

  // Agrupa primero por fecha (una fila por semana) — si hay turnos AM y PM para la
  // misma fecha (lideres_voluntarios), se muestran juntos en la misma fila.
  const filasPorMes = useMemo(() => {
    const porFecha = new Map<string, Turno[]>();
    for (const t of turnos) {
      if (!porFecha.has(t.fecha)) porFecha.set(t.fecha, []);
      porFecha.get(t.fecha)!.push(t);
    }
    const filas = Array.from(porFecha.entries())
      .map(([fecha, ts]) => ({ fecha, turnos: ts.sort((a, b) => (a.modalidad ?? '').localeCompare(b.modalidad ?? '')) }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const porMes = new Map<string, typeof filas>();
    for (const fila of filas) {
      const key = mesLabel(usaModalidad ? sumarDias(fila.fecha, 2) : fila.fecha);
      if (!porMes.has(key)) porMes.set(key, []);
      porMes.get(key)!.push(fila);
    }
    return Array.from(porMes.entries());
  }, [turnos, usaModalidad]);

  if (turnos.length === 0) {
    return (
      <div className={cardCls}>
        <p className="text-sm text-gray-400 text-center py-6">Aún no hay calendario generado.</p>
      </div>
    );
  }


  if (usaModalidad) {
    return (
      <div className="space-y-4">
        {equipos.length > 1 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {equipos.map((eq) => {
              const c = teamColor(eq.id);
              return (
                <span key={eq.id} className="inline-flex items-center gap-1.5 text-[12px] text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  {eq.nombre}
                </span>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filasPorMes.map(([mes, filas]) => (
            <div key={mes} className="h-full bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-900 text-[11px] font-bold uppercase tracking-widest text-white">
                {mes}
              </div>
              <div className="flex-1 divide-y divide-gray-100">
                {filas.map(({ fecha, turnos: ts }) => {
                  const miercoles = sumarDias(fecha, 2);
                  const domingo = sumarDias(fecha, 6);
                  const turnoAM = ts.find((t) => t.modalidad === 'AM');
                  const turnoPM = ts.find((t) => t.modalidad === 'PM');
                  const esActual = isSemanaActual(fecha);

                  const servicio = (t: Turno | undefined) => {
                    if (!t) return <span className="text-xs text-gray-300">Sin asignar</span>;
                    return (
                      <div className="min-w-0">
                        <TurnoBadge
                          t={t} equipos={equipos} isAdmin={isAdmin}
                          editingId={editingId} setEditingId={setEditingId}
                          onUpdate={(id, equipoId) => update.mutate({ id, equipoId })}
                          showModalidadTag={false}
                        />
                      </div>
                    );
                  };

                  return (
                    <div key={fecha} className={`grid grid-cols-[52px_minmax(0,1fr)] gap-3 px-4 py-4 ${esActual ? 'bg-emerald-50/70' : ''}`}>
                      <div className="flex flex-col items-start leading-none pt-0.5">
                        <span className="text-[16px] font-bold text-gray-800">
                          {miercoles.slice(8, 10)}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mt-1">
                          {MESES_ABBR[Number(miercoles.slice(5, 7)) - 1]}
                        </span>
                        {esActual && (
                          <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wide mt-2">
                            Esta semana
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 space-y-3 pr-1">
                        <div className="min-w-0 space-y-1.5">
                          <span className="block text-[9px] font-bold uppercase tracking-wide text-gray-400">
                            Mié AM + PM · Dom AM
                          </span>
                          {servicio(turnoAM)}
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <span className="block text-[9px] font-bold uppercase tracking-wide text-gray-400">
                            Dom {domingo.slice(8, 10)} · PM
                          </span>
                          {servicio(turnoPM)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {isAdmin && <p className="text-[11px] text-gray-400">Haz clic sobre un equipo para cambiar una fecha puntual.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {equipos.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {equipos.map((eq) => {
            const c = teamColor(eq.id);
            return (
              <span key={eq.id} className="inline-flex items-center gap-1.5 text-[12px] text-gray-500">
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                {usaModalidad && eq.modalidad && <span className="text-[10px] font-bold uppercase text-gray-400">{eq.modalidad}</span>}
                {eq.nombre}
              </span>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filasPorMes.map(([mes, filas]) => (
          <div key={mes} className="h-full bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white bg-slate-950 px-4 py-3 border-b border-slate-900">
              {mes}
            </p>
            <div className="flex-1 divide-y divide-gray-50">
              {filas.map(({ fecha, turnos: ts }) => {
                const { dia, mes: mesAbbr } = formatFechaCompacta(fecha);
                const esActual = isSemanaActual(fecha);
                return (
                  <div
                    key={fecha}
                    className={`flex items-center gap-3 px-4 py-2.5 ${esActual ? 'bg-emerald-50/60' : ''}`}
                  >
                    <div className="flex flex-col items-center justify-center w-8 flex-shrink-0 leading-none">
                      <span className="text-[15px] font-bold text-gray-800">{dia}</span>
                      <span className="text-[9px] font-semibold uppercase text-gray-400 mt-0.5">{mesAbbr}</span>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {ts.map((t) => (
                        <TurnoBadge
                          key={t.id} t={t} equipos={equipos} isAdmin={isAdmin}
                          editingId={editingId} setEditingId={setEditingId}
                          onUpdate={(id, equipoId) => update.mutate({ id, equipoId })}
                          showModalidadTag={usaModalidad}
                        />
                      ))}
                    </div>

                    {esActual && (
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide flex-shrink-0">
                        Esta semana
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SemanaActualCard({ tipo, turnos }: { tipo: CampusTurnoTipo; turnos: Turno[] }) {
  const actuales = turnos.filter((turno) => isSemanaActual(turno.fecha));
  const usaModalidad = tipo === 'lideres_voluntarios';
  const turnoAM = actuales.find((turno) => turno.modalidad === 'AM');
  const turnoPM = actuales.find((turno) => turno.modalidad === 'PM');
  const turno = actuales[0];
  const fecha = turno?.fecha;
  const serviciosActuales: Array<{ dia: string; bloque: string; turno?: Turno }> = [
    { dia: 'Miércoles', bloque: 'AM', turno: turnoAM },
    { dia: 'Miércoles', bloque: 'PM', turno: turnoAM },
    { dia: 'Domingo', bloque: 'AM', turno: turnoAM },
    { dia: 'Domingo', bloque: 'PM', turno: turnoPM },
  ];

  return (
    <div className="overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5 px-5 py-5">
        <div className="lg:w-48 flex-shrink-0">
          <div className="flex items-center gap-2 text-emerald-300 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]">Esta semana</span>
          </div>
          <p className="text-sm font-semibold text-white">
            {fecha ? `${formatFechaServicio(fecha, 'Lun')} — ${formatFechaServicio(sumarDias(fecha, 6), 'Dom')}` : 'Sin programación'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Asignación vigente del campus</p>
        </div>

        {fecha ? (
          usaModalidad ? (
            <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              {serviciosActuales.map(({ dia, bloque, turno: item }) => (
                <div key={`${dia}-${bloque}`} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{dia} · {bloque}</p>
                  <p className="text-[12px] font-semibold text-white mt-1 truncate" title={item?.equipoNombreSnapshot}>
                    {item?.equipoNombreSnapshot ?? 'Sin asignar'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Equipo responsable</p>
              <p className="text-sm font-semibold text-white mt-1">{turno.equipoNombreSnapshot}</p>
            </div>
          )
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-white/15 px-4 py-4 text-sm text-slate-400">
            No hay un equipo asignado para la semana actual.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendario (pestaña, reutilizable por tipo) ──────────────────────────────

function CalendarioTab({ campusId, tipo, titulo, isAdmin }: {
  campusId: number; tipo: CampusTurnoTipo; titulo: string; isAdmin: boolean;
}) {
  const usaModalidad = tipo === 'lideres_voluntarios';
  const { data: administradores = [] } = useAdministradores(campusId, tipo);
  const { data: equipos = [] }         = useEquipos(campusId, tipo);
  const { data: turnos = [] }          = useTurnos(campusId, tipo);

  const equiposAM = useMemo(() => equipos.filter((e) => e.modalidad === 'AM'), [equipos]);
  const equiposPM = useMemo(() => equipos.filter((e) => e.modalidad === 'PM'), [equipos]);
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <SemanaActualCard tipo={tipo} turnos={turnos} />
        <div className="flex items-end justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 text-gray-900">
              <CalendarIcon className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold">Calendario completo</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">Consulta la rotación por mes y edita una asignación puntual haciendo clic en el equipo.</p>
          </div>
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
            {turnos.length} asignaciones
          </span>
        </div>
        <CalendarioTable campusId={campusId} tipo={tipo} turnos={turnos} equipos={equipos} isAdmin={isAdmin} />
      </section>

      <section className="rounded-3xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5 space-y-4">
        <div className="flex items-start gap-3 px-1">
          <span className="w-9 h-9 rounded-xl bg-white border border-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0">
            <SettingsIcon className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Configuración del calendario</h2>
            <p className="text-xs text-gray-400 mt-0.5">Administra personas, equipos y generación de nuevas semanas.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <RosterSection campusId={campusId} tipo={tipo} titulo={titulo} administradores={administradores} isAdmin={isAdmin} />
          <EquiposSection campusId={campusId} tipo={tipo} equipos={equipos} administradores={administradores} isAdmin={isAdmin} />
        </div>

        {isAdmin && (
          usaModalidad ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <GenerarCalendarioSection campusId={campusId} tipo={tipo} equipos={equiposAM} modalidad="AM"
                titulo={`Generar calendario — ${MODALIDAD_LABEL.AM}`} />
              <GenerarCalendarioSection campusId={campusId} tipo={tipo} equipos={equiposPM} modalidad="PM"
                titulo={`Generar calendario — ${MODALIDAD_LABEL.PM}`} />
            </div>
          ) : (
            <GenerarCalendarioSection campusId={campusId} tipo={tipo} equipos={equipos} />
          )
        )}
      </section>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const TABS: { key: CampusTurnoTipo; label: string; titulo: string }[] = [
  { key: 'administradores',     label: 'Administradores',        titulo: 'Administradores' },
  { key: 'lideres_voluntarios', label: 'Líderes de voluntarios', titulo: 'Líderes de voluntarios' },
];

export function CampusDetailClient({ campusId }: { campusId: number }) {
  const router = useRouter();
  const { isAdmin, can } = usePermissions();
  const hasAccess = isAdmin || can('campus:edit');
  const { data: campus, isLoading } = useCampus(campusId);
  const [tab, setTab] = useState<CampusTurnoTipo>('administradores');

  useEffect(() => {
    if (!hasAccess) router.replace('/dashboard');
  }, [hasAccess, router]);

  if (!hasAccess) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Link
        href="/dashboard/administracion-campus"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-gray-400 hover:text-gray-700 transition-colors group"
      >
        <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Adm. Campus
      </Link>

      {isLoading || !campus ? (
        <div className="text-sm text-gray-400 py-8 text-center">Cargando campus...</div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            <div className="flex items-start gap-4">
              <span className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <CalendarIcon />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600 mb-1">Calendarios del campus</p>
                <h1 className="text-2xl font-bold text-gray-900">{campus.name}</h1>
                {(campus.city || campus.address) && (
                  <p className="text-sm text-gray-500 mt-1">{campus.address ?? campus.city}</p>
                )}
              </div>
            </div>

            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-full sm:w-fit overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition-all ${
                    tab === t.key ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <CalendarioTab
            campusId={campusId}
            tipo={tab}
            titulo={TABS.find((t) => t.key === tab)!.titulo}
            isAdmin={isAdmin}
          />
        </>
      )}
    </div>
  );
}
