import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MINISTERIOS_MAP } from '../ministerios.config';
import { MinisterioDetalleClient } from './MinisterioDetalleClient';

// ── Metadata dinámica ─────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const config = MINISTERIOS_MAP[slug];
  return { title: config?.name ?? 'Ministerio' };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MinisterioPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const config = MINISTERIOS_MAP[slug];
  if (!config) notFound();

  return <MinisterioDetalleClient slug={slug} config={config} />;
}
