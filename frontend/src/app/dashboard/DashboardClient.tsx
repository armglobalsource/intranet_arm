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
import { useMyDisponibilidad } from '@/hooks/useDisponibilidad';
import { useMyTecnicosDisponibilidad } from '@/hooks/useTecnicos';
import { toWeekLabel, shiftWeek, formatWeekLabel } from '@/types/disponibilidad';

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

function Badge({ label, color = 'slate' }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    slate:  'bg-slate-800 text-slate-300 border-slate-700',
    violet: 'bg-violet-950/60 text-violet-300 border-violet-800/50',
    indigo: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50',
    amber:  'bg-amber-950/60 text-amber-300 border-amber-800/50',
    green:  'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
    blue:   'bg-blue-950/60 text-blue-300 border-blue-800/50',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${colors[color] ?? colors.slate}`}>
      {label}
    </span>
  );
}

function Card({ children, className = '', href }: { children: React.ReactNode; className?: string; href?: string }) {
  const cls = `rounded-2xl border transition-all ${href ? 'hover:border-white/20' : ''} ${className}`;
  const style = { background: '#111', borderColor: '#1f1f1f' };
  if (href) {
    return <Link href={href} className={cls} style={style}>{children}</Link>;
  }
  return <div className={cls} style={style}>{children}</div>;
}

// ── NoticiaCard ───────────────────────────────────────────────────────────────

function NoticiaCard({ noticia }: { noticia: Noticia }) {
  return (
    <div className="flex flex-col gap-1.5 py-3" style={{ borderBottom: '1px solid #1a1a1a' }}>
      {noticia.pinned && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 w-fit">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
          </svg>
          Destacado
        </span>
      )}
      <p className="text-[13px] font-semibold text-white leading-snug">{noticia.title}</p>
      {noticia.excerpt && (
        <p className="text-[11.5px] text-white/40 line-clamp-2 leading-relaxed">{noticia.excerpt}</p>
      )}
      <p className="text-[10px] text-white/25">{timeAgo(noticia.createdAt)}</p>
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
        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: '#1a1a1a' }}>
          {(['global', 'campus'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all"
              style={{
                background: tab === t ? '#242424' : 'transparent',
                color:      tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              {t === 'global' ? 'Global' : (campusName ?? 'Campus')}
            </button>
          ))}
        </div>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          {items.length} publicada{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-1.5 py-2">
              <div className="h-3 rounded animate-pulse w-3/4" style={{ background: '#1a1a1a' }} />
              <div className="h-2.5 rounded animate-pulse w-1/2" style={{ background: '#1a1a1a' }} />
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
          <p className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
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

// ── DisponibilidadWidget (inteligente) ───────────────────────────────────────

function DisponibilidadWidget({ campusId }: { campusId: number | null }) {
  const { can, isAdmin }  = usePermissions();
  const hasWorship        = isAdmin || can('disponibilidad:submit');
  const hasTecnicos       = isAdmin || can('tecnicos:submit');
  const hasBoth           = hasWorship && hasTecnicos;

  const [activeTab, setActiveTab] = useState<'worship' | 'tecnicos'>(
    hasWorship ? 'worship' : 'tecnicos',
  );

  const weekCurrent = toWeekLabel(new Date());
  const weekNext    = shiftWeek(weekCurrent, 1);

  // Carga semana actual + siguiente para ambos canales
  const { data: worshipCur  = [], isLoading: loadWC } = useMyDisponibilidad(campusId, weekCurrent);
  const { data: worshipNext = [], isLoading: loadWN } = useMyDisponibilidad(campusId, weekNext);
  const { data: tecnicosCur  = [], isLoading: loadTC } = useMyTecnicosDisponibilidad(campusId, weekCurrent);
  const { data: tecnicosNext = [], isLoading: loadTN } = useMyTecnicosDisponibilidad(campusId, weekNext);

  // Combinar: primero los de esta semana, luego los de la siguiente
  const savedWorship  = [...worshipCur,  ...worshipNext];
  const savedTecnicos = [...tecnicosCur, ...tecnicosNext];
  const loadW = loadWC || loadWN;
  const loadT = loadTC || loadTN;

  // Si no tiene ningún permiso, no renderizar
  if (!hasWorship && !hasTecnicos) return null;

  // Semana relevante = la que tiene datos (prioridad semana actual)
  const activeWeekW = worshipCur.length  > 0 ? weekCurrent : weekNext;
  const activeWeekT = tecnicosCur.length > 0 ? weekCurrent : weekNext;
  const activeWeek  = activeTab === 'worship' ? activeWeekW : activeWeekT;

  const current = activeTab === 'worship'
    ? { saved: savedWorship,  isLoading: loadW, href: `/dashboard/worship/disponibilidad`,                             color: '#5DCAA5' }
    : { saved: savedTecnicos, isLoading: loadT, href: `/dashboard/produccion-general/tecnicos/disponibilidad`,         color: '#85B7EB' };

  const responded = current.saved.length > 0;

  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Tabs — solo visibles cuando tiene ambos permisos */}
      {hasBoth && (
        <div className="flex" style={{ borderBottom: '1px solid #1f1f1f' }}>
          {(['worship', 'tecnicos'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const color    = tab === 'worship' ? '#5DCAA5' : '#85B7EB';
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2 text-[11px] font-semibold transition-all"
                style={{
                  color:        isActive ? color : 'rgba(255,255,255,0.35)',
                  borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
                }}
              >
                {tab === 'worship' ? 'Worship' : 'Técnicos'}
              </button>
            );
          })}
        </div>
      )}

      {/* Contenido — link a la página del canal activo */}
      <Link href={current.href} className="p-4 flex items-start gap-3.5 flex-1 transition-all hover:bg-white/[0.03]">
        <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: `${current.color}18` }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={current.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <polyline points="9 16 11 18 15 14" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight text-white">Mi disponibilidad</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatWeekLabel(activeWeek)}</p>
          <div className="mt-1.5">
            {current.isLoading ? (
              <div className="h-3.5 w-16 rounded-full animate-pulse" style={{ background: '#1f1f1f' }} />
            ) : !campusId ? (
              <Badge label="Sin campus asignado" color="amber" />
            ) : responded ? (
              <Badge label="✓ Enviada" color="green" />
            ) : (
              <Badge label="Pendiente" color="amber" />
            )}
          </div>
          <p className="text-[10px] font-medium mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {responded ? 'Actualizar →' : 'Enviar mi disponibilidad →'}
          </p>
        </div>
      </Link>

      {/* Encuentros confirmados (available === true) */}
      {(() => {
        const confirmados = current.saved.filter((s) => s.available);
        if (!confirmados.length) return null;
        return (
          <div style={{ borderTop: '1px solid #1f1f1f', padding: '10px 14px 12px' }}>
            <p className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Comprometido a servir
            </p>
            <div className="flex flex-col gap-1.5">
              {confirmados.map((s) => (
                <div key={s.scheduleKey}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                  style={{ background: '#1a1a1a', border: '1px solid #242424' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#5DCAA5' }} />
                  <span className="text-[11px] font-semibold text-white/80 capitalize">{s.dia}</span>
                  {s.bloque && (
                    <span className="text-[10px] font-bold px-1.5 py-px rounded"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                      {s.bloque}
                    </span>
                  )}
                  <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.hora} hrs</span>
                  {s.nota && (
                    <span className="text-[9px] truncate max-w-[80px]" style={{ color: 'rgba(255,255,255,0.25)' }} title={s.nota}>
                      · {s.nota}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </Card>
  );
}

// ── PendingUsersBanner ────────────────────────────────────────────────────────

function PendingUsersBanner({ enabled }: { enabled: boolean }) {
  const { data: users } = useUsers(undefined, { enabled });
  const pendingCount = users?.filter((u) => u.status === 'pending').length ?? 0;

  if (!enabled || pendingCount === 0) return null;

  return (
    <Link
      href="/dashboard/directorio/personas?status=pending"
      className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl transition-all hover:border-amber-700/50"
      style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#FBC775" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-[13px] font-bold text-white">
            {pendingCount} {pendingCount === 1 ? 'usuario pendiente' : 'usuarios pendientes'} de tu revisión
          </p>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
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

  const { data: fichas, isLoading: fichasLoading } = useMiFichas();
  const { data: noticiasGlobal, isLoading: loadingGlobal } = useNoticiasGlobal();
  const { data: noticiasCampus, isLoading: loadingCampus } = useNoticiasCampus();
  const { user } = useAuthStore();

  const hasWorship  = isAdmin || can('disponibilidad:submit');
  const hasTecnicos = isAdmin || can('tecnicos:submit');

  // Mis equipos y ministerios
  const { data: orgProfile, isLoading: orgLoading } = useOrgUserProfile(user?.id ?? null);
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
  const miFichasCount    = fichas?.length ?? 0;
  const fichasCompletadas = fichas?.filter((f) => f.status === 'complete').length ?? 0;

  const initials = user
    ? ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || '?'
    : '?';

  return (
    <div className="min-h-screen -m-6 px-6 py-6" style={{ background: '#0a0a0a' }}>
      <div className="space-y-5 max-w-6xl mx-auto">
        <PendingUsersBanner enabled={can('users:edit')} />

        {/* Identidad compacta + bienvenida */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[21px] font-bold text-white leading-tight">
              Bienvenido a casa{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Tu campus virtual de ARM Global — todo lo de tu iglesia global y local, en un solo lugar.
            </p>
          </div>

          <Link href="/dashboard/perfil"
            className="flex items-center gap-2.5 pl-2 pr-3.5 py-2 rounded-full transition-all hover:border-white/20 flex-shrink-0"
            style={{ background: '#111', border: '1px solid #1f1f1f' }}>
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[11px]"
                style={{ background: 'rgba(99,102,241,0.18)', color: '#A5B4FC' }}>
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-white leading-none truncate max-w-[140px]">
                {user ? `${user.firstName} ${user.lastName}` : '—'}
              </p>
              <p className="text-[10px] mt-1 truncate max-w-[140px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {user?.role?.name ?? 'Sin rol'}{user?.campus?.name ? ` · ${user.campus.name}` : ''}
              </p>
            </div>
          </Link>
        </div>

        {/* Tarjetas de stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-[22px] font-bold text-white leading-none">
                {fichasLoading ? '…' : String(miFichasCount)}
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Fichas técnicas</p>
              {!fichasLoading && fichasCompletadas > 0 && (
                <p className="text-[10px] font-medium mt-1" style={{ color: '#5DCAA5' }}>
                  {fichasCompletadas} completa{fichasCompletadas !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </Card>

          {/* Mis equipos */}
          <Card href="/dashboard/orgchart" className="p-5 flex items-start gap-4">
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
                  <div className="h-6 w-8 rounded animate-pulse" style={{ background: '#1a1a1a' }} />
                  <div className="h-3 w-32 rounded animate-pulse" style={{ background: '#1a1a1a' }} />
                </div>
              ) : myMemberships.length === 0 ? (
                <>
                  <p className="text-[22px] font-bold leading-none" style={{ color: 'rgba(255,255,255,0.2)' }}>—</p>
                  <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Sin equipos asignados</p>
                </>
              ) : (
                <>
                  <p className="text-[22px] font-bold text-white leading-none">{myMemberships.length}</p>
                  <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {myMemberships.length === 1 ? 'Equipo o ministerio' : 'Equipos y ministerios'}
                  </p>
                  {myUniqueAreas.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {myUniqueAreas.slice(0, 2).map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full max-w-[110px]"
                          style={{ background: `${a.color}22`, color: a.color }}
                        >
                          <span>{a.icon}</span>
                          <span className="truncate">{a.name}</span>
                        </span>
                      ))}
                      {myUniqueAreas.length > 2 && (
                        <span className="text-[10px] self-center font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          +{myUniqueAreas.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Disponibilidad — ocupa 2 columnas en desktop */}
          <div className="sm:col-span-2">
            {(hasWorship || hasTecnicos) ? (
              <DisponibilidadWidget campusId={user?.campusId ?? null} />
            ) : (
              <Card className="p-5 flex items-center gap-4 h-full">
                <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: '#1a1a1a' }}>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                <div>
                  <p className="text-[22px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>—</p>
                  <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Notificaciones nuevas</p>
                </div>
              </Card>
            )}
          </div>
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
