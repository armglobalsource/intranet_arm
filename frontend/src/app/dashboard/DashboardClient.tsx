'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMiFichas } from '@/hooks/useFichas';
import { useNoticiasGlobal, useNoticiasCampus } from '@/hooks/useNoticias';
import type { Noticia } from '@/hooks/useNoticias';
import { useAuthStore } from '@/lib/store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers } from '@/hooks/useUsers';
import { CalendarioResumenMes } from './CalendarioAnual';
import { useOrgUserProfile } from '@/hooks/useOrgChart';
import { membershipArea } from '@/types/orgchart';
import { AvailabilityTask } from './AvailabilityTask';
import { pendingDashboardFichas } from '@/lib/dashboard-tasks';
import { parseFichaDate } from '@/lib/ficha-date';
import { BirthdayPanel } from './BirthdayPanel';
import { ReportesPendientesTask } from './ReportesPendientesTask';
import { RevisionReportesTask } from './RevisionReportesTask';

// ── Helper fecha ──────────────────────────────────────────────────────────────

function timeAgo(raw: string): string {
  const diff = Date.now() - new Date(raw).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Ahora mismo';
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `Hace ${d} día${d > 1 ? 's' : ''}`;
  return new Date(raw).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

// ── Subcomponentes de UI (tema oscuro) ──────────────────────────────────────

function Card({ children, className = '', href }: { children: React.ReactNode; className?: string; href?: string }) {
  const cls = `rounded-xl border transition-all ${href ? 'hover:border-[#9ab9b1] hover:shadow-sm' : ''} ${className}`;
  const style = { background: '#ffffff', borderColor: '#dce5e3' };
  if (href) {
    return <Link href={href} className={cls} style={style}>{children}</Link>;
  }
  return <div className={cls} style={style}>{children}</div>;
}

// ── NoticiaCard ───────────────────────────────────────────────────────────────

function NoticiaCard({ noticia }: { noticia: Noticia }) {
  return (
    <div className="flex flex-col gap-1.5 py-3" style={{ borderBottom: '1px solid #e5ebe7' }}>
      {noticia.pinned && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 w-fit">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
          </svg>
          Destacado
        </span>
      )}
      <p className="text-[13px] font-semibold text-[#182d25] leading-snug">{noticia.title}</p>
      {noticia.excerpt && (
        <p className="text-xs text-[#607068] line-clamp-2 leading-relaxed">{noticia.excerpt}</p>
      )}
      <p className="text-xs text-[#607068]">{timeAgo(noticia.createdAt)}</p>
    </div>
  );
}

// ── NoticiasPanel (Global + Campus combinadas en pestañas) ─────────────────────

