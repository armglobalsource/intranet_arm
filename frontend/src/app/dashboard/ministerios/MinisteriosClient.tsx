'use client';

import { useState } from 'react';
import { useOrgAreas, useOrgAreaTree } from '@/hooks/useOrgChart';
import type { OrgArea, OrgAreaTree, OrgMembership } from '@/types/orgchart';
import { orgUserJobTitle } from '@/types/orgchart';

// ── helpers ───────────────────────────────────────────────────────────────────

function initials(firstName: string, lastName: string) {
  return ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase();
}

// ── UserChip ──────────────────────────────────────────────────────────────────

function UserChip({ m, color }: { m: OrgMembership; color: string }) {
  const u = m.user;
  const name = `${u.firstName} ${u.lastName}`;
  const title = m.customTitle || orgUserJobTitle(u) || null;

  return (
    <div className="flex items-center gap-2.5 py-2">
      {u.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={u.avatarUrl}
          alt={name}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-black/5"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
          style={{ background: `${color}20`, color }}
        >
          {initials(u.firstName, u.lastName)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 leading-tight truncate">{name}</p>
        {title && <p className="text-[11px] text-gray-400 truncate mt-0.5">{title}</p>}
      </div>
    </div>
  );
}

// ── AreaCard ──────────────────────────────────────────────────────────────────

function AreaCard({ area }: { area: OrgArea }) {
  const [open, setOpen] = useState(false);
  const { data: tree, isLoading } = useOrgAreaTree(area.slug, open);

  return (
    <div
      className="card overflow-hidden flex flex-col transition-shadow hover:shadow-md"
      style={{ borderTop: `3px solid ${area.color}` }}
    >
      {/* Header del área */}
      <div className="p-5 flex items-start gap-4">
        {/* Logo o emoji */}
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl overflow-hidden"
          style={{ background: `${area.color}12` }}
        >
          {area.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={area.iconUrl} alt={area.name} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <span>{area.icon}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 leading-tight">{area.name}</h3>
          {area.desc && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{area.desc}</p>
          )}
        </div>
      </div>

      {/* Expandir / contraer */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="mx-5 mb-4 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all"
        style={{
          background: open ? `${area.color}12` : '#F9FAFB',
          color:      open ? area.color : '#6B7280',
        }}
      >
        <span>{open ? 'Ocultar equipo' : 'Ver equipo'}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Panel expandible */}
      {open && (
        <div className="border-t border-gray-100">
          {isLoading ? (
            <div className="px-5 py-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
                    <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AreaTreeContent tree={tree!} color={area.color} />
          )}
        </div>
      )}
    </div>
  );
}

// ── AreaTreeContent ───────────────────────────────────────────────────────────

function AreaTreeContent({ tree, color }: { tree: OrgAreaTree; color: string }) {
  const hasLeaders = tree.leaders.length > 0;
  const hasTeams   = tree.teams.length > 0;

  if (!hasLeaders && !hasTeams) {
    return (
      <div className="px-5 py-6 text-center text-xs text-gray-400">
        Aún no hay miembros en este ministerio.
      </div>
    );
  }

  return (
    <div className="px-5 py-1 pb-4 space-y-4">
      {/* Líderes del área */}
      {hasLeaders && (
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest mt-3 mb-1"
            style={{ color }}
          >
            Liderazgo
          </p>
          <div className="divide-y divide-gray-50">
            {tree.leaders.map((m) => (
              <UserChip key={m.id} m={m} color={color} />
            ))}
          </div>
        </div>
      )}

      {/* Equipos */}
      {hasTeams && tree.teams.map((team) => {
        const activeMembers = team.memberships.filter(
          (m) => m.user?.status !== 'inactive' && m.user?.status !== 'suspended',
        );
        if (activeMembers.length === 0) return null;

        return (
          <div key={team.id}>
            <div className="flex items-center gap-1.5 mt-3 mb-1">
              {team.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={team.iconUrl} alt={team.name}
                  className="w-3.5 h-3.5 rounded object-cover flex-shrink-0" />
              ) : null}
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {team.name}
              </p>
              <span className="text-[10px] text-gray-300 ml-auto">
                {activeMembers.length} {activeMembers.length === 1 ? 'persona' : 'personas'}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {activeMembers.map((m) => (
                <UserChip key={m.id} m={m} color={color} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MinisteriosClient ─────────────────────────────────────────────────────────

export function MinisteriosClient() {
  const { data: areas, isLoading } = useOrgAreas();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ministerios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conoce las áreas y equipos que forman parte de ARM Global.
        </p>
      </div>

      {/* Grid de áreas */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                  <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !areas || areas.length === 0 ? (
        <div className="card p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-gray-300" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">No hay ministerios configurados</p>
          <p className="text-xs text-gray-400 mt-1">
            Crea áreas en Configuración → Organigrama para verlos aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {areas.map((area) => (
            <AreaCard key={area.id} area={area} />
          ))}
        </div>
      )}
    </div>
  );
}
