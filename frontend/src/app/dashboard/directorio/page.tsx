import type { Metadata } from 'next';
import { DirectorioClient } from './DirectorioClient';

export const metadata: Metadata = { title: 'Configuración' };

export default function DirectorioPage() {
  return <DirectorioClient />;
}
