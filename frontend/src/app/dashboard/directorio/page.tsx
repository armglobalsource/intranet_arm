import type { Metadata } from 'next';
import { DirectorioClient } from './DirectorioClient';

export const metadata: Metadata = { title: 'Directorio' };

export default function DirectorioPage() {
  return <DirectorioClient />;
}
