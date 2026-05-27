import type { Metadata } from 'next';
import { NoticiasAdminClient } from './NoticiasAdminClient';

export const metadata: Metadata = { title: 'Publicador de Noticias | Intranet' };

export default function Page() {
  return <NoticiasAdminClient />;
}
