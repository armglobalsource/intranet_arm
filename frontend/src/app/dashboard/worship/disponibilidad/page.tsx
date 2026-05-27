import type { Metadata } from 'next';
import { DisponibilidadClient } from './DisponibilidadClient';

export const metadata: Metadata = { title: 'Disponibilidad Worship | Intranet' };

export default function Page() {
  return <DisponibilidadClient />;
}
