import type { Metadata } from 'next';
import { FichasArchivadasClient } from './FichasArchivadasClient';

export const metadata: Metadata = { title: 'Fichas Archivadas | Intranet' };
export default function Page() { return <FichasArchivadasClient />; }
