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
  type Administrador, type Equipo, type Turno,
} from '@/hooks/useCampusTurnos';

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

// ── Roster de administradores ─────────────────────────────────────────────────

function RosterSection({ campusId, administradores, isAdmin }: {
  campusId: number; administradores: Administrador[]; isAdmin: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const create = useCreateAdministrador(campusId);
  const update = useUpdateAdministrador(campusId);

  function handleAdd() {
    const trimmed = nombre.trim();
    if (!trimmed) return;
    create.mutate(trimmed, { onSuccess: () => setNombre('') });
  }

  return (
    <div className={cardCls}>
      <p className={labelCls}>Administradores</p>
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
          <span className="text-xs text-gray-400">Sin administradores aún.</span>
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

function EquiposSection({ campusId, equipos, administradores, isAdmin }: {
  campusId: number; equipos: Equipo[]; administradores: Administrador[]; isAdmin: boolean;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [nombre, setNombre]     = useState('');
  const [nombreTouched, setNombreTouched] = useState(false);
  const create = useCreateEquipo(campusId);

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
      { nombre: finalNombre, administradorIds: selected },
      { onSuccess: () => { setSelected([]); setNombre(''); setNombreTouched(false); } },
    );
  }

  return (
    <div className={cardCls}>
      <p className={labelCls}>Equipos</p>
      <p className="text-xs text-gray-400 mt-1 mb-3">
        Agrupaciones de administradores que rotan juntas semana a semana.
      </p>

      <div className="space-y-2 mb-4">
        {equipos.map((eq) => (
          <div key={eq.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <span className="text-[13px] font-medium text-gray-800">{eq.nombre}</span>
            <span className="text-[11px] text-gray-400">
              {eq.administradorIds.map((id) => nombreById.get(id)).filter(Boolean).join(', ')}
            </span>
          </div>
        ))}
        {equipos.length === 0 && (
          <span className="text-xs text-gray-400">Sin equipos aún.</span>
        )}
      </div>

      {isAdmin && (
        <div className="border-t border-gray-100 pt-3 space-y-2.5">
          <p className="text-[11px] font-medium text-gray-500">Nuevo equipo — elige sus integrantes</p>
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

function GenerarCalendarioSection({ campusId, equipos }: { campusId: number; equipos: Equipo[] }) {
  const [orden, setOrden]             = useState<number[]>([]);
  const [fechaInicio, setFechaInicio] = useState(proximoLunes());
  const [semanas, setSemanas]         = useState(12);
  const generar = useGenerarCalendario(campusId);
  const [msg, setMsg] = useState<string | null>(null);

  const equipoById = useMemo(() => new Map(equipos.map((e) => [e.id, e.nombre])), [equipos]);
  const disponibles = equipos.filter((e) => !orden.includes(e.id));

  function handleGenerar() {
    if (orden.length === 0) return;
    generar.mutate(
      { equipoIds: orden, fechaInicio, semanas },
      {
        onSuccess: (data) => { setMsg(`${data.creados} semana(s) generada(s).`); setTimeout(() => setMsg(null), 3000); },
        onError:   () => { setMsg('No se pudo generar el calendario.'); setTimeout(() => setMsg(null), 3000); },
      },
    );
  }

  return (
    <div className={cardCls}>
      <p className={labelCls}>Generar calendario</p>
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

function CalendarioTable({ campusId, turnos, equipos, isAdmin }: {
  campusId: number; turnos: Turno[]; equipos: Equipo[]; isAdmin: boolean;
}) {
  const update = useUpdateTurno(campusId);
  const [editingId, setEditingId] = useState<number | null>(null);

  const grupos = useMemo(() => {
    const map = new Map<string, Turno[]>();
    for (const t of turnos) {
      const key = mesLabel(t.fecha);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [turnos]);

  if (turnos.length === 0) {
    return (
      <div className={cardCls}>
        <p className="text-sm text-gray-400 text-center py-6">Aún no hay calendario generado.</p>
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
                {eq.nombre}
              </span>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {grupos.map(([mes, rows]) => (
          <div key={mes} className="bg-white rounded-2xl border border-gray-200 overflow-hidden self-start">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 bg-gray-50 px-4 py-2.5 border-b border-gray-100">
              {mes}
            </p>
            <div className="divide-y divide-gray-50">
              {rows.map((t) => {
                const c = teamColor(t.equipoId);
                const { dia, mes: mesAbbr } = formatFechaCompacta(t.fecha);
                const esActual = isSemanaActual(t.fecha);
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-2.5 ${esActual ? 'bg-emerald-50/60' : ''}`}
                  >
                    <div className="flex flex-col items-center justify-center w-8 flex-shrink-0 leading-none">
                      <span className="text-[15px] font-bold text-gray-800">{dia}</span>
                      <span className="text-[9px] font-semibold uppercase text-gray-400 mt-0.5">{mesAbbr}</span>
                    </div>

                    {isAdmin && editingId === t.id ? (
                      <select
                        autoFocus
                        defaultValue={t.equipoId}
                        onChange={(e) => {
                          update.mutate({ id: t.id, equipoId: Number(e.target.value) });
                          setEditingId(null);
                        }}
                        onBlur={() => setEditingId(null)}
                        className="flex-1 min-w-0 text-[12.5px] border border-gray-200 rounded-lg px-2 py-1"
                      >
                        {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nombre}</option>)}
                      </select>
                    ) : (
                      <button
                        onClick={() => isAdmin && setEditingId(t.id)}
                        className={`flex-1 min-w-0 flex items-center gap-1.5 ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <span className={`px-2 py-0.5 rounded-full text-[11.5px] font-medium truncate ${c.bg} ${c.text}`}>
                          {t.equipoNombreSnapshot}
                        </span>
                        {t.isManualOverride && (
                          <span title="Editado manualmente" className="text-amber-500 text-[11px] flex-shrink-0">✎</span>
                        )}
                        {esActual && (
                          <span className="ml-auto text-[9px] font-bold text-emerald-600 uppercase tracking-wide flex-shrink-0">
                            Hoy
                          </span>
                        )}
                      </button>
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

// ── Calendario de Administradores (pestaña) ──────────────────────────────────

function CalendarioAdministradoresTab({ campusId, isAdmin }: { campusId: number; isAdmin: boolean }) {
  const { data: administradores = [] } = useAdministradores(campusId);
  const { data: equipos = [] }         = useEquipos(campusId);
  const { data: turnos = [] }          = useTurnos(campusId);

  return (
    <div className="space-y-5">
      <RosterSection campusId={campusId} administradores={administradores} isAdmin={isAdmin} />
      <EquiposSection campusId={campusId} equipos={equipos} administradores={administradores} isAdmin={isAdmin} />
      {isAdmin && <GenerarCalendarioSection campusId={campusId} equipos={equipos} />}
      <div>
        <p className={`${labelCls} mb-3`}>Calendario</p>
        <CalendarioTable campusId={campusId} turnos={turnos} equipos={equipos} isAdmin={isAdmin} />
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type Tab = 'calendario';
const TABS: { key: Tab; label: string }[] = [
  { key: 'calendario', label: 'Calendario de Administradores' },
];

export function CampusDetailClient({ campusId }: { campusId: number }) {
  const router = useRouter();
  const { isAdmin, can } = usePermissions();
  const hasAccess = isAdmin || can('campus:manage');
  const { data: campus, isLoading } = useCampus(campusId);
  const [tab, setTab] = useState<Tab>('calendario');

  useEffect(() => {
    if (!hasAccess) router.replace('/dashboard');
  }, [hasAccess, router]);

  if (!hasAccess) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{campus.name}</h1>
            {(campus.city || campus.address) && (
              <p className="text-sm text-gray-500 mt-1">{campus.address ?? campus.city}</p>
            )}
          </div>

          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-4 py-2 rounded-lg text-[12.5px] font-semibold transition-all"
                style={tab === t.key
                  ? { background: '#fff', color: ACCENT, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
                  : { color: '#6B7280' }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'calendario' && <CalendarioAdministradoresTab campusId={campusId} isAdmin={isAdmin} />}
        </>
      )}
    </div>
  );
}
