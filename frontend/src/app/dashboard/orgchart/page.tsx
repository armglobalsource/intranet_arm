import type { Metadata } from 'next';
import { OrgChartClient } from './OrgChartClient';

export const metadata: Metadata = { title: 'Organigramas' };

export default function OrgChartPage() {
  return <OrgChartClient />;
}
