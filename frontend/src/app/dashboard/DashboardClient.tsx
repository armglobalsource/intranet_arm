'use client';

import Link from 'next/link';
import { useMiFichas } from '@/hooks/useFichas';
import { useNoticiasGlobal, useNoticiasCampus } from '@/hooks/useNoticias';
import type { Noticia } from '@/hooks/useNoticias';
import { useAuthStore } from '@/lib/store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';
import { CalendarioAnual } from './CalendarioAnual';
import { useOrgUserProfile } from '@/hooks/useOrgChart';
import { membershipArea } from '@/types/orgchart';
import { useMyDisponibilidad } from '@/hooks/useDisponibilidad';
import { toWeekLabel, formatWeekLabel } from '@/types/disponibilidad';

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

// ── NoticiaCard ───────────────────────────────────────────────────────────────

function NoticiaCard({ noticia }: { noticia: Noticia }) {
  return (
    <div className="flex flex-col gap-1.5 py-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
      {noticia.pinned && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 w-fit">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
          </svg>
          Destacado
        </span>
      )}
      <p className="text-sm font-semibold text-gray-900 leading-snug">{noticia.title}</p>
      {noticia.excerpt && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{noticia.excerpt}</p>
      )}
      <p className="text-[10px] text-gray-400">{timeAgo(noticia.createdAt)}</p>
    </div>
  );
}

// ── HubNoticias ───────────────────────────────────────────────────────────────

