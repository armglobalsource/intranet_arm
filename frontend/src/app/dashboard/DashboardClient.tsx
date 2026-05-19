'use client';

import Link from 'next/link';
import { useMiFichas } from '@/hooks/useFichas';
import { useAuthStore } from '@/lib/store/auth.store';
import { CalendarioAnual } from './CalendarioAnual';

export function DashboardClient() {
  const { data: fichas, isLoading } = useMiFichas();
  const { user } = useAuthStore();
  const firstName = user?.firstName ?? '';

  const miFichasCount    = fichas?.length ?? 0;
  const fichasCompletadas = fichas?.filter((f) => f.status === 'complete').length ?? 0;

  const initials = user
    ? ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || '?'
    : '?';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido a Casa{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Bienvenido al campus virtual de ARM Global, aquí encontrarás todo acerca de tu iglesia global y local.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tarjeta: Mi perfil */}
        <Link href="/dashboard/perfil" className="card p-5 flex items-center gap-4 hover:shadow-md hover:border-gray-300 transition-all group">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt="avatar"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-200 group-hover:ring-gray-400 transition-all"
            />
          ) : (
            <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-lg bg-indigo-100 text-indigo-600 ring-2 ring-indigo-200 group-hover:ring-indigo-400 transition-all">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate leading-tight">
              {user ? `${user.firstName} ${user.lastName}` : '—'}
            </p>
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {user?.role?.name ?? 'Sin rol'}
            </p>
            {user?.campus?.name && (
              <p className="text-xs text-gray-400 truncate">{user.campus.name}</p>
            )}
            <p className="text-[10px] text-indigo-500 font-medium mt-1 group-hover:text-indigo-600 transition-colors">
              Ver perfil →
            </p>
          </div>
        </Link>

        {/* Mis Fichas Técnicas */}
        <Link
          href="/dashboard/mis-fichas"
          className="card p-5 flex items-center gap-4 hover:shadow-md hover:border-gray-300 transition-all group"
        >
          {/* Icono ficha técnica — negro */}
          <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center bg-gray-900 group-hover:bg-black transition-all">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {isLoading ? '…' : String(miFichasCount)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Mis fichas técnicas</p>
            {!isLoading && fichasCompletadas > 0 && (
              <p className="text-[10px] text-emerald-600 font-medium mt-1">
                {fichasCompletadas} completa{fichasCompletadas !== 1 ? 's' : ''}
              </p>
            )}
            <p className="text-[10px] text-gray-400 font-medium mt-1 group-hover:text-gray-600 transition-colors">
              Ver fichas →
            </p>
          </div>
        </Link>

        {/* Voluntarios activos */}
        <div className="card p-5 flex items-center gap-4">
          <span className="text-3xl">👥</span>
          <div>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="text-xs text-gray-500">Voluntarios activos</p>
          </div>
        </div>

        {/* Notificaciones */}
        <div className="card p-5 flex items-center gap-4">
          <span className="text-3xl">🔔</span>
          <div>
            <p className="text-2xl font-bold text-gray-900">—</p>
            <p className="text-xs text-gray-500">Notificaciones nuevas</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Últimas noticias</h2>
        <p className="text-gray-400 text-sm">No hay noticias publicadas aún.</p>
      </div>

      <CalendarioAnual />
    </div>
  );
}
