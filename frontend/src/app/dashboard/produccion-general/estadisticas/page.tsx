import { Metadata } from 'next';

export const metadata: Metadata = { title: 'Estadísticas · ARM' };

export default function EstadisticasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Métricas y análisis de producción general.
        </p>
      </div>

      <div className="card p-6">
        <p className="text-gray-400 text-sm">Próximamente.</p>
      </div>
    </div>
  );
}
