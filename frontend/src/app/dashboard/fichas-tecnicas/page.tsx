import type { Metadata } from 'next';
import { FichasTecnicasClient } from './FichasTecnicasClient';

export const metadata: Metadata = { title: 'Fichas Técnicas | Intranet' };
export default function Page() { return <FichasTecnicasClient />; }
