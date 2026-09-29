'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity, AlertTriangle, Banknote, CalendarDays, CheckCircle2, Coins,
  CreditCard, Gift, HandCoins, RefreshCw, Wallet,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useActiveCampuses } from '@/hooks/useCampus';
import {
  useSiembraDashboard, useUpdateTipoCambio, useRefreshTipoCambio,
  type GroupBy, type SiembraDashboardResponse, type SiembraReferencia,
} from '@/hooks/useSiembraDashboard';

const ACCENTS = {
  ofrendas: '#2563eb',
  diezmos: '#059669',
  otros: '#7c3aed',
  totalClp: '#111827',
  totalUsd: '#0891b2',
  efectivo: '#e11d48',
  sumup: '#16a34a',
  registros: '#d97706',
};

function number(value: number) {
  return Math.round(value).toLocaleString('es-CL');
}

function money(value: number, prefix = '$') {
  return `${prefix}${number(value)}`;
}

function MetricCard({
  label, value, detail, icon: Icon, accent = '#111827',
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  accent?: string;
}) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-950">{value}</p>
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

function BreakdownCard({
  title, subtitle, rows, color,
}: {
  title: string;
  subtitle: string;
  rows: { key: string; label: string; value: number }[];
  color: string;
}) {
  const positive = rows.filter((row) => row.value > 0);
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
      <div className="mt-5 space-y-3">
        {positive.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-xs text-gray-400">
            Sin datos para este período.
          </div>
        ) : rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-gray-600">{row.label}</span>
              <span className="font-bold text-gray-900">{money(row.value)}</span>
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

function TrendChart({ periods, groupBy, currency }: {
  periods: SiembraDashboardResponse['periods'];
  groupBy: GroupBy;
  currency: 'clp' | 'usd';
}) {
  const values = periods.map((p) => (currency === 'clp' ? p.referenceCLP : p.referenceUSD));
  const max = Math.max(1, ...values);
  const hasData = values.some((v) => v > 0);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-gray-900">Evolución de la siembra</h2>
          <p className="mt-1 text-xs text-gray-500">
            {groupBy === 'month' ? 'Comportamiento mensual durante el año'
              : groupBy === 'week' ? 'Comportamiento semana a semana'
              : 'Comportamiento día a día'}
            {' · referencia en '}{currency.toUpperCase()}
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-500">
          {groupBy === 'month' ? '12 meses' : groupBy === 'week' ? `${periods.length} semanas` : `${periods.length} días`}
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="flex h-64 items-end gap-2"
          style={{ minWidth: groupBy === 'day' ? periods.length * 20 : groupBy === 'week' ? 1450 : 680 }}
        >
          {periods.map((period, index) => {
            const value = values[index];
            const height = hasData ? Math.max(value > 0 ? 8 : 2, (value / max) * 190) : 2;
            return (
              <div key={period.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <div className="mb-2 text-[10px] font-semibold text-gray-600 opacity-0 transition-opacity group-hover:opacity-100">
                  {money(value)}
                </div>
                <div
                  title={`${period.label}: ${money(value)}`}
                  className="w-full max-w-8 rounded-t-md bg-gray-900 transition-all group-hover:bg-emerald-500"
                  style={{ height }}
                />
                <span className="mt-2 whitespace-nowrap text-[10px] capitalize text-gray-400">
                  {groupBy === 'day' && index % 7 !== 0 ? '' : period.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {!hasData && (
        <p className="mt-2 text-center text-xs text-gray-400">
          El gráfico se completará automáticamente cuando se registren siembras.
        </p>
      )}
    </section>
  );
}

function RefreshRatesButton() {
  const refresh = useRefreshTipoCambio();

  return (
    <button
      onClick={() => refresh.mutate()}
      disabled={refresh.isPending}
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-40"
    >
      <RefreshCw size={13} className={refresh.isPending ? 'animate-spin' : ''} />
      {refresh.isPending ? 'Actualizando…' : 'Actualizar ahora'}
    </button>
  );
}

function TipoCambioRow({ moneda, label, rate }: {
  moneda: string;
  label: string;
  rate?: { unitsPerUSD: number; source?: 'api' | 'manual'; updatedAt?: string };
}) {
  const [value, setValue] = useState(rate?.unitsPerUSD ? String(rate.unitsPerUSD) : '');
  const update = useUpdateTipoCambio();

  function save() {
    const parsed = Number(value);
    if (!parsed || parsed <= 0) return;
    update.mutate({ moneda, unitsPerUSD: parsed });
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <div className="w-28 shrink-0">
        <p className="text-sm font-bold text-gray-900">{moneda}</p>
        <p className="truncate text-[11px] text-gray-400">{label}</p>
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="unidades por 1 USD"
        type="number"
        min={0}
        step="any"
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-gray-400"
      />
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
        rate?.source === 'manual' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'
      }`}>
        {rate?.source === 'manual' ? 'Manual' : 'API'}
      </span>
      <button
        onClick={save}
        disabled={update.isPending || !value}
        className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        {update.isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}

const EMPTY_REF: SiembraReferencia = {
  ofrendas: 0, diezmos: 0, otros: 0, total: 0, efectivo: 0, sumup: 0, metodoDesconocido: 0,
  missingRateCurrencies: [],
};

export function FinanzasDashboardClient() {
  const router = useRouter();
  const { can, isAdmin } = usePermissions();
  const now = new Date();
  const canView = isAdmin || can('finanzas:view');
  const canManageRates = isAdmin || can('arm-catalogos:manage');

  const [year, setYear] = useState(now.getFullYear());
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [campus, setCampus] = useState('');
  const [trendCurrency, setTrendCurrency] = useState<'clp' | 'usd'>('clp');

  useEffect(() => {
    if (!canView) router.replace('/dashboard');
  }, [canView, router]);

  const { data, isLoading, isError } = useSiembraDashboard(year, groupBy, campus || undefined);
  const { data: campuses } = useActiveCampuses();

  if (!canView) return null;

  const clp = data?.reference.clp ?? EMPTY_REF;
  const usd = data?.reference.usd ?? EMPTY_REF;
  const missing = clp.missingRateCurrencies;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-10">
      <header className="overflow-hidden rounded-[28px] bg-gradient-to-br from-black via-neutral-950 to-neutral-800 px-6 py-7 text-white shadow-xl sm:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Producción General</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Finanzas</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
              Ofrendas, diezmos y otros aportes registrados desde la app móvil, por moneda y en el tiempo.
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Año</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-gray-400">
              {Array.from({ length: 7 }, (_, index) => now.getFullYear() + 1 - index).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Campus</span>
            <select value={campus} onChange={(e) => setCampus(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-gray-400">
              <option value="">Todos los campus</option>
              {(campuses ?? []).map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Vista</span>
            <div className="flex rounded-xl bg-gray-100 p-1">
              {([['month', 'Mensual'], ['week', 'Semanal'], ['day', 'Diario']] as const).map(([value, label]) => (
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
          No fue posible cargar el dashboard de siembras. Verifica tus permisos o intenta nuevamente.
        </div>
      )}

      {missing.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Sin tasa de cambio configurada para: {missing.join(', ')}
            </p>
            <p className="mt-1 text-xs text-amber-700/80">
              Esos montos no se incluyen en los totales de referencia CLP/USD hasta que se configure una tasa.
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ofrendas" value={money(clp.ofrendas)} detail="Referencia en CLP" icon={Gift} accent={ACCENTS.ofrendas} />
        <MetricCard label="Diezmos" value={money(clp.diezmos)} detail="Referencia en CLP" icon={HandCoins} accent={ACCENTS.diezmos} />
        <MetricCard label="Otros aportes" value={money(clp.otros)} detail="Referencia en CLP" icon={Coins} accent={ACCENTS.otros} />
        <MetricCard label="Total general" value={money(clp.total)} detail={`≈ ${money(usd.total, 'US$')} de referencia`} icon={Banknote} accent={ACCENTS.totalClp} />
        <MetricCard label="Efectivo / Sobres" value={money(clp.efectivo)} detail="Referencia en CLP" icon={Wallet} accent={ACCENTS.efectivo} />
        <MetricCard label="SumUp (tarjeta)" value={money(clp.sumup)} detail="Referencia en CLP" icon={CreditCard} accent={ACCENTS.sumup} />
        <MetricCard label="Total en USD" value={money(usd.total, 'US$')} detail="Referencia consolidada" icon={RefreshCw} accent={ACCENTS.totalUsd} />
        <MetricCard
          label="Registros del período"
          value={number(data?.meta.recordCount ?? 0)}
          detail={data?.meta.legacyRecordCount ? `${data.meta.legacyRecordCount} de formato antiguo` : 'Todos itemizados'}
          icon={Activity}
          accent={ACCENTS.registros}
        />
      </section>

      {isLoading ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-20 text-center text-sm text-gray-400">
          Cargando indicadores…
        </div>
      ) : data && (
        <>
          <div className="flex items-center justify-end gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Tendencia en</span>
            <div className="flex rounded-xl bg-gray-100 p-1">
              {(['clp', 'usd'] as const).map((value) => (
                <button key={value} onClick={() => setTrendCurrency(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    trendCurrency === value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  {value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <TrendChart periods={data.periods} groupBy={groupBy} currency={trendCurrency} />

          <section className="grid gap-6 xl:grid-cols-2">
            <BreakdownCard
              title="Ofrendas, Diezmos y Otros aportes"
              subtitle="Distribución acumulada del período (referencia CLP)"
              rows={[
                { key: 'ofrendas', label: 'Ofrendas', value: clp.ofrendas },
                { key: 'diezmos', label: 'Diezmos', value: clp.diezmos },
                { key: 'otros', label: 'Otros aportes', value: clp.otros },
              ]}
              color="#2563eb"
            />
            <BreakdownCard
              title="Método de pago"
              subtitle="Efectivo/Sobres vs SumUp (referencia CLP)"
              rows={[
                { key: 'efectivo', label: 'Efectivo / Sobres', value: clp.efectivo },
                { key: 'sumup', label: 'SumUp (tarjeta)', value: clp.sumup },
                ...(clp.metodoDesconocido > 0
                  ? [{ key: 'sinMetodo', label: 'Sin método (registros antiguos)', value: clp.metodoDesconocido }]
                  : []),
              ]}
              color="#7c3aed"
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-bold text-gray-900">Montos por moneda (sin convertir)</h2>
              <p className="mt-1 text-xs text-gray-500">Tal como se registraron en cada moneda</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Moneda</th>
                    <th className="px-4 py-3 text-right font-semibold">Ofrendas</th>
                    <th className="px-4 py-3 text-right font-semibold">Diezmos</th>
                    <th className="px-4 py-3 text-right font-semibold">Otros</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-5 py-3 text-right font-semibold">Tasa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.currencies.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">
                        No hay registros de siembra para este período.
                      </td>
                    </tr>
                  ) : data.currencies.map((c) => (
                    <tr key={c.moneda} className="hover:bg-gray-50/70">
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{c.label} <span className="text-gray-400">({c.moneda})</span></td>
                      <td className="px-4 py-3.5 text-right text-gray-600">{number(c.ofrendas)}</td>
                      <td className="px-4 py-3.5 text-right text-gray-600">{number(c.diezmos)}</td>
                      <td className="px-4 py-3.5 text-right text-gray-600">{number(c.otros)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{number(c.total)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          c.hasRate ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {c.hasRate ? 'Configurada' : 'Sin tasa'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {canManageRates && (
            <details className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer font-bold text-gray-900">Tasas de cambio (admin)</summary>
              <div className="mt-2 flex items-start justify-between gap-4">
                <p className="text-xs text-gray-500">
                  Unidades de cada moneda equivalentes a 1 USD. Se actualizan automáticamente una vez al día desde una
                  API pública; también se pueden editar manualmente si hace falta un ajuste puntual.
                </p>
                <RefreshRatesButton />
              </div>
              <div className="mt-4 space-y-2">
                {data.currencies.map((c) => (
                  <TipoCambioRow
                    key={c.moneda}
                    moneda={c.moneda}
                    label={c.label}
                    rate={data.fxRates.find((r) => r.moneda === c.moneda)}
                  />
                ))}
              </div>
            </details>
          )}

          <div className="flex items-center justify-end gap-2 text-[10px] text-gray-400">
            <CheckCircle2 size={13} />
            Actualizado {new Date(data.meta.generatedAt).toLocaleString('es-CL')}
          </div>
        </>
      )}
    </div>
  );
}
