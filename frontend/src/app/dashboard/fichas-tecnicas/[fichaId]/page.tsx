import type { Metadata } from 'next';
import { FichaEditorClient } from './FichaEditorClient';

export const metadata: Metadata = { title: 'Editor Ficha | Ecosistema' };

export default function Page({ params }: { params: { fichaId: string } }) {
  return <FichaEditorClient fichaId={params.fichaId} />;
}
