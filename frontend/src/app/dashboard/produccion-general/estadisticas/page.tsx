import { Metadata } from 'next';
import { EstadisticasClient } from './EstadisticasClient';

export const metadata: Metadata = { title: 'Estadísticas · ARM' };

export default function EstadisticasPage() {
  return <EstadisticasClient />;
}
