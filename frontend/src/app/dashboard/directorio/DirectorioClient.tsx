'use client';

import Link from 'next/link';
import { useOrgAreas, useOrgTeams } from '@/hooks/useOrgChart';
import { useAllJobTitles } from '@/hooks/useJobTitles';
import { useUsers } from '@/hooks/useUsers';
import { useSystemRoles } from '@/hooks/useRoles';
import { usePermissions } from '@/hooks/usePermissions';


// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ count, label, loading }: { count?: number; label: string; loading?: boolean }) {
  if (loading) return <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />;
  if (count === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
      <span className="text-slate-800">{count}</span>
      {label}
    </span>
  );
}


// ── Hub card ──────────────────────────────────────────────────────────────────

interface HubCardProps {
  href:        string;
  icon:        string;
  title:       string;
  description: string;
  accentColor: string;
  count?:      number;
  countLabel?: string;
  loading?:    boolean;
  className?:  string;
}

function HubCard({ href, icon, title, description, accentColor, count, countLabel, loading, className }: HubCardProps) {
  return (
    <Link
      href={href}
      className={`group relative bg-white border border-slate-200/80 rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${className ?? ''}`}
    >
      {/* Accent bar */}
      <div className="h-[3px] w-full flex-shrink-0" style={{ background: accentColor }} />

      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Icon + count row */}
        <div className="flex items-start justify-between">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: `${accentColor}15` }}
          >
            {icon}
          </div>

          {loading ? (
            <div className="h-5 w-14 bg-slate-100 rounded-full animate-pulse mt-0.5" />
          ) : count !== undefined ? (
            <span
              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full mt-0.5"
              style={{ background: `${accentColor}15`, color: accentColor }}
            >
              {count} {countLabel}
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
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}


// ── DirectorioClient ──────────────────────────────────────────────────────────

export function DirectorioClient() {
  const { data: areas,   isLoading: loadingAreas }   = useOrgAreas();
  const { data: teams,   isLoading: loadingTeams }   = useOrgTeams();
  const { data: cargos,  isLoading: loadingCargos }  = useAllJobTitles();
  const { data: persons, isLoading: loadingPersons } = useUsers();
  const { data: roles,   isLoading: loadingRoles }   = useSystemRoles();
  const { can } = usePermissions();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header — mismo estilo que Organigrama */}
      <div className="bg-white border border-slate-100 rounded-2xl px-8 pt-8 pb-7 flex flex-col items-center gap-2 mb-8 shadow-sm">
        <h1 className="inline-block bg-slate-900 text-white text-[13px] font-black uppercase tracking-widest px-5 py-2 rounded-full">
          Directorio
        </h1>
        <p className="text-[12.5px] text-slate-400 text-center max-w-xs mt-0.5">
          Administración central de personas, estructura y acceso del sistema.
        </p>
        <div className="flex gap-2 flex-wrap justify-center mt-2">
          <StatPill count={persons?.length} label="personas"  loading={loadingPersons} />
          <StatPill count={cargos?.length}  label="cargos"    loading={loadingCargos} />
          <StatPill count={areas?.length}   label="áreas"     loading={loadingAreas} />
          <StatPill count={teams?.length}   label="equipos"   loading={loadingTeams} />
        </div>
      </div>

      {/* Section label */}
      <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider mb-3 px-0.5">
        Secciones
      </p>

      {/* Hub cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <HubCard
          href="/dashboard/directorio/personas"
          icon="👥"
          title="Personas"
          description="Usuarios del sistema: crea, edita y gestiona el acceso de cada persona."
          accentColor="#2563EB"
          count={persons?.length}
          countLabel="registradas"
          loading={loadingPersons}
        />

        <HubCard
          href="/dashboard/directorio/cargos"
          icon="💼"
          title="Cargos"
          description="Catálogo de puestos y roles que se asignan a las personas del ministerio."
          accentColor="#D97706"
          count={cargos?.length}
          countLabel="cargos"
          loading={loadingCargos}
        />

        <HubCard
          href="/dashboard/directorio/areas"
          icon="🗂️"
          title="Áreas"
          description="Ministerios o departamentos que agrupan equipos en el organigrama."
          accentColor="#7C3AED"
          count={areas?.length}
          countLabel="áreas"
          loading={loadingAreas}
        />

        <HubCard
          href="/dashboard/directorio/equipos"
          icon="🏷️"
          title="Equipos"
          description="Grupos de trabajo dentro de cada área: configura nombre, ícono y columna."
          accentColor="#0D9488"
          count={teams?.length}
          countLabel="equipos"
          loading={loadingTeams}
        />

        {can('roles:view') && (
          <HubCard
            href="/dashboard/directorio/roles"
            icon="🔐"
            title="Roles del Sistema"
            description="Define los roles que controlan el acceso y funcionalidades del sistema."
            accentColor="#4F46E5"
            count={roles?.length}
            countLabel="roles"
            loading={loadingRoles}
            className="sm:col-span-2"
          />
        )}
      </div>
    </div>
  );
}
