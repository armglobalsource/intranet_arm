import { notFound } from 'next/navigation';
import { STATS_VIEWS } from '@/lib/statistics-navigation';
import { EstadisticasClient } from '../EstadisticasClient';
import { ControlReportesClient } from '../ControlReportesClient';
import { ReporteSemanalClient } from '../ReporteSemanalClient';

export function generateStaticParams() {
  return STATS_VIEWS.filter(view => view.slug).map(view => ({ section: view.slug }));
}
export function generateMetadata({ params }: { params: { section: string } }) {
  const view = STATS_VIEWS.find(view => view.slug === params.section);
  return { title: `${view?.label ?? 'Estadísticas'} · Estadísticas ARM` };
}
export default function StatisticsSection({ params }: { params: { section: string } }) {
  if (!STATS_VIEWS.some(view => view.slug === params.section && view.slug)) notFound();
  if (params.section === 'operacion') return <ControlReportesClient />;
  if (params.section === 'reporte-semanal') return <ReporteSemanalClient />;
  return <EstadisticasClient />;
}
