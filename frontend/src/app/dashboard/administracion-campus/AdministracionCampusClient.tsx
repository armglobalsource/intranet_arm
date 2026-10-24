'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

// ── Campus card ───────────────────────────────────────────────────────────────

function CampusCard({ campus }: { campus: Campus }) {
  return (
    <Link
      href={`/dashboard/administracion-campus/${campus.id}`}
      className={`group bg-white rounded-2xl border p-5 flex flex-col gap-4 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md ${
        campus.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
      }`}
    >
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
        <div className="flex items-center gap-2">
          <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            campus.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
          }`}>
            {campus.isActive ? 'Activo' : 'Inactivo'}
          </span>
          <svg className="w-4 h-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      {campus.schedules && campus.schedules.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Horarios</p>
          <div className="flex flex-wrap gap-1.5 max-h-[52px] overflow-hidden">
            {campus.schedules.slice(0, 5).map((s, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-50 border border-gray-100 text-gray-600">
                {s.dia} {s.hora}
              </span>
            ))}
            {campus.schedules.length > 5 && (
              <span className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500">
                +{campus.schedules.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-gray-400 mt-auto pt-3 border-t border-gray-100">
        {campus.email && <span>{campus.email}</span>}
        {campus.phone && <span>{campus.phone}</span>}
        {!campus.email && !campus.phone && <span>Ver calendarios y configuración</span>}
      </div>
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function AdministracionCampusClient() {
  const router = useRouter();
  const { isAdmin, can } = usePermissions();
  const { data: campuses = [], isLoading } = useAllCampuses();
  const hasAccess = isAdmin || can('campus:edit');

  useEffect(() => {
    if (!hasAccess) router.replace('/dashboard');
  }, [hasAccess, router]);

  if (!hasAccess) return null;

  const active   = campuses.filter((c) => c.isActive);
  const inactive = campuses.filter((c) => !c.isActive);

  return (
    <div className="max-w-6xl mx-auto space-y-7">
      {/* Encabezado del módulo */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-neutral-950 to-neutral-800 px-6 py-8 font-sans shadow-xl shadow-neutral-300/60 sm:px-9 sm:py-10">
        <div className="absolute -right-20 -top-28 h-64 w-64 rounded-full bg-white/[0.08] blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-neutral-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-bold text-emerald-400">Operación de campus</p>
            <h1 className="text-3xl font-bold leading-tight tracking-normal text-white sm:text-4xl">
              Administración de Campus
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-neutral-300">
              Consulta y administra las rotaciones semanales de administradores y líderes de voluntarios.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm lg:self-auto">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <CampusIcon />
            </span>
            <div>
              <p className="text-xl font-bold leading-none text-white">{active.length}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Campus activos
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Lista de campus */}
      <div>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Selecciona un campus</p>
            <p className="text-sm text-gray-500">Abre sus calendarios y herramientas de configuración.</p>
          </div>
        </div>
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
