import { Metadata } from 'next';
import { RevisarReportesClient } from './RevisarReportesClient';

export const metadata: Metadata = { title: 'Revisar reportes · ARM' };

export default function RevisarReportesPage() {
  return <RevisarReportesClient />;
}
