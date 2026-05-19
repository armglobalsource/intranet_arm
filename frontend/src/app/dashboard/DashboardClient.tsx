'use client';

import { useFichas } from '@/hooks/useFichas';
import { CalendarioAnual } from './CalendarioAnual';

export function DashboardClient() {
  const { data: fichas, isLoading } = useFichas();
  const completadas = fichas?.filter((f) => f.status === 'complete').length ?? 0;

  const stats = [
    { label: 'Noticias publicadas',    value: '—',                                    icon: '📰' },
    { label: 'Fichas técnicas listas', value: isLoading ? '…' : String(completadas), icon: '📂' },
    { label: 'Voluntarios activos',    value: '—',                                    icon: '👥' },
    { label: 'Notificaciones nuevas',  value: '—',                                    icon: '🔔' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Bienvenido a la intranet corporativa</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5 flex items-center gap-4">
            <span className="text-3xl">{stat.icon}</span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Últimas noticias</h2>
        <p className="text-gray-400 text-sm">No hay noticias publicadas aún.</p>
      </div>

      <CalendarioAnual />
    </div>
  );
}
