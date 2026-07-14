import type { Metadata } from 'next';
import { TecnicosDisponibilidadClient } from './TecnicosDisponibilidadClient';

export const metadata: Metadata = { title: 'Disponibilidad Técnicos | Intranet' };

export default function Page() {
  return <TecnicosDisponibilidadClient />;
}
