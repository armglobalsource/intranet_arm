'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCheck, Globe2, Hand, HeartHandshake, Search, Users, Wifi,
} from 'lucide-react';
import { api } from '@/lib/api';
import { statsPreset, statsChange, validStatsRange, type StatsPreset } from '@/lib/statistics';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/lib/store/auth.store';
import { STATS_VIEWS, statsHref, statsView } from '@/lib/statistics-navigation';
import { planningRange } from '@/lib/statistics-planning';
import { OperationsPanel, ProjectionsPanel, CoveragePanel } from './PlanningPanels';

type GroupBy = 'month' | 'week' | 'year';
type RecordType = 'all' | 'encuentro' | 'evento';

interface Metrics {
  auditorio: number;
  encuentros: number;
  eventos: number;
  asistencia: number;
  voluntarios: number;
  manitosPresencial: number;
  manitosOnline: number;
  manitosTotal: number;
  espectadoresOnline: number;
  kiloAmorCajas: number;
  kiloAmorRegistros: number;
  promedioAsistencia: number;
  promedioVoluntarios: number;
}

interface Quality {
  total: number;
  complete: number;
  incomplete: number;
  completeness: number;
  missing: Record<string, number>;
}

export interface StatsResponse {
  meta: {
    year: number;
    history?: boolean;
    from: string; to: string; days: number; country: string | null;
    excludedReports: number; legacyReports: number;
    monthOnly: { reports: number; metrics: Metrics };
    groupBy: GroupBy;
    type: RecordType;
    campusId: number | null;
    canViewAll: boolean;
    generatedAt: string;
  };
  countries: string[];
  campuses: { id: number; name: string; country: string; isActive: boolean }[];
  comparison: { from: string; to: string; totals: Metrics } | null;
  totals: Metrics;
  periods: {
    key: string;
    label: string;
    start: string;
    end: string;
    metrics: Metrics;
    quality: Quality;
  }[];
  byCampus: {
    campusId: number;
    campusName: string;
    country: string;
    isActive: boolean;
    metrics: Metrics;
    quality: Quality;
  }[];
  attendanceBreakdown: Breakdown[];
  volunteerBreakdown: Breakdown[];
  virtual: VirtualAttribution | null;
  quality: Quality;
  records: StatsRecord[];
}

/** Audiencia online transmitida por otros campus y atribuida al campus Virtual (no se suma al total global). */
interface VirtualAttribution {
  campusId: number;
  campusName: string;
  reports: number;
  espectadoresOnline: number;
  manitosOnline: number;
  emitters: { campusId: number; campusName: string; reports: number; espectadoresOnline: number; manitosOnline: number }[];
  criterion: string;
}

interface Breakdown {
  key: string;
  label: string;
  value: number;
}

interface StatsRecord {
  id: string;
  fecha: string;
  /** 'mes': histórico del que solo se conoce el mes; `fecha` es el primer día y no un día real. */
  fechaPrecision: 'dia' | 'mes';
  periodo: string | null;
  campusId: number;
  campusName: string;
  tipo: 'encuentro' | 'evento';
  encuentro: string;
  predicador: string;
  mensaje: string;
  asistencia: number;
  voluntarios: number;
  manitosPresencial: number;
  manitosOnline: number;
  espectadoresOnline: number;
  completeness: number;
  registradoPor?: string | null;
}

const MONTHS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];
const PAGE_SIZE = 20;

const EMPTY_METRICS: Metrics = {
  auditorio: 0,
  encuentros: 0,
  eventos: 0,
  asistencia: 0,
  voluntarios: 0,
  manitosPresencial: 0,
  manitosOnline: 0,
  manitosTotal: 0,
  espectadoresOnline: 0,
  kiloAmorCajas: 0,
  kiloAmorRegistros: 0,
  promedioAsistencia: 0,
  promedioVoluntarios: 0,
};

