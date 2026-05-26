import type { Metadata } from 'next';
import { MinisteriosClient } from './MinisteriosClient';

export const metadata: Metadata = { title: 'Ministerios' };

export default function MinisteriosPage() {
  return <MinisteriosClient />;
}
