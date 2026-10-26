'use client';

import Link from 'next/link';
import { useOrgAreas, useOrgTeams } from '@/hooks/useOrgChart';
import { useAllJobTitles } from '@/hooks/useJobTitles';
import { useUsers } from '@/hooks/useUsers';
import { useSystemRoles } from '@/hooks/useRoles';
import { usePermissions } from '@/hooks/usePermissions';
import { useAllCampuses } from '@/hooks/useCampus';


// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ count, label, loading }: { count?: number; label: string; loading?: boolean }) {
  if (loading) return <div className="h-5 w-16 bg-slate-100 rounded-full animate-pulse" />;
  if (count === undefined) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
      <span className="text-slate-800">{count}</span>
      {label}
    </span>
  );
}


// ── Hub row ───────────────────────────────────────────────────────────────────

interface HubRowProps {
  href:        string;
  icon:        string;
  title:       string;
  description: string;
  accentColor: string;
  count?:      number;
  countLabel?: string;
  loading?:    boolean;
}

function HubRow({ href, icon, title, description, accentColor, count, countLabel, loading }: HubRowProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 px-5 py-4 hover:bg-slate-50/80 transition-colors focus-visible:outline-none focus-visible:bg-slate-50"
    >
      {/* Colored icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[15px] flex-shrink-0"
        style={{ background: `${accentColor}18` }}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13.5px] font-semibold text-slate-800 group-hover:text-slate-900 transition-colors leading-snug">
            {title}
          </p>
          {loading ? (
            <div className="h-4 w-14 bg-slate-100 rounded-full animate-pulse" />
          ) : count !== undefined ? (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full leading-none"
              style={{ background: `${accentColor}18`, color: accentColor }}
            >
              {count} {countLabel}
            </span>
          ) : null}
        </div>
        <p className="text-[11.5px] text-slate-400 mt-0.5 leading-snug truncate">{description}</p>
      </div>

      {/* Arrow */}
      <svg
        className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  );
}


// ── DirectorioClient ──────────────────────────────────────────────────────────

export function DirectorioClient() {
  const { data: areas,    isLoading: loadingAreas }    = useOrgAreas();
  const { data: teams,    isLoading: loadingTeams }    = useOrgTeams();
  const { data: cargos,   isLoading: loadingCargos }   = useAllJobTitles();
  const { data: persons,  isLoading: loadingPersons }  = useUsers();
  const { data: roles,    isLoading: loadingRoles }    = useSystemRoles();
  const { data: campuses, isLoading: loadingCampuses } = useAllCampuses();
  const { can } = usePermissions();

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 mb-2">Administración</p>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500 max-w-xl mt-1">
          Gestiona personas, estructura organizativa y acceso al sistema desde un solo lugar.
        </p>
        <div className="flex gap-2 flex-wrap mt-4">
          {can('users:view')   && <StatPill count={persons?.length}  label="personas" loading={loadingPersons} />}
          {can('cargos:view')  && <StatPill count={cargos?.length}   label="cargos"   loading={loadingCargos} />}
          {can('areas:view')   && <StatPill count={areas?.length}    label="áreas"    loading={loadingAreas} />}
          {can('equipos:view') && <StatPill count={teams?.length}    label="equipos"  loading={loadingTeams} />}
          {can('campus:view')  && <StatPill count={campuses?.length} label="campus"   loading={loadingCampuses} />}
          {can('roles:view')   && <StatPill count={roles?.length}    label="roles"    loading={loadingRoles} />}
        </div>
      </div>

      {/* Section label */}
      <div className="flex items-center justify-between mb-2 px-0.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Secciones</p>
        <span className="text-xs text-slate-400">Accesos disponibles según tu rol</span>
      </div>

      {/* Compact list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden divide-y divide-slate-100">
        {can('users:view') && (
          <HubRow
            href="/dashboard/directorio/personas"
            icon="👥"
            title="Personas"
            description="Usuarios del sistema: crea, edita y gestiona el acceso de cada persona."
            accentColor="#2563EB"
            count={persons?.length}
            countLabel="registradas"
            loading={loadingPersons}
          />
        )}

        {can('cargos:view') && (
          <HubRow
            href="/dashboard/directorio/cargos"
            icon="💼"
            title="Cargos"
            description="Catálogo de puestos y roles que se asignan a las personas del ministerio."
            accentColor="#D97706"
            count={cargos?.length}
            countLabel="cargos"
            loading={loadingCargos}
          />
        )}

        {can('areas:view') && (
          <HubRow
            href="/dashboard/directorio/areas"
            icon="🗂️"
            title="Áreas"
            description="Ministerios o departamentos que agrupan equipos en el organigrama."
            accentColor="#7C3AED"
            count={areas?.length}
            countLabel="áreas"
            loading={loadingAreas}
          />
        )}

        {can('equipos:view') && (
          <HubRow
            href="/dashboard/directorio/equipos"
            icon="🏷️"
            title="Equipos"
            description="Grupos de trabajo dentro de cada área: configura nombre, ícono y columna."
            accentColor="#0D9488"
            count={teams?.length}
            countLabel="equipos"
            loading={loadingTeams}
          />
        )}

        {can('campus:view') && (
          <HubRow
            href="/dashboard/directorio/campus"
            icon="🏛️"
            title="Campus"
            description="Registra cada campus con sus pastores, horarios, contacto y dirección."
            accentColor="#0891B2"
            count={campuses?.length}
            countLabel="campus"
            loading={loadingCampuses}
          />
        )}

        {can('arm-catalogos:view') && (
          <HubRow
            href="/dashboard/directorio/arm-catalogos"
            icon="🧾"
            title="Configuración APP Web"
            description="Categorías de asistencia, voluntarios y monedas para el registro de encuentros."
            accentColor="#DB2777"
          />
        )}

        {can('roles:view') && (
          <HubRow
            href="/dashboard/directorio/roles"
            icon="🔐"
            title="Roles del Sistema"
            description="Define los roles que controlan el acceso y funcionalidades del sistema."
            accentColor="#4F46E5"
            count={roles?.length}
            countLabel="roles"
            loading={loadingRoles}
          />
        )}
      </div>
    </div>
  );
}
