import { Metadata } from 'next';
import { FinanzasDashboardClient } from './FinanzasDashboardClient';

export const metadata: Metadata = { title: 'Finanzas · ARM' };

export default function FinanzasPage() {
  return <FinanzasDashboardClient />;
}
