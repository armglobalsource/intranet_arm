import type { Metadata } from 'next';
import { ProduccionGeneralClient } from './ProduccionGeneralClient';

export const metadata: Metadata = { title: 'Producción General | Ecosistema' };

export default function Page() {
  return <ProduccionGeneralClient />;
}
