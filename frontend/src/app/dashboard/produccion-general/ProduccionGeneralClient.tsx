'use client';

import Link from 'next/link';
import { useFichas } from '@/hooks/useFichas';
import { usePermissions } from '@/hooks/usePermissions';

// ── HubCard ───────────────────────────────────────────────────────────────────

interface HubCardProps {
  href:        string;
  icon:        React.ReactNode;
  eyebrow:     string;
  title:       string;
  description: string;
  accentColor: string;
  stat?:       string;
  loading?:    boolean;
}

function HubCard({ href, icon, eyebrow, title, description, accentColor, stat, loading }: HubCardProps) {
  return (
    <Link
      href={href}
      className="group relative bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300 transition-all duration-200"
    >
      <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
        {/* Icon + stat */}
        <div className="flex items-start justify-between">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}15` }}
          >
            {icon}
          </div>
          {loading ? (
            <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse mt-0.5" />
          ) : stat ? (
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full mt-0.5"
              style={{ background: `${accentColor}15`, color: accentColor }}
            >
              {stat}
            </span>
          ) : null}
        </div>

        {/* Text */}
        <div className="flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: accentColor }}>
            {eyebrow}
          </p>
          <h3 className="text-[16px] font-bold text-slate-900 leading-snug">
            {title}
          </h3>
          <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">{description}</p>
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-900 transition-colors">
            Abrir módulo
          </span>
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 bg-slate-50 transition-all group-hover:translate-x-0.5 group-hover:bg-slate-900 group-hover:text-white">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

function MetricCard({ label, value, detail, color, loading }: {
  label: string; value: number; detail: string; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      </div>
      {loading ? (
        <div className="h-7 w-16 rounded-lg bg-slate-100 animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      )}
      <p className="text-[11px] text-slate-400 mt-2">{detail}</p>
    </div>
  );
}

// ── ProduccionGeneralClient ───────────────────────────────────────────────────

export function ProduccionGeneralClient() {
  const { can, isAdmin } = usePermissions();
  const canDisponibilidad = isAdmin || can('disponibilidad:submit') || can('disponibilidad:view');
  const canTecnicos       = isAdmin || can('tecnicos:submit')       || can('tecnicos:view');

  const { data: fichas, isLoading } = useFichas();

  const total      = fichas?.length ?? 0;
  const completas  = fichas?.filter((f) => f.status === 'complete').length ?? 0;
  const enProgreso = fichas?.filter((f) => f.status === 'in_progress').length ?? 0;

  const statFichas = isLoading
    ? undefined
    : total > 0
    ? `${completas}/${total} completas`
    : 'Sin fichas';

  const modulosDisponibles = 1 + Number(canDisponibilidad) + Number(canTecnicos);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-neutral-950 to-neutral-800 px-6 py-8 font-sans sm:px-9 sm:py-10 shadow-xl shadow-neutral-300/60">
        <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-white/[0.08] blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-neutral-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-bold text-emerald-400">
              Centro de operaciones
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-normal text-white sm:text-4xl">
              Producción General
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-slate-300">
              Planifica cada encuentro, coordina la disponibilidad de los equipos y mantén
              informada a toda la comunidad desde un solo lugar.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <div>
              <p className="text-xl font-bold leading-none text-white">{modulosDisponibles}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                módulos disponibles
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Estado operativo
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Resumen de la producción</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MetricCard label="Fichas activas" value={total} detail="Total registradas" color="#0f172a" loading={isLoading} />
          <MetricCard label="En progreso" value={enProgreso} detail="Requieren seguimiento" color="#7F77DD" loading={isLoading} />
          <MetricCard label="Completas" value={completas} detail="Listas para el encuentro" color="#1D9E75" loading={isLoading} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Accesos principales
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Módulos de trabajo</h2>
          </div>
          <span className="hidden text-xs text-slate-400 sm:block">
            Selecciona un módulo para comenzar
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HubCard
          href="/dashboard/fichas-tecnicas"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
              stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          }
          eyebrow="Planificación"
          title="Fichas Técnicas"
          description="Formularios de producción semanal por campus. Coordina equipos, horarios y set list en tiempo real."
          accentColor="#0f172a"
          stat={statFichas}
          loading={isLoading}
        />

        {canDisponibilidad && (
          <HubCard
            href="/dashboard/worship/disponibilidad"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
                stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <polyline points="9 16 11 18 15 14" />
              </svg>
            }
            eyebrow="Equipo Worship"
            title="Disponibilidad Worship"
            description="Disponibilidad semanal de músicos y cantantes para los encuentros de cada campus."
            accentColor="#16a34a"
          />
        )}

        {canTecnicos && (
          <HubCard
            href="/dashboard/produccion-general/tecnicos/disponibilidad"
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
                stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M9 16h2l1-3 2 6 1-3h2" />
              </svg>
            }
            eyebrow="Equipo técnico"
            title="Disponibilidad Técnicos"
            description="Disponibilidad semanal del equipo técnico (sonido, streaming, iluminación, stage y visuales)."
            accentColor="#2563eb"
          />
        )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5 sm:p-6">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Próximas herramientas
          </p>
          <h2 className="mt-1 text-base font-bold text-slate-800">En desarrollo</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <ComingSoonCard icon="🎛️" title="Inventario Técnico" />
          <ComingSoonCard icon="📅" title="Fechas Clave" />
          <ComingSoonCard icon="🎸" title="AR Worship" />
          <ComingSoonCard icon="🎤" title="Audiciones" />
          <ComingSoonCard icon="🗓️" title="Eventos Anuales" />
        </div>
      </section>
    </div>
  );
}

// ── ComingSoonCard ────────────────────────────────────────────────────────────

function ComingSoonCard({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex min-h-28 cursor-not-allowed select-none flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 opacity-65">
      <span className="text-xl grayscale">{icon}</span>
      <div className="mt-4">
        <h3 className="text-[12px] font-bold leading-snug text-slate-700">{title}</h3>
        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
          En desarrollo
        </p>
      </div>
    </div>
  );
}
