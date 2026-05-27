'use client';

import Link from 'next/link';
import { useFichas } from '@/hooks/useFichas';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Noticia } from '@/hooks/useNoticias';
import { usePermissions } from '@/hooks/usePermissions';

// ── HubCard ───────────────────────────────────────────────────────────────────

interface HubCardProps {
  href:        string;
  icon:        React.ReactNode;
  title:       string;
  description: string;
  accentColor: string;
  stat?:       string;
  loading?:    boolean;
}

function HubCard({ href, icon, title, description, accentColor, stat, loading }: HubCardProps) {
  return (
    <Link
      href={href}
      className="group relative bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Accent bar */}
      <div className="h-[3px] w-full flex-shrink-0" style={{ background: accentColor }} />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Icon + stat */}
        <div className="flex items-start justify-between">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
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
          <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-slate-700 transition-colors leading-snug">
            {title}
          </h3>
          <p className="text-[12.5px] text-slate-400 mt-1 leading-relaxed">{description}</p>
        </div>

        {/* Arrow */}
        <div className="flex justify-end">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-all group-hover:scale-110"
            style={{ background: accentColor }}
          >
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

// ── ProduccionGeneralClient ───────────────────────────────────────────────────

export function ProduccionGeneralClient() {
  const { can, isAdmin } = usePermissions();
  const canDisponibilidad = isAdmin || can('disponibilidad:submit') || can('disponibilidad:view');

  const { data: fichas, isLoading } = useFichas();
  const { data: noticias, isLoading: loadingNoticias } = useQuery<Noticia[]>({
    queryKey: ['noticias-admin'],
    queryFn:  () => api.get('/content/news').then((r) => r.data),
    staleTime: 60_000,
  });

  const total      = fichas?.length ?? 0;
  const completas  = fichas?.filter((f) => f.status === 'complete').length ?? 0;
  const enProgreso = fichas?.filter((f) => f.status === 'in_progress').length ?? 0;

  const totalNoticias     = noticias?.length ?? 0;
  const publicadas        = noticias?.filter((n) => n.status === 'published').length ?? 0;

  const statFichas = isLoading
    ? undefined
    : total > 0
    ? `${completas}/${total} completas`
    : 'Sin fichas';

  const statNoticias = loadingNoticias
    ? undefined
    : totalNoticias > 0
    ? `${publicadas} publicadas`
    : 'Sin noticias';

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="bg-white border border-slate-100 rounded-2xl px-8 pt-8 pb-7 flex flex-col items-center gap-2 mb-8 shadow-sm">
        <h1 className="inline-block bg-slate-900 text-white text-[13px] font-black uppercase tracking-widest px-5 py-2 rounded-full">
          Producción General
        </h1>
        <p className="text-[12.5px] text-slate-400 text-center max-w-sm mt-0.5">
          Herramientas de planificación y coordinación para los encuentros de cada campus.
        </p>

        {/* Stats rápidos */}
        {!isLoading && total > 0 && (
          <div className="flex gap-2 flex-wrap justify-center mt-2">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <span className="text-slate-800">{total}</span> fichas activas
            </span>
            {enProgreso > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1 rounded-full"
                style={{ background: 'rgba(127,119,221,0.1)', color: '#7F77DD' }}>
                <span className="font-bold">{enProgreso}</span> en progreso
              </span>
            )}
            {completas > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1 rounded-full"
                style={{ background: 'rgba(29,158,117,0.1)', color: '#1D9E75' }}>
                <span className="font-bold">{completas}</span> completas
              </span>
            )}
          </div>
        )}
      </div>

      {/* Section label */}
      <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-3 px-0.5">
        Módulos
      </p>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

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
            title="Disponibilidad Worship"
            description="Disponibilidad semanal de músicos y cantantes para los encuentros de cada campus."
            accentColor="#16a34a"
          />
        )}

        <HubCard
          href="/dashboard/produccion-general/noticias"
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
              stroke="#4F46E5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z" />
              <polyline points="17 20 17 13 7 13 7 20" />
              <polyline points="7 4 7 8 15 8" />
            </svg>
          }
          title="Noticias"
          description="Publica y gestiona noticias globales y por campus. Comparte imágenes, videos e Instagram."
          accentColor="#4F46E5"
          stat={statNoticias}
          loading={loadingNoticias}
        />

        <ComingSoonCard icon="🎛️" title="Inventario Técnico"  accentColor="#f59e0b" />
        <ComingSoonCard icon="📅" title="Fechas Clave"        accentColor="#10b981" />
        <ComingSoonCard icon="🎸" title="AR Worship"          accentColor="#ec4899" />
        <ComingSoonCard icon="🎤" title="Audiciones"          accentColor="#f97316" />
        <ComingSoonCard icon="🗓️" title="Eventos Anuales"    accentColor="#06b6d4" />

      </div>
    </div>
  );
}

// ── ComingSoonCard ────────────────────────────────────────────────────────────

function ComingSoonCard({ icon, title, accentColor }: {
  icon: string; title: string; accentColor: string;
}) {
  return (
    <div className="relative bg-white border border-slate-200/60 rounded-2xl overflow-hidden flex flex-col shadow-sm opacity-50 cursor-not-allowed select-none">
      <div className="h-[3px] w-full flex-shrink-0" style={{ background: accentColor }} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: `${accentColor}15` }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold text-slate-900 leading-snug">{title}</h3>
          <p className="text-[12px] text-slate-400 mt-1 italic">Próximamente</p>
        </div>
      </div>
    </div>
  );
}
