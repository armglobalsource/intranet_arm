'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Activity, BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCheck, Globe2, Hand, HeartHandshake, Search, Users, Wifi,
} from 'lucide-react';
import { api } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';

type GroupBy = 'month' | 'week';
type RecordType = 'all' | 'encuentro' | 'evento';

interface Metrics {
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

interface StatsResponse {
  meta: {
    year: number;
    groupBy: GroupBy;
    type: RecordType;
    campusId: number | null;
    canViewAll: boolean;
    generatedAt: string;
  };
  campuses: { id: number; name: string }[];
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
    metrics: Metrics;
    quality: Quality;
  }[];
  attendanceBreakdown: Breakdown[];
  volunteerBreakdown: Breakdown[];
  quality: Quality;
  records: StatsRecord[];
}

interface Breakdown {
  key: string;
  label: string;
  value: number;
}

interface StatsRecord {
  id: string;
  fecha: string;
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
            {groupBy === 'month' ? 'Comportamiento mensual durante el año' : 'Comportamiento semana a semana'}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-500">
          {groupBy === 'month' ? '12 meses' : `${periods.length} semanas`}
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className={`flex h-64 items-end gap-2 ${groupBy === 'week' ? 'min-w-[1450px]' : 'min-w-[680px]'}`}>
          {periods.map((period, index) => {
            const height = hasData
              ? Math.max(period.metrics.asistencia > 0 ? 8 : 2, (period.metrics.asistencia / max) * 190)
              : 2;
            return (
              <div key={period.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <div className="mb-2 text-[10px] font-semibold text-gray-600 opacity-0 transition-opacity group-hover:opacity-100">
                  {number(period.metrics.asistencia)}
                </div>
                <div
                  title={`${period.label}: ${number(period.metrics.asistencia)} asistentes`}
                  className="w-full max-w-8 rounded-t-md bg-gray-900 transition-all group-hover:bg-emerald-500"
                  style={{ height }}
                />
                <span className="mt-2 whitespace-nowrap text-[10px] capitalize text-gray-400">
                  {groupBy === 'month' ? MONTHS[index] : period.label}
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
          {quality.completeness}%
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
              {value ? `${value} sin informar` : 'Completo'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EstadisticasClient() {
  const router = useRouter();
  const { can, isAdmin } = usePermissions();
  const now = new Date();
  const canView = isAdmin || can('estadisticas:view');
  const canViewAll = isAdmin || can('estadisticas:viewAll');
  const [year, setYear] = useState(now.getFullYear());
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [type, setType] = useState<RecordType>('all');
  const [campusId, setCampusId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!canView) router.replace('/dashboard');
  }, [canView, router]);

  const { data, isLoading, isError } = useQuery<StatsResponse>({
    queryKey: ['estadisticas', year, groupBy, type, campusId],
    queryFn: () => api.get('/estadisticas', {
      params: {
        year,
        groupBy,
        type,
        ...(campusId ? { campusId } : {}),
      },
    }).then((response) => response.data),
    enabled: canView,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => setPage(1), [year, groupBy, type, campusId, search]);

  const totals = data?.totals ?? EMPTY_METRICS;
  const totalMeetings = totals.encuentros + totals.eventos;
  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data?.records ?? [];
    return (data?.records ?? []).filter((record) =>
      [record.campusName, record.encuentro, record.predicador, record.mensaje, record.fecha]
        .some((value) => value.toLowerCase().includes(term)),
    );
  }, [data?.records, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const visibleRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!canView) return null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-10">
      <header className="overflow-hidden rounded-[28px] bg-gradient-to-br from-black via-neutral-950 to-neutral-800 px-6 py-7 text-white shadow-xl sm:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Inteligencia de campus</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Estadísticas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
              Una lectura anual de encuentros, asistencia, manitos levantadas, voluntarios e impacto social.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <CalendarDays className="text-emerald-400" size={21} />
            <div>
              <p className="text-xl font-bold">{year}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Año seleccionado</p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Año</span>
            <select value={year} onChange={(event) => setYear(Number(event.target.value))}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-gray-400">
              {Array.from({ length: 7 }, (_, index) => now.getFullYear() + 1 - index).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          {canViewAll && (
            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Campus</span>
              <select value={campusId} onChange={(event) => setCampusId(event.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-gray-400">
                <option value="">Todos los campus</option>
                {(data?.campuses ?? []).map((campus) => (
                  <option key={campus.id} value={campus.id}>{campus.name}</option>
                ))}
              </select>
            </label>
          )}

          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Registros</span>
            <select value={type} onChange={(event) => setType(event.target.value as RecordType)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-gray-400">
              <option value="all">Encuentros y eventos</option>
              <option value="encuentro">Solo encuentros</option>
              <option value="evento">Solo eventos</option>
            </select>
          </label>

          <div className="grid gap-1.5 sm:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Resumen</span>
            <div className="flex rounded-xl bg-gray-100 p-1">
              {([
                ['month', 'Mensual'],
                ['week', 'Semanal'],
              ] as const).map(([value, label]) => (
                <button key={value} onClick={() => setGroupBy(value)}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    groupBy === value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          No fue posible cargar las estadísticas. Verifica tus permisos o intenta nuevamente.
        </div>
      )}

      {!isLoading && !isError && totalMeetings === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-4">
          <BarChart3 className="mt-0.5 shrink-0 text-gray-400" size={20} />
          <div>
            <p className="text-sm font-semibold text-gray-800">Aún no existen encuentros en este período</p>
            <p className="mt-1 text-xs text-gray-500">
              Los paneles ya están preparados y se completarán automáticamente con los registros enviados desde la app.
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Encuentros" value={totals.encuentros} detail={`${number(totals.eventos)} eventos adicionales`} icon={CalendarDays} />
        <MetricCard label="Asistencia" value={totals.asistencia} detail={`Promedio ${number(totals.promedioAsistencia)} por encuentro`} icon={Users} accent="#2563eb" />
        <MetricCard label="Manitos levantadas" value={totals.manitosTotal} detail={`${number(totals.manitosPresencial)} presenciales · ${number(totals.manitosOnline)} online`} icon={Hand} accent="#059669" />
        <MetricCard label="Voluntarios" value={totals.voluntarios} detail={`Promedio ${number(totals.promedioVoluntarios)} por encuentro`} icon={HeartHandshake} accent="#7c3aed" />
        <MetricCard label="Espectadores online" value={totals.espectadoresOnline} detail="Alcance digital reportado" icon={Wifi} accent="#0891b2" />
        <MetricCard label="Kilo de Amor" value={totals.kiloAmorCajas} detail={`${number(totals.kiloAmorRegistros)} registros de impacto`} icon={Globe2} accent="#e11d48" />
        <MetricCard label="Reportes completos" value={data?.quality.complete ?? 0} detail={`${data?.quality.completeness ?? 0}% de cumplimiento`} icon={ClipboardCheck} accent="#16a34a" />
        <MetricCard label="Total de servicios" value={totalMeetings} detail="Encuentros y eventos del período" icon={Activity} accent="#d97706" />
      </section>

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-20 text-center text-sm text-gray-400">
          Cargando indicadores…
        </div>
      ) : data && (
        <>
          <TrendChart periods={data.periods} groupBy={groupBy} />

          <section className="grid gap-6 xl:grid-cols-3">
            <BreakdownCard
              title="Asistencia por categoría"
              subtitle="Distribución acumulada del período"
              rows={data.attendanceBreakdown}
              color="#2563eb"
            />
            <BreakdownCard
              title="Voluntarios por área"
              subtitle="Equipos que estuvieron sirviendo"
              rows={data.volunteerBreakdown}
              color="#7c3aed"
            />
            <QualityCard quality={data.quality} />
          </section>

          {canViewAll && !campusId && (
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="font-bold text-gray-900">Comparación entre campus</h2>
                <p className="mt-1 text-xs text-gray-500">Resultados acumulados del período seleccionado</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Campus</th>
                      <th className="px-4 py-3 text-right font-semibold">Encuentros</th>
                      <th className="px-4 py-3 text-right font-semibold">Asistencia</th>
                      <th className="px-4 py-3 text-right font-semibold">Promedio</th>
                      <th className="px-4 py-3 text-right font-semibold">Manitos</th>
                      <th className="px-4 py-3 text-right font-semibold">Voluntarios</th>
                      <th className="px-4 py-3 text-right font-semibold">Online</th>
                      <th className="px-5 py-3 text-right font-semibold">Reportes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byCampus.map((campus) => (
                      <tr key={campus.campusId} className="hover:bg-gray-50/70">
                        <td className="px-5 py-3.5 font-semibold text-gray-900">{campus.campusName}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{number(campus.metrics.encuentros + campus.metrics.eventos)}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{number(campus.metrics.asistencia)}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{number(campus.metrics.promedioAsistencia)}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{number(campus.metrics.manitosTotal)}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{number(campus.metrics.voluntarios)}</td>
                        <td className="px-4 py-3.5 text-right text-gray-600">{number(campus.metrics.espectadoresOnline)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            campus.quality.completeness === 100
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {campus.quality.completeness}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-bold text-gray-900">Encuentros del año</h2>
                <p className="mt-1 text-xs text-gray-500">{number(filteredRecords.length)} registros encontrados</p>
              </div>
              <label className="relative block w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar campus, horario o predicador…"
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
                    <th className="px-5 py-3 text-right font-semibold">Completitud</th>
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
                      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-gray-700">{formatDate(record.fecha)}</td>
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
                <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">
                  <ChevronLeft size={15} />
                </button>
                <button disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-2 text-[10px] text-gray-400">
            <CheckCircle2 size={13} />
            Actualizado {new Date(data.meta.generatedAt).toLocaleString('es-CL')}
          </div>
        </>
      )}
    </div>
  );
}