function number(value: number) {
  return value.toLocaleString('es-CL');
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function MetricCard({
  label, value, detail, icon: Icon, accent = '#111827',
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Activity;
  accent?: string;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-950">{number(value)}</p>
          <p className="mt-1 text-xs text-gray-500">{detail}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}12`, color: accent }}>
          <Icon size={19} strokeWidth={2} />
        </span>
      </div>
    </article>
  );
}

function TrendChart({ periods, groupBy }: { periods: StatsResponse['periods']; groupBy: GroupBy }) {
  const max = Math.max(1, ...periods.map((period) => period.metrics.asistencia));
  const hasData = periods.some((period) => period.metrics.asistencia > 0);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-gray-900">Evolución de asistencia</h2>
          <p className="mt-1 text-xs text-gray-500">
            {groupBy === 'year' ? 'Asistencias acumuladas por año; el año actual llega hasta hoy' : groupBy === 'month' ? 'Asistencias acumuladas por mes dentro del rango' : 'Comportamiento semana a semana'}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-500">
          {`${periods.length} ${groupBy === 'year' ? 'años' : groupBy === 'month' ? 'meses' : 'semanas'}`}
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex h-64 items-end gap-2" style={{ minWidth: Math.max(320, periods.length * 58) }}>
          {periods.map((period, index) => {
            const height = hasData
              ? Math.max(period.metrics.asistencia > 0 ? 8 : 2, (period.metrics.asistencia / max) * 190)
              : 2;
            return (
              <div key={period.key} tabIndex={0} aria-label={`${period.label}: ${number(period.metrics.asistencia)} asistencias, ${period.start} al ${period.end}`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end focus:outline-violet-500">
                <div className="mb-2 text-[10px] font-semibold text-gray-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                  {number(period.metrics.asistencia)}
                </div>
                <div
                  title={`${period.label}: ${number(period.metrics.asistencia)} asistentes`}
                  className="w-full max-w-8 rounded-t-md bg-gray-900 transition-all group-hover:bg-emerald-500"
                  style={{ height }}
                />
                <span className="mt-2 whitespace-nowrap text-[10px] capitalize text-gray-400">
                  {groupBy === 'month' ? `${MONTHS[Number(period.key.slice(5, 7)) - 1]} ${period.key.slice(2, 4)}` : period.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {!hasData && (
        <p className="mt-2 text-center text-xs text-gray-400">
          El gráfico se completará automáticamente cuando se registren encuentros.
        </p>
      )}
    </section>
  );
}

function BreakdownCard({
  title, subtitle, rows, color,
}: {
  title: string;
  subtitle: string;
  rows: Breakdown[];
  color: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-xs text-gray-400">
            Sin datos para este período.
          </div>
        ) : rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-gray-600">{row.label}</span>
              <span className="font-bold text-gray-900">{number(row.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function QualityCard({ quality }: { quality: Quality }) {
  const missingLabels: Record<string, string> = {
    asistencia: 'Asistencia',
    voluntarios: 'Voluntarios',
    manitos: 'Manitos levantadas',
    espectadoresOnline: 'Espectadores online',
    predicador: 'Predicador',
  };
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-gray-900">Calidad de reportes</h2>
          <p className="mt-1 text-xs text-gray-500">Campos clave informados en cada encuentro</p>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-emerald-100 text-lg font-bold text-emerald-700">
          {quality.total ? quality.completeness + '%' : '—'}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-2xl font-bold text-emerald-700">{quality.complete}</p>
          <p className="text-xs text-emerald-700/70">Completos</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-2xl font-bold text-amber-700">{quality.incomplete}</p>
          <p className="text-xs text-amber-700/70">Por completar</p>
        </div>
      </div>
      <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
        {Object.entries(quality.missing).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{missingLabels[key] ?? key}</span>
            <span className={value ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-600'}>
              {!quality.total ? 'Sin registros' : value ? `${value} sin informar` : 'Completo'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}


function ComparisonCard({ label, current, previous }: { label: string; current: number; previous: number }) {
  const { delta, percent } = statsChange(current, previous);
  return <article className="rounded-2xl border border-violet-100 bg-white p-4">
    <p className="text-sm font-semibold text-slate-700">{label}</p>
    <p className="mt-2 text-2xl font-bold text-slate-900">{number(current)}</p>
    <p className="mt-1 text-xs text-slate-500">Anterior: {number(previous)}</p>
    <p className="mt-3 text-sm font-semibold text-violet-700">{delta > 0 ? '+' : ''}{number(delta)} · {percent === null ? 'Sin base porcentual' : (percent > 0 ? '+' : '') + number(percent) + '%'}</p>
  </article>;
}

export function EstadisticasClient() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const view = statsView(pathname);
  const tab = view.id;
  const user = useAuthStore((state) => state.user);
  const scopeKey = JSON.stringify([user?.id, user?.campusId, user?.permissions]);
  const { can, isAdmin } = usePermissions();
  const canView = isAdmin || can('estadisticas:view');
  const canViewAll = isAdmin || can('estadisticas:viewAll');
  const initialPreset = tab === 'operations' ? 'week' : 'history';
  const [range, setRange] = useState(() => statsPreset(initialPreset));
  const [draft, setDraft] = useState(range);
  const [preset, setPreset] = useState<StatsPreset>(initialPreset);
  const [history, setHistory] = useState(initialPreset === 'history');
  const [rangeError, setRangeError] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('year');
  const [type, setType] = useState<RecordType>('all');
  const [country, setCountry] = useState('');
  const [campusId, setCampusId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { if (!canView) router.replace('/dashboard'); }, [canView, router]);
  const queryRange = tab === 'projections' ? planningRange() : range;
  const queryHistory = tab === 'projections' ? false : history;
  const queryType = tab === 'projections' ? 'encuentro' : type;
  const queryGroup = tab === 'projections' ? 'week' : groupBy;
  const { data, isLoading, isFetching, isError, refetch } = useQuery<StatsResponse>({
    queryKey: ['estadisticas', scopeKey, queryHistory, queryRange.from, queryRange.to, queryGroup, queryType, country, campusId],
    queryFn: () => api.get('/estadisticas', { params: {
      year: Number(queryRange.from.slice(0, 4)), groupBy: queryGroup, type: queryType,
      ...(queryHistory ? { period: 'history' } : { from: queryRange.from, to: queryRange.to }),
      ...(country ? { country } : {}), ...(campusId ? { campusId } : {}),
    } }).then((response) => response.data),
    enabled: canView, staleTime: 60_000, retry: false,
  });
  // Keep authorized selector choices available while another filtered request loads.
  const [savedCatalog, setCatalog] = useState<Pick<StatsResponse, 'countries' | 'campuses'> & { scopeKey: string }>({ scopeKey, countries: [], campuses: [] });
  const catalog = savedCatalog.scopeKey === scopeKey ? savedCatalog : { countries: [], campuses: [] };
  useEffect(() => { if (data) setCatalog({ scopeKey, countries: data.countries, campuses: data.campuses }); }, [data, scopeKey]);
  useEffect(() => setPage(1), [range, groupBy, type, country, campusId, search]);
  function applyPreset(value: StatsPreset) {
    setPreset(value); setRangeError('');
    if (value !== 'custom') {
      setHistory(value === 'history');
      const selected = statsPreset(value); setRange(selected); setDraft(selected);
      setGroupBy(value === 'history' ? 'year' : value === 'year' ? 'month' : 'week');
    } else setDraft(history ? statsPreset('year') : range);
  }
  const totals = data?.totals ?? EMPTY_METRICS;
  const totalMeetings = totals.encuentros + totals.eventos;
  const filteredRecords = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const term = normalize(search.trim());
    return (data?.records ?? []).filter((record) => [record.campusName, record.encuentro, record.predicador, record.mensaje, record.fecha].some((value) => normalize(value ?? '').includes(term)));
  }, [data?.records, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const visibleRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const periodLabel = formatDate(data?.meta.from ?? queryRange.from) + ' — ' + formatDate(data?.meta.to ?? queryRange.to);
  const inputClass = 'min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-violet-500';
  if (!canView) return null;
  return <div className="mx-auto min-w-0 max-w-[1600px] space-y-5 pb-10">
    <header className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-violet-700">ARM Global · Nuestra comunidad en cifras</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-3xl font-bold text-slate-900">Estadísticas</h1><h2 className="mt-2 text-lg font-semibold text-violet-800">{view.label}</h2><p className="mt-2 max-w-2xl text-sm text-slate-600">{view.description}</p></div>
        <div className="flex flex-wrap gap-2">
          {(isAdmin || can('encuentros:create')) && <Link href="/dashboard/produccion-general/estadisticas/registrar" className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white">Registrar encuentro</Link>}
          <button onClick={() => void refetch()} disabled={isFetching} className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 disabled:opacity-50">{isFetching ? 'Actualizando…' : 'Actualizar datos'}</button>
        </div>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays size={17} aria-hidden="true" />{periodLabel}</p>
    </header>

    <section aria-label="Filtros de estadísticas" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tab !== 'projections' && <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Período
          <select aria-label="Período" className={inputClass} value={preset} onChange={(e) => applyPreset(e.target.value as StatsPreset)}>
            <option value="history">Histórico disponible · 2020 hasta hoy</option><option value="week">Última semana completa</option><option value="month">Este mes hasta hoy</option><option value="year">Este año hasta hoy</option><option value="custom">Fechas personalizadas</option>
          </select>
        </label>}
        {canViewAll && <label className="grid gap-1.5 text-xs font-semibold text-slate-600">País
          <select aria-label="País" className={inputClass} value={country} onChange={(e) => { setCountry(e.target.value); setCampusId(''); }}>
            <option value="">Todos los países</option>{catalog.countries.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>}
        {canViewAll && <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Campus
          <select aria-label="Campus" className={inputClass} value={campusId} onChange={(e) => setCampusId(e.target.value)}>
            <option value="">Todos los campus</option>{catalog.campuses.filter((c) => !country || c.country === country).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.country}{c.isActive ? '' : ' (inactivo)'}</option>)}
          </select>
        </label>}
        {tab !== 'projections' && <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Registros
          <select aria-label="Registros" className={inputClass} value={type} onChange={(e) => setType(e.target.value as RecordType)}><option value="all">Encuentros y eventos</option><option value="encuentro">Solo encuentros</option><option value="evento">Solo eventos</option></select>
        </label>}
      </div>
      {tab !== 'projections' && preset === 'custom' && <form onSubmit={(e) => { e.preventDefault(); if (!validStatsRange(draft.from, draft.to)) { setRangeError('Selecciona fechas válidas, en orden y con un máximo de 366 días.'); return; } setRangeError(''); setHistory(false); setRange({ ...draft }); }} className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-semibold text-slate-600">Desde<input type="date" required min="2000-01-01" max="2100-12-31" className={inputClass} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
        <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-semibold text-slate-600">Hasta<input type="date" required min="2000-01-01" max="2100-12-31" className={inputClass} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
        <button className="min-h-[42px] rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white">Aplicar fechas</button>
        {rangeError && <p role="alert" className="w-full text-sm text-red-700">{rangeError}</p>}
      </form>}
      <p className="text-xs text-slate-500">{canViewAll ? 'Consulta global o por campus, incluidos sus registros históricos.' : 'Solo se muestran los registros de tu campus.'} Los períodos rápidos usan la fecha de Chile (America/Santiago).</p>
    </section>

    <nav aria-label="Vistas de estadísticas" className="flex flex-wrap gap-2">
      {STATS_VIEWS.map(item => <button key={item.id} aria-pressed={tab === item.id} onClick={() => {
        if (item.id === 'operations') applyPreset('week');
        window.history.pushState(null, '', statsHref(item.slug));
      }} className={'rounded-xl px-4 py-2.5 text-sm font-semibold ' + (tab === item.id ? 'bg-violet-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-violet-50')}>{item.label}</button>)}
    </nav>
    {isError ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">No fue posible cargar las estadísticas. <button onClick={() => void refetch()} className="ml-2 min-h-[44px] font-semibold underline">Reintentar</button></div>
      : isLoading || !data ? <p role="status" className="rounded-2xl bg-white p-10 text-center text-sm text-slate-600">Cargando indicadores…</p>
      : <>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>{totalMeetings} registros incluidos · {data.meta.days} días</span>
          <span>{data.meta.legacyReports} registros históricos incluidos</span>
          {data.meta.excludedReports > 0 && <span className="text-amber-800">{data.meta.excludedReports} {data.meta.excludedReports === 1 ? 'reporte no cuenta' : 'reportes no cuentan'}: esperan que el administrador del campus los suba</span>}
        </div>
        {(data.meta.monthOnly?.reports ?? 0) > 0 && <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Incluye {number(data.meta.monthOnly.reports)} reportes históricos de los que solo se conoce el mes ({number(data.meta.monthOnly.metrics.asistencia)} asistencias). Suman en los totales, por campus, por año y por mes; no aparecen en las semanas. Solo se incluyen cuando el rango cubre el mes completo.
        </p>}
        {totalMeetings === 0 && <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">No hay encuentros incluidos en este período. Prueba otras fechas o revisa los filtros.</p>}
        {data.meta.history && <p className="text-sm text-slate-600">Histórico desde 2020: incluye los reportes disponibles y aprobados hasta hoy. Los datos históricos pendientes de revisión todavía no forman parte de estos totales.</p>}
        {tab === 'summary' && <section aria-label="Resumen de estadísticas" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Asistencias" value={totals.asistencia} detail="Participaciones acumuladas, no personas únicas" icon={Users} accent="#7c3aed" />
            <MetricCard label="Auditorio" value={totals.auditorio} detail="Asistencias registradas en auditorio" icon={Activity} accent="#2563eb" />
            <MetricCard label="Decisiones de fe" value={totals.manitosTotal} detail={number(totals.manitosPresencial) + ' presenciales · ' + number(totals.manitosOnline) + ' online'} icon={Hand} accent="#059669" />
            <MetricCard label="Voluntarios" value={totals.voluntarios} detail="Participaciones de servicio acumuladas" icon={HeartHandshake} accent="#d97706" />
          </div>
          {data.comparison && <section aria-label="Comparación de períodos" className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 sm:p-5">
            <h2 className="font-bold text-slate-900">Comparado con el período anterior</h2>
            <p className="mt-1 text-sm text-slate-600">{formatDate(data.comparison.from)} — {formatDate(data.comparison.to)} · {data.meta.days} días de igual duración, inmediatamente anteriores.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ComparisonCard label="Asistencias" current={totals.asistencia} previous={data.comparison.totals.asistencia} />
              <ComparisonCard label="Promedio por servicio" current={totals.promedioAsistencia} previous={data.comparison.totals.promedioAsistencia} />
              <ComparisonCard label="Decisiones de fe" current={totals.manitosTotal} previous={data.comparison.totals.manitosTotal} />
              <ComparisonCard label="Encuentros y eventos" current={totalMeetings} previous={data.comparison.totals.encuentros + data.comparison.totals.eventos} />
            </div>
            <p className="mt-3 text-xs text-slate-600">Una variación también puede reflejar reportes faltantes. Revisa la calidad de los datos antes de interpretarla.</p>
          </section>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Servicios registrados" value={totalMeetings} detail={number(totals.encuentros) + ' encuentros · ' + number(totals.eventos) + ' eventos'} icon={CalendarDays} />
            <MetricCard label="Espectadores online" value={totals.espectadoresOnline} detail="Suma de espectadores a la vez por transmisión; no personas únicas" icon={Wifi} accent="#0891b2" />
            <MetricCard label="Kilo de Amor" value={totals.kiloAmorCajas} detail={number(totals.kiloAmorRegistros) + ' registros · independiente del tipo de encuentro'} icon={Globe2} accent="#e11d48" />
            <MetricCard label="Reportes completos" value={data.quality.complete} detail={data.quality.completeness + '% con todos los campos clave'} icon={ClipboardCheck} accent="#16a34a" />
          </div>
        </section>}
        {tab === 'trends' && <section aria-label="Evolución de estadísticas" className="space-y-5">
          <div className="flex flex-wrap items-center gap-2"><span className="mr-2 text-sm text-slate-600">Agrupar por</span>{([['year', 'Año'], ['month', 'Mes'], ['week', 'Semana']] as const).map(([value, label]) => <button key={value} aria-pressed={groupBy === value} onClick={() => setGroupBy(value)} className={'rounded-xl px-4 py-2 text-sm font-semibold ' + (groupBy === value ? 'bg-violet-700 text-white' : 'bg-white text-slate-600 border border-slate-200')}>{label}</button>)}</div>
          <TrendChart periods={data.periods} groupBy={groupBy} />
          <p className="text-xs text-slate-500">Los extremos del gráfico se limitan a las fechas seleccionadas; pueden ser años, meses o semanas parciales.</p>
          <div className="grid gap-5 xl:grid-cols-3"><BreakdownCard title="Asistencia por categoría" subtitle="Distribución acumulada del período" rows={data.attendanceBreakdown} color="#7c3aed" /><BreakdownCard title="Voluntarios por área" subtitle="Participaciones por equipo de servicio" rows={data.volunteerBreakdown} color="#059669" /><QualityCard quality={data.quality} /></div>
        </section>}
        {tab === 'campuses' && <section aria-label="Resultados por campus" className="space-y-5">
          <div><h2 className="text-lg font-bold text-slate-900">Cada campus, una historia</h2><p className="mt-1 text-sm text-slate-600">Totales del período y promedio por encuentro o evento registrado.</p></div>
          {data.virtual && <section aria-label="Audiencia del campus Virtual" className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5">
            <h3 className="flex items-center gap-2 font-bold text-slate-900"><Wifi size={17} className="text-cyan-700" aria-hidden="true" />{data.virtual.campusName}: audiencia transmitida desde otros campus</h3>
            <p className="mt-1 text-sm text-slate-600">{number(data.virtual.reports)} transmisiones online · {number(data.virtual.espectadoresOnline)} espectadores · {number(data.virtual.manitosOnline)} decisiones online.</p>
            {data.virtual.emitters.length > 0 && <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{data.virtual.emitters.map((e) => <li key={e.campusId} className="rounded-xl bg-white p-3 text-sm"><span className="font-semibold text-slate-800">{e.campusName}</span><span className="block text-xs text-slate-500">{number(e.reports)} transmisiones · {number(e.espectadoresOnline)} espectadores · {number(e.manitosOnline)} decisiones</span></li>)}</ul>}
            <p className="mt-3 text-xs text-slate-600">{data.virtual.criterion} Estas cifras se muestran aparte: no se suman otra vez al total del período ni a la tarjeta del campus emisor.</p>
          </section>}
          {Array.from(new Set(data.byCampus.map((c) => c.country))).sort((a, b) => a.localeCompare(b, 'es')).map((name) => <section key={name} className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800"><Globe2 size={17} className="text-violet-600" />{name}</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.byCampus.filter((c) => c.country === name).map((c) => <article key={c.campusId} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h4 className="font-bold text-slate-900">{c.campusName}{!c.isActive && <span className="ml-2 text-xs font-normal text-slate-500">Inactivo</span>}</h4>
              <p className="mt-1 text-xs text-slate-500">{c.metrics.encuentros + c.metrics.eventos} servicios registrados</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">{([['Asistencias', c.metrics.asistencia], ['Promedio', c.metrics.promedioAsistencia], ['Decisiones', c.metrics.manitosTotal], ['Voluntarios', c.metrics.voluntarios]] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-bold text-slate-800">{number(value)}</dd></div>)}</dl>
              <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600">{c.quality.total ? c.quality.completeness + '% de reportes completos' : 'Sin reportes en este período'}</p>
            </article>)}</div>
          </section>)}
          {data.byCampus.length === 0 && <p className="text-sm text-slate-500">No hay campus para esta selección.</p>}
        </section>}
        {tab === 'operations' && <OperationsPanel data={data} canRegister={isAdmin || can('encuentros:create')} canReview={isAdmin || can('encuentros:review')} />}
        {tab === 'projections' && <ProjectionsPanel data={data} />}
        {tab === 'quality' && <div className="space-y-5"><QualityCard quality={data.quality} /><CoveragePanel data={data} /></div>}
        {tab === 'records' && (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-bold text-gray-900">Registros del período</h2>
                <p className="mt-1 text-xs text-gray-500">{number(filteredRecords.length)} registros encontrados</p>
              </div>
              <label className="relative block w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)}
                  aria-label="Buscar registros" placeholder="Buscar campus, horario o predicador…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gray-400 focus:bg-white" />
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Campus</th>
                    <th className="px-4 py-3 font-semibold">Encuentro</th>
                    <th className="px-4 py-3 font-semibold">Predicador</th>
                    <th className="px-4 py-3 text-right font-semibold">Asistencia</th>
                    <th className="px-4 py-3 text-right font-semibold">Manitos</th>
                    <th className="px-4 py-3 text-right font-semibold">Voluntarios</th>
                    <th className="px-5 py-3 text-right font-semibold">Campos completos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-400">
                        No existen registros para mostrar.
                      </td>
                    </tr>
                  ) : visibleRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/70">
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-gray-700">{record.fechaPrecision === 'mes'
                        ? <>{MONTHS[Number((record.periodo ?? record.fecha).slice(5, 7)) - 1]} {(record.periodo ?? record.fecha).slice(0, 4)} <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title="El origen no registró el día de este reporte">solo mes</span></>
                        : formatDate(record.fecha)}</td>
                      <td className="px-4 py-3.5 font-semibold text-gray-900">{record.campusName}</td>
                      <td className="px-4 py-3.5">
                        <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          record.tipo === 'evento' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {record.tipo === 'evento' ? 'Evento' : 'Encuentro'}
                        </span>
                        <span className="text-gray-600">{record.encuentro || 'Sin horario'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">{record.predicador || '—'}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{number(record.asistencia)}</td>
                      <td className="px-4 py-3.5 text-right text-gray-600">{number(record.manitosPresencial + record.manitosOnline)}</td>
                      <td className="px-4 py-3.5 text-right text-gray-600">{number(record.voluntarios)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          record.completeness === 100
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          {record.completeness}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400">Página {page} de {pageCount}</p>
              <div className="flex gap-2">
                <button aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">
                  <ChevronLeft size={15} />
                </button>
                <button aria-label="Página siguiente" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        )}
        <p className="flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 size={14} aria-hidden="true" />Actualizado {new Date(data.meta.generatedAt).toLocaleString('es-CL')}</p>
      </>}
  </div>;
}
