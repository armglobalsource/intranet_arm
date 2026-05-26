'use client';

import Link from 'next/link';
import { useOrgAreaTree } from '@/hooks/useOrgChart';
import type { OrgAreaTree, OrgMembership } from '@/types/orgchart';
import { orgUserJobTitle } from '@/types/orgchart';
import type { MINISTERIOS_CONFIG } from './page';

type Config = (typeof MINISTERIOS_CONFIG)[string];

// ── UserCard ──────────────────────────────────────────────────────────────────

function UserCard({ m, color }: { m: OrgMembership; color: string }) {
  const u = m.user;
  const name  = `${u.firstName} ${u.lastName}`;
  const title = m.customTitle || orgUserJobTitle(u) || null;
  const ini   = ((u.firstName[0] ?? '') + (u.lastName[0] ?? '')).toUpperCase();

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
      {u.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={u.avatarUrl} alt={name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-white" />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ring-2 ring-white"
          style={{ background: `${color}20`, color }}
        >
          {ini}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{name}</p>
        {title && <p className="text-[11px] text-gray-500 truncate mt-0.5">{title}</p>}
        {u.campus?.name && (
          <p className="text-[10px] text-gray-400 truncate">{u.campus.name}</p>
        )}
      </div>
    </div>
  );
}

// ── OrgSection (solo para ministerios con orgSlug) ────────────────────────────

function OrgSection({ orgSlug, color }: { orgSlug: string; color: string }) {
  const { data: tree, isLoading } = useOrgAreaTree(orgSlug, true);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-200 rounded animate-pulse w-2/3" />
              <div className="h-2.5 bg-gray-200 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!tree) return null;

  return <OrgTreeContent tree={tree} color={color} />;
}

function OrgTreeContent({ tree, color }: { tree: OrgAreaTree; color: string }) {
  const hasLeaders = tree.leaders.length > 0;
  const hasTeams   = tree.teams.some((t) => t.memberships.length > 0);

  if (!hasLeaders && !hasTeams) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        Aún no hay miembros registrados en este ministerio.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {hasLeaders && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>
            Liderazgo
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tree.leaders.map((m) => <UserCard key={m.id} m={m} color={color} />)}
          </div>
        </div>
      )}

      {tree.teams.map((team) => {
        const members = team.memberships.filter(
          (m) => m.user?.status !== 'inactive' && m.user?.status !== 'suspended',
        );
        if (members.length === 0) return null;
        return (
          <div key={team.id}>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              {team.name}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {members.map((m) => <UserCard key={m.id} m={m} color={color} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MinisterioDetalleClient ───────────────────────────────────────────────────

export function MinisterioDetalleClient({ slug, config }: { slug: string; config: Config }) {
  const { name, segmento, color, emoji, desc, orgSlug } = config;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400">
        <Link href="/dashboard/ministerios" className="hover:text-gray-600 transition-colors">
          Ministerios
        </Link>
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-gray-700 font-medium">{name}</span>
      </nav>

      {/* Header */}
      <div
        className="card p-6 flex items-start gap-5 overflow-hidden relative"
        style={{ borderTop: `4px solid ${color}` }}
      >
        {/* Fondo decorativo */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ background: `radial-gradient(circle at 80% 50%, ${color}, transparent 60%)` }}
        />

        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: `${color}15` }}
        >
          {emoji}
        </div>

        <div className="flex-1 min-w-0 relative">
          <div className="flex items-start gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{name}</h1>
              <span
                className="inline-block mt-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: `${color}15`, color }}
              >
                {segmento}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">{desc}</p>
        </div>
      </div>

      {/* Equipo (si tiene orgSlug) o placeholder */}
      <div className="card p-6">
        <h2 className="text-base font-bold text-gray-900 mb-5">Equipo del ministerio</h2>

        {orgSlug ? (
          <OrgSection orgSlug={orgSlug} color={color} />
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3"
              style={{ background: `${color}10` }}
            >
              {emoji}
            </div>
            <p className="text-sm font-semibold text-gray-600">Equipo en construcción</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
              Pronto podrás ver aquí a los líderes y miembros de {name}.
              Mientras tanto puedes ver el organigrama completo.
            </p>
            <Link
              href="/dashboard/orgchart"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ background: `${color}15`, color }}
            >
              Ver organigrama
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        )}
      </div>

      {/* Volver */}
      <Link
        href="/dashboard/ministerios"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Volver a Ministerios
      </Link>
    </div>
  );
}
