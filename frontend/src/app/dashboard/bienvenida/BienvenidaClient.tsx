'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth.store';
import { useOnboardingList, OnboardingTeam } from '@/hooks/useOnboarding';
import { usePermissions } from '@/hooks/usePermissions';

// ── Colores por defecto según índice ────────────────────────────────────────

const PALETTE = [
  { bg: '#f0fdf4', border: '#86efac', accent: '#16a34a' },
  { bg: '#eff6ff', border: '#93c5fd', accent: '#2563eb' },
  { bg: '#fdf4ff', border: '#d8b4fe', accent: '#9333ea' },
  { bg: '#fff7ed', border: '#fdba74', accent: '#ea580c' },
  { bg: '#f0fdfa', border: '#5eead4', accent: '#0d9488' },
  { bg: '#fef2f2', border: '#fca5a5', accent: '#dc2626' },
  { bg: '#fefce8', border: '#fde047', accent: '#ca8a04' },
  { bg: '#f8fafc', border: '#cbd5e1', accent: '#475569' },
];

// ── Card ────────────────────────────────────────────────────────────────────

function TeamCard({ team, index }: { team: OnboardingTeam; index: number }) {
  const palette = PALETTE[index % PALETTE.length];
  const bgColor = team.color ?? palette.bg;

  return (
    <Link
      href={`/dashboard/bienvenida/${team.slug}`}
      className="group block rounded-2xl border-2 p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{ background: bgColor, borderColor: palette.border }}
    >
      {/* Emoji */}
      {team.emoji && (
        <div className="text-4xl mb-4">{team.emoji}</div>
      )}

      {/* Bienvenida */}
      <p className="text-xs font-semibold uppercase tracking-widest mb-1"
        style={{ color: palette.accent }}>
        Bienvenido a
      </p>
      <h2 className="text-xl font-bold text-gray-900 leading-tight">{team.teamName}</h2>

      {team.welcomeTitle && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{team.welcomeTitle}</p>
      )}

      <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: palette.accent }}>
        Ver onboarding
        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-5xl mb-4">👋</div>
      <h2 className="text-lg font-bold text-gray-800">
        {isAdmin ? 'No hay onboardings creados aún' : 'No tienes onboardings asignados aún'}
      </h2>
      <p className="text-sm text-gray-500 mt-2 max-w-sm">
        {isAdmin
          ? 'Crea el primer onboarding para que los voluntarios vean su bienvenida.'
          : 'Cuando tu líder configure el proceso de bienvenida, aparecerá aquí.'}
      </p>
      {isAdmin && (
        <Link href="/dashboard/bienvenida/admin"
          className="mt-6 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#111827' }}>
          Crear primer onboarding
        </Link>
      )}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function BienvenidaClient() {
  const user                              = useAuthStore((s) => s.user);
  const { isAdmin }                       = usePermissions();
  const { data: teams = [], isLoading }   = useOnboardingList();

  const firstName = user?.firstName ?? 'Voluntario';

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">¡Bienvenido, {firstName}! 👋</h1>
          <p className="text-sm text-gray-500 mt-1">
            Aquí encontrarás el proceso de inducción de cada equipo al que perteneces.
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/bienvenida/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: '#111827' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Gestionar onboardings
          </Link>
        )}
      </div>

      {/* Grid de equipos */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border-2 border-gray-100 bg-gray-50 p-6 h-44 animate-pulse" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <EmptyState isAdmin={isAdmin} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {teams.map((team, i) => (
            <TeamCard key={team.id} team={team} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
