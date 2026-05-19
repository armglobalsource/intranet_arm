import type { Metadata } from 'next';
import { FichasAdminClient } from './FichasAdminClient';

export const metadata: Metadata = { title: 'Admin Fichas | Intranet' };
export default function Page() { return <FichasAdminClient />; }