function NoticiasPanel({
  campusName,
  noticiasGlobal,
  noticiasCampus,
  loadingGlobal,
  loadingCampus,
}: {
  campusName:     string | undefined;
  noticiasGlobal: Noticia[] | undefined;
  noticiasCampus: Noticia[] | undefined;
  loadingGlobal:  boolean;
  loadingCampus:  boolean;
}) {
  const [tab, setTab] = useState<'global' | 'campus'>('global');

  const isGlobal   = tab === 'global';
  const items      = (isGlobal ? noticiasGlobal : noticiasCampus) ?? [];
  const isLoading  = isGlobal ? loadingGlobal : loadingCampus;
  const accent     = isGlobal ? '#818CF8' : '#5DCAA5';

  return (
    <Card className="p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: '#edf2ee' }}>
          {(['global', 'campus'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
              style={{
                background: tab === t ? '#fff' : 'transparent',
                color:      tab === t ? '#204b39' : '#607068',
              }}
            >
              {t === 'global' ? 'Global' : (campusName ?? 'Campus')}
            </button>
          ))}
        </div>
        <span className="text-xs" style={{ color: '#607068' }}>
          {items.length} publicada{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-1.5 py-2">
              <div className="h-3 rounded animate-pulse w-3/4" style={{ background: '#edf2ee' }} />
              <div className="h-2.5 rounded animate-pulse w-1/2" style={{ background: '#edf2ee' }} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: `${accent}18` }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}>
              <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z" />
              <polyline points="17 20 17 13 7 13 7 20" />
              <polyline points="7 4 7 8 15 8" />
            </svg>
          </div>
          <p className="text-[12px] font-medium" style={{ color: '#607068' }}>
            {isGlobal ? 'No hay comunicados por ahora' : 'Aún no hay novedades de tu campus'}
          </p>
        </div>
      ) : (
        <div>
          {items.slice(0, 4).map((n) => (
            <NoticiaCard key={n.id} noticia={n} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── PendingUsersBanner ────────────────────────────────────────────────────────

function PendingUsersBanner({ enabled }: { enabled: boolean }) {
  const { data: users, isLoading, isError, refetch } = useUsers(undefined, { enabled });
  const pendingCount = users?.filter((u) => u.status === 'pending').length ?? 0;

  if (enabled && isLoading) return <p role="status" className="text-sm text-[#607068]">Consultando solicitudes de acceso…</p>;
  if (enabled && isError) return <div className="rounded-xl border border-amber-300/30 p-4 text-sm text-amber-800">No pudimos consultar las solicitudes de acceso. <button onClick={() => void refetch()} className="ml-2 min-h-[44px] underline">Reintentar</button></div>;
  if (!enabled || pendingCount === 0) return null;

  return (
    <Link
      href="/dashboard/directorio/personas?status=pending"
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-4 rounded-2xl transition-all hover:border-amber-700/50"
      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#FBC775" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#182d25]">
            {pendingCount} {pendingCount === 1 ? 'usuario pendiente' : 'usuarios pendientes'} de tu revisión
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#607068' }}>
            {pendingCount === 1 ? 'Se registró y espera tu aprobación.' : 'Se registraron y esperan tu aprobación.'}
          </p>
        </div>
      </div>
      <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 transition-colors">
        Revisar solicitudes
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </Link>
  );
}

// ── DashboardClient ───────────────────────────────────────────────────────────

export function DashboardClient() {
  const { can, isAdmin } = usePermissions();

  const { data: fichas, isLoading: fichasLoading, isError: fichasError, refetch: retryFichas } = useMiFichas();
  const { data: noticiasGlobal, isLoading: loadingGlobal } = useNoticiasGlobal();
  const { data: noticiasCampus, isLoading: loadingCampus } = useNoticiasCampus();
  const { user } = useAuthStore();

  const hasWorship  = isAdmin || can('disponibilidad:submit');
  const hasTecnicos = isAdmin || can('tecnicos:submit');

  // Mis equipos y ministerios
  const { data: orgProfile, isLoading: orgLoading, isError: orgError } = useOrgUserProfile(user?.id ?? null);
  const myMemberships = orgProfile?.orgMemberships ?? [];
  const myUniqueAreas = Array.from(
    new Map(
      myMemberships
        .map((m) => membershipArea(m))
        .filter(Boolean)
        .map((a) => [a!.id, a!])
    ).values()
  );

  const firstName        = user?.firstName ?? '';
  const miFichasCount    = fichas?.filter(f => !f.archived).length ?? 0;
  const pendingFichas = pendingDashboardFichas(fichas ?? []);
  const fichasCompletadas = fichas?.filter((f) => !f.archived && f.status === 'complete').length ?? 0;

  const initials = user
    ? ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || '?'
    : '?';

  return (
    <div className="dashboard-home min-h-screen -m-6 px-4 py-6 sm:px-6 lg:px-8" style={{ background: '#f4f6f6' }}>
      <div className="space-y-5 max-w-6xl mx-auto">

        {/* Identidad compacta + bienvenida */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#172326] leading-tight">
              Bienvenido a casa{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="text-sm mt-1 text-[#526367]">
              Revisa tus pendientes y encuentra lo que necesitas para servir esta semana.
            </p>
          </div>

          <Link href="/dashboard/perfil"
            className="flex items-center gap-2.5 pl-2 pr-3.5 py-2 rounded-lg transition-all hover:border-[#9ab9b1] flex-shrink-0"
            style={{ background: '#fff', border: '1px solid #dce5e3' }}>
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs"
                style={{ background: 'rgba(99,102,241,0.18)', color: '#A5B4FC' }}>
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#172326] leading-none truncate max-w-[140px]">
                {user ? `${user.firstName} ${user.lastName}` : '—'}
              </p>
              <p className="text-xs mt-1 truncate max-w-[140px]" style={{ color: '#607068' }}>
                {user?.role?.name ?? 'Sin rol'}{user?.campus?.name ? ` · ${user.campus.name}` : ''}
              </p>
            </div>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-[#607068]">
          <span className="rounded-full border border-[#dce5df] bg-[#f1f5f2] px-3 py-1.5">Mi campus: <strong className="text-[#182d25]">{user?.campus?.name ?? 'Sin asignar'}</strong></span>
          <Link href="/dashboard/perfil" className="px-2 py-2 underline underline-offset-4 hover:text-[#204b39]">Ver mi perfil</Link>
        </div>

        <BirthdayPanel />

        <section aria-labelledby="pending-heading" className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Tu semana, en orden</p>
            <h2 id="pending-heading" className="mt-1 text-xl font-bold text-[#182d25]">Mis pendientes</h2>
            <p className="mt-1 text-sm text-[#607068]">Accesos directos según tus permisos y tus fichas.</p>
          </div>
          <PendingUsersBanner enabled={can('users:edit')} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-[#dce5df] bg-white p-5">
              <h3 className="text-base font-semibold text-[#182d25]">Fichas por revisar</h3>
              <p className="mt-1 text-sm text-[#607068]">Fichas próximas o sin fecha que aún no están completas.</p>
              {fichasLoading ? <p role="status" className="my-4 text-sm text-[#607068]">Consultando tus fichas…</p>
                : fichasError ? <div className="my-4"><p className="mb-3 text-sm text-amber-800">No pudimos cargar tus pendientes.</p><button className="dashboard-action" onClick={() => void retryFichas()}>Reintentar</button></div>
                : pendingFichas.length === 0 ? <p className="my-4 text-sm text-emerald-800">No tienes fichas pendientes próximas. Puedes consultar las anteriores en Mis fichas.</p>
                : <ul className="my-3 divide-y divide-white/10">
                  {pendingFichas.slice(0, 3).map(ficha => {
                    const date = parseFichaDate(ficha.date);
                    return <li key={ficha.fichaId}><Link href={`/dashboard/fichas-tecnicas/${encodeURIComponent(ficha.fichaId)}/view`} className="flex min-h-[64px] items-center justify-between gap-3 rounded-lg py-3 hover:bg-[#f1f5f2]">
                      <div className="min-w-0"><p className="break-words text-sm font-semibold text-[#182d25]">{ficha.title || 'Ficha sin título'}</p><p className="mt-1 text-sm text-[#607068]">{Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} · {ficha.campusName}</p></div>
                      <span className="shrink-0 text-sm font-semibold text-emerald-800">Revisar →</span>
                    </Link></li>;
                  })}
                </ul>}
              <Link href="/dashboard/mis-fichas" className="dashboard-action">Ver mis fichas{pendingFichas.length > 3 ? ` (${pendingFichas.length} pendientes)` : ''} →</Link>
            </article>
            <div className="space-y-4">
              {/* Se muestra sola si el usuario administra algún campus. */}
              <RevisionReportesTask />
              {(isAdmin || can('encuentros:create')) && <ReportesPendientesTask />}
              {hasWorship && <AvailabilityTask campusId={user?.campusId ?? null} channel="worship" />}
              {hasTecnicos && <AvailabilityTask campusId={user?.campusId ?? null} channel="tecnicos" />}
            </div>
          </div>
        </section>

        <h2 className="text-lg font-semibold text-[#182d25]">Mi espacio</h2>
        {/* Tarjetas de stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Mis fichas */}
          <Card href="/dashboard/mis-fichas" className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#A5B4FC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[22px] font-bold text-[#182d25] leading-none">
                {fichasLoading ? '…' : fichasError ? '—' : String(miFichasCount)}
              </p>
              <p className="text-[12px] mt-1" style={{ color: '#607068' }}>{fichasError ? 'No pudimos cargar tus fichas' : 'Mis fichas técnicas'}</p>
              {!fichasLoading && fichasCompletadas > 0 && (
                <p className="text-xs font-medium mt-1" style={{ color: '#5DCAA5' }}>
                  {fichasCompletadas} completa{fichasCompletadas !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </Card>

          {/* Mis equipos */}
          <Card href={can('orgchart:view') ? '/dashboard/orgchart' : undefined} className="p-5 flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(93,202,165,0.15)' }}>
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#5DCAA5"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              {orgLoading ? (
                <div className="space-y-1.5">
                  <div className="h-6 w-8 rounded animate-pulse" style={{ background: '#edf2ee' }} />
                  <div className="h-3 w-32 rounded animate-pulse" style={{ background: '#edf2ee' }} />
                </div>
              ) : orgError ? (<p className="text-sm text-amber-800">No pudimos cargar tus equipos. Intenta recargar la página.</p>) : myMemberships.length === 0 ? (
                <>
                  <p className="text-[22px] font-bold leading-none" style={{ color: '#607068' }}>—</p>
                  <p className="text-[12px] mt-1" style={{ color: '#607068' }}>Sin equipos asignados</p>
                  <p className="text-sm text-[#607068] mt-2 leading-relaxed">Contacta al responsable de tu campus para revisar tu incorporación a un equipo.</p>
                </>
              ) : (
                <>
                  <p className="text-[22px] font-bold text-[#182d25] leading-none">{myMemberships.length}</p>
                  <p className="text-[12px] mt-1" style={{ color: '#607068' }}>
                    {myMemberships.length === 1 ? 'Equipo o ministerio' : 'Equipos y ministerios'}
                  </p>
                  {myUniqueAreas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {myUniqueAreas.slice(0, 2).map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full max-w-[110px]"
                          style={{ background: `${a.color}22`, color: a.color }}
                        >
                          <span>{a.icon}</span>
                          <span className="truncate">{a.name}</span>
                        </span>
                      ))}
                      {myUniqueAreas.length > 2 && (
                        <span className="text-xs self-center font-medium" style={{ color: '#607068' }}>
                          +{myUniqueAreas.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

        </div>

        {/* Noticias */}
        <NoticiasPanel
          campusName={user?.campus?.name}
          noticiasGlobal={noticiasGlobal}
          noticiasCampus={noticiasCampus}
          loadingGlobal={loadingGlobal}
          loadingCampus={loadingCampus}
        />

        <CalendarioResumenMes />
      </div>
    </div>
  );
}
