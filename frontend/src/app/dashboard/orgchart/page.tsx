import type { Metadata } from 'next';
import { OrgChartClient } from './OrgChartClient';

export const metadata: Metadata = { title: 'Organigrama' };

export default function OrgChartPage() {
  return <OrgChartClient />;
}