function HubNoticias({
  title,
  subtitle,
  icon,
  accentColor,
  noticias,
  isLoading,
}: {
  title:       string;
  subtitle:    string;
  icon:        React.ReactNode;
  accentColor: string;
  noticias:    Noticia[] | undefined;
  isLoading:   boolean;
}) {
  const items = noticias ?? [];

  return (
    <div className="card p-0 overflow-hidden flex flex-col">
      {/* Header con acento de color */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accentColor}15` }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-[10px] text-gray-400">{subtitle}</p>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-5 flex-1">
        {isLoading ? (
          <div className="space-y-3 py-3">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-1.5 py-2">
                <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
              style={{ background: `${accentColor}10` }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
                stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z" />
                <polyline points="17 20 17 13 7 13 7 20" />
                <polyline points="7 4 7 8 15 8" />
              </svg>
            </div>
            <p className="text-xs text-gray-400 font-medium">No hay noticias publicadas</p>
          </div>
        ) : (
          <div className="divide-y-0">
            {items.slice(0, 4).map((n) => (
              <NoticiaCard key={n.id} noticia={n} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="px-5 py-2.5" style={{ borderTop: '1px solid #F9FAFB' }}>
          <span className="text-[10px] text-gray-300">
            {items.length} noticia{items.length !== 1 ? 's' : ''} publicada{items.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

// ── DisponibilidadWidget ──────────────────────────────────────────────────────

function DisponibilidadWidget({ campusId }: { campusId: number | null }) {
  const weekLabel = toWeekLabel(new Date());
  const { data: saved = [], isLoading } = useMyDisponibilidad(campusId, weekLabel);
  const responded = saved.length > 0;

  return (
    <Link
      href="/dashboard/worship/disponibilidad"
      className="p-5 flex items-start gap-4 rounded-2xl transition-all group"
      style={{ background: '#E5E7EB', border: '1px solid #D1D5DB' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#D1D5DB')}
      onMouseLeave={e => (e.currentTarget.style.background = '#E5E7EB')}
    >
      <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.07)' }}>
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"
          stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <polyline points="9 16 11 18 15 14" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight text-gray-900">Mi disponibilidad</p>
        <p className="text-xs mt-0.5 text-gray-500">{formatWeekLabel(weekLabel)}</p>
        <div className="mt-1.5">
          {isLoading ? (
            <div className="h-4 w-20 rounded-full animate-pulse bg-gray-300" />
          ) : !campusId ? (
            <span className="text-[10px] font-semibold text-yellow-600">Sin campus asignado</span>
          ) : responded ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 text-green-700 bg-green-100 border border-green-200">
              ✓ Enviada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 text-amber-700 bg-amber-100 border border-amber-200">
              Pendiente
            </span>
          )}
        </div>
        <p className="text-[10px] font-medium mt-1.5 text-gray-500">
          {responded ? 'Actualizar mi disponibilidad →' : 'Enviar mi disponibilidad →'}
        </p>
      </div>
    </Link>
  );
}

// ── DashboardClient ───────────────────────────────────────────────────────────

export function DashboardClient() {
  const { can, isAdmin } = usePermissions();
  const canDisponibilidad = true; // todos los usuarios ven la card; el backend valida al enviar

  const { data: fichas, isLoading: fichasLoading } = useMiFichas();
  const { data: noticiasGlobal, isLoading: loadingGlobal } = useNoticiasGlobal();
  const { data: noticiasCampus, isLoading: loadingCampus } = useNoticiasCampus();
  const { user } = useAuthStore();

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
    <div className="space-y-6">
      {/* Bienvenida */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido a Casa{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Bienvenido al campus virtual de ARM Global, aquí encontrarás todo acerca de tu iglesia global y local.
        </p>
      </div>

      {/* Tarjetas de stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Mi perfil */}
        <Link href="/dashboard/perfil" className="card p-5 flex items-center gap-4 hover:shadow-md hover:border-gray-300 transition-all group">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="avatar"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-200 group-hover:ring-gray-400 transition-all" />
          ) : (
            <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200 group-hover:ring-indigo-400 transition-all">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate leading-tight">
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{user?.role?.name ?? 'Sin rol'}</p>
            {user?.campus?.name && (
              <p className="text-xs text-gray-400 truncate">{user.campus.name}</p>
            )}
            <p className="text-[10px] text-indigo-500 font-medium mt-1 group-hover:text-indigo-600 transition-colors">
              Ver perfil →
            </p>
          </div>
        </Link>

        {/* Mis fichas */}
        <Link href="/dashboard/mis-fichas"
          className="card p-5 flex items-center gap-4 hover:shadow-md hover:border-gray-300 transition-all group">
          <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center bg-gray-900 group-hover:bg-black transition-all">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {fichasLoading ? '…' : String(miFichasCount)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Mis fichas técnicas</p>
            {!fichasLoading && fichasCompletadas > 0 && (
              <p className="text-[10px] text-emerald-600 font-medium mt-1">
                {fichasCompletadas} completa{fichasCompletadas !== 1 ? 's' : ''}
              </p>
            )}
            <p className="text-[10px] text-gray-400 font-medium mt-1 group-hover:text-gray-600 transition-colors">
              Ver fichas →
            </p>
          </div>
        </Link>

        {/* Mis equipos */}
        <Link href="/dashboard/orgchart"
          className="card p-5 flex items-start gap-4 hover:shadow-md hover:border-gray-300 transition-all group">
          <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center bg-emerald-50 group-hover:bg-emerald-100 transition-all">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="#16A34A"
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
                <div className="h-6 w-8 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : myMemberships.length === 0 ? (
              <>
                <p className="text-2xl font-bold text-gray-300 leading-none">—</p>
                <p className="text-xs text-gray-400 mt-0.5">Sin equipos asignados</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900 leading-none">{myMemberships.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {myMemberships.length === 1 ? 'Equipo o ministerio' : 'Equipos y ministerios'}
                </p>
                {myUniqueAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {myUniqueAreas.slice(0, 2).map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full max-w-[110px]"
                        style={{ background: `${a.color}18`, color: a.color }}
                      >
                        <span>{a.icon}</span>
                        <span className="truncate">{a.name}</span>
                      </span>
                    ))}
                    {myUniqueAreas.length > 2 && (
                      <span className="text-[10px] text-gray-400 self-center font-medium">
                        +{myUniqueAreas.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
            <p className="text-[10px] text-gray-400 font-medium mt-1.5 group-hover:text-gray-600 transition-colors">
              Ver organigrama →
            </p>
          </div>
        </Link>

        {/* Disponibilidad / Notificaciones */}
        {canDisponibilidad ? (
          <DisponibilidadWidget campusId={user?.campusId ?? null} />
        ) : (
          <div className="card p-5 flex items-center gap-4">
            <span className="text-3xl">🔔</span>
            <div>
              <p className="text-2xl font-bold text-gray-900">—</p>
              <p className="text-xs text-gray-500">Notificaciones nuevas</p>
            </div>
          </div>
        )}
      </div>

      {/* Hubs de noticias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HubNoticias
          title="Noticias Global"
          subtitle="Comunicados para toda la red ARM"
          accentColor="#6366F1"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          }
          noticias={noticiasGlobal}
          isLoading={loadingGlobal}
        />

        <HubNoticias
          title="Noticias Campus"
          subtitle={user?.campus?.name ? `Noticias de ${user.campus.name}` : 'Noticias de tu campus local'}
          accentColor="#10B981"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
              <polyline points="9 21 9 13 15 13 15 21" />
            </svg>
          }
          noticias={noticiasCampus}
          isLoading={loadingCampus}
        />
      </div>

      <CalendarioAnual />
    </div>
  );
}
