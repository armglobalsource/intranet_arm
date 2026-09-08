import type { Metadata } from 'next';
import { AgendaClient } from './AgendaClient';

export const metadata: Metadata = {
  title: 'Agenda ARM Global · Esta semana',
  description: 'Fichas técnicas publicadas de la semana en curso, por campus.',
  openGraph: {
    title: 'Agenda ARM Global · Esta semana',
    description: 'Fichas técnicas publicadas de la semana en curso, por campus.',
    type: 'website',
  },
};

export default function AgendaPage() {
  return <AgendaClient />;
}
