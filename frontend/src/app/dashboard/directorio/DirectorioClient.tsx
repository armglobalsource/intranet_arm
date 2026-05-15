'use client';

import Link from 'next/link';
import { useOrgAreas, useOrgTeams } from '@/hooks/useOrgChart';
import { useAllJobTitles } from '@/hooks/useJobTitles';
import { useUsers } from '@/hooks/useUsers';
import { useSystemRoles } from '@/hooks/useRoles';
import { usePermissions } from '@/hooks/usePermissions';


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
      className={`group relative bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden ${className ?? ''}`}
    >
      {/* Accent band */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: accentColor }} />

      {/* Icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
        style={{ background: `${accentColor}18` }}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1">
        <h3 className="text-[17px] font-bold text-slate-900 group-hover:text-slate-700 transition-colors">
          {title}
        </h3>
        <p className="text-[13px] text-slate-400 mt-1 leading-relaxed">{description}</p>
      </div>

      {/* Count badge + arrow */}
      <div className="flex items-center justify-between mt-1">
        {loading ? (
          <div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
        ) : count !== undefined ? (
          <span
            className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1 rounded-full"
            style={{ background: `${accentColor}18`, color: accentColor }}
          >
            {count} {countLabel}
          </span>
        ) : (
          <span />
        )}

        <span
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all group-hover:scale-105"
          style={{ background: accentColor }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Directorio</h1>
        <p className="text-sm text-slate-400 mt-1">Gestiona las personas, cargos y estructura del organigrama</p>
      </div>

      {/* hub cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
