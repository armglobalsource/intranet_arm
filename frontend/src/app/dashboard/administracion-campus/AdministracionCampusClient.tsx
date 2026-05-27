'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { useAllCampuses, Campus } from '@/hooks/useCampus';

// ── Ícono campus ──────────────────────────────────────────────────────────────

function CampusIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 21 9 13 15 13 15 21" />
    </svg>
  );
}

// ── Módulos futuros ───────────────────────────────────────────────────────────

const MODULES = [
  {
    icon: '👥',
    title: 'Voluntarios de servicio',
    description: 'Listado y gestión de voluntarios por encuentro y campus.',
    soon: true,
  },
  {
    icon: '✅',
    title: 'Tareas y checklists',
    description: 'Tareas administrativas y checklists internos del equipo.',
    soon: true,
  },
  {
    icon: '📋',
    title: 'Datos de encuentros',
    description: 'Registro de información general de cada encuentro dominical.',
    soon: true,
  },
];

// ── Campus card ───────────────────────────────────────────────────────────────

function CampusCard({ campus }: { campus: Campus }) {
  return (
    <div className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 transition-all ${
      campus.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">{campus.name}</h3>
            {campus.siglas && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                {campus.siglas}
              </span>
            )}
          </div>
          {campus.city && (
            <p className="text-xs text-gray-400 mt-0.5">{campus.city}{campus.country ? `, ${campus.country}` : ''}</p>
          )}
        </div>
        <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          campus.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
        }`}>
          {campus.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      {campus.schedules && campus.schedules.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Horarios</p>
          <div className="flex flex-wrap gap-1.5">
            {campus.schedules.map((s, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600">
                {s.dia} {s.hora}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-auto pt-1 border-t border-gray-50">
        {campus.email && <span>{campus.email}</span>}
        {campus.phone && <span>{campus.phone}</span>}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AdministracionCampusClient() {
  const router = useRouter();
  const { isAdmin, can } = usePermissions();
  const { data: campuses = [], isLoading } = useAllCampuses();
  const hasAccess = isAdmin || can('campus:manage');

  useEffect(() => {
    if (!hasAccess) router.replace('/dashboard');
  }, [hasAccess, router]);

  if (!hasAccess) return null;

  const active   = campuses.filter((c) => c.isActive);
  const inactive = campuses.filter((c) => !c.isActive);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administración de Campus</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión administrativa de los campus de la red ARM Global
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-xl">
          <CampusIcon />
          <span>{active.length} campus activo{active.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Módulos (próximamente) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Módulos</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODULES.map((mod) => (
            <div key={mod.title}
              className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-2 opacity-60">
              <div className="flex items-center gap-2">
                <span className="text-xl">{mod.icon}</span>
                <span className="text-xs font-bold text-gray-700">{mod.title}</span>
                <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 uppercase tracking-wide">
                  Próximo
                </span>
              </div>
              <p className="text-xs text-gray-400 leading-snug">{mod.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de campus */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Campus</p>
        {isLoading ? (
          <div className="text-sm text-gray-400 py-8 text-center">Cargando campus...</div>
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map((c) => <CampusCard key={c.id} campus={c} />)}
              </div>
            )}
            {inactive.length > 0 && (
              <>
                <p className="text-xs text-gray-400 font-medium">Inactivos</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactive.map((c) => <CampusCard key={c.id} campus={c} />)}
                </div>
              </>
            )}
            {campuses.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl px-6 py-12 text-center">
                <p className="text-sm text-gray-500">No hay campus registrados aún.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
