import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Bienvenido a la intranet corporativa</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Noticias publicadas',   value: '—', icon: '📰' },
          { label: 'Documentos activos',    value: '—', icon: '📂' },
          { label: 'Empleados registrados', value: '—', icon: '👥' },
          { label: 'Notificaciones nuevas', value: '—', icon: '🔔' },
        ].map((stat) => (
          <div key={stat.label} className="card p-5 flex items-center gap-4">
            <span className="text-3xl">{stat.icon}</span>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent news placeholder */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Últimas noticias</h2>
        <p className="text-gray-400 text-sm">No hay noticias publicadas aún.</p>
      </div>
    </div>
  );
}
