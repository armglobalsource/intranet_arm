import { Metadata } from 'next';
import { RegistrarEncuentroClient } from './RegistrarEncuentroClient';

export const metadata: Metadata = { title: 'Registrar encuentro · ARM' };

export default function RegistrarEncuentroPage() {
  return <RegistrarEncuentroClient />;
}
