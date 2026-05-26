import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MinisterioDetalleClient } from './MinisterioDetalleClient';

// ── Config de cada ministerio ─────────────────────────────────────────────────

export const MINISTERIOS_CONFIG: Record<string, {
  name:      string;
  segmento:  string;
  color:     string;
  emoji:     string;
  desc:      string;
  orgSlug?:  string; // si existe en el organigrama, carga su árbol
}> = {
  'ar-kids': {
    name:     'AR Kids',
    segmento: 'Niños de 2 a 7 años',
    color:    '#F59E0B',
    emoji:    '🧒',
    desc:     'Espacio diseñado para que los más pequeños de la familia ARM vivan una experiencia con Dios a su medida, con dinámica, creatividad y amor.',
  },
  'ar-tweens': {
    name:     'AR Tweens',
    segmento: 'Preadolescentes de 8 a 12 años',
    color:    '#10B981',
    emoji:    '👦',
    desc:     'Un lugar donde los preadolescentes pueden conocer a Jesús y crecer en su fe en una etapa clave de su desarrollo.',
  },
  'ar-teens': {
    name:     'AR Teens',
    segmento: 'Adolescentes de 13 a 17 años',
    color:    '#6366F1',
    emoji:    '🎯',
    desc:     'Ministerio dedicado a acompañar a los adolescentes en su identidad y propósito en Cristo durante los años más desafiantes de su vida.',
  },
  'ar-jovenes': {
    name:     'AR Jóvenes (JVNS)',
    segmento: 'Jóvenes de 18 a 30 años',
    color:    '#EC4899',
    emoji:    '🔥',
    desc:     'Comunidad vibrante que desafía a la generación joven a vivir con propósito, conectar con Dios y transformar su entorno.',
  },
  'ar-worship': {
    name:     'AR Worship',
    segmento: 'Ministerio de alabanza',
    color:    '#D97706',
    emoji:    '🎵',
    desc:     'Lideran el ministerio musical de adoración con foco en el desarrollo espiritual y la excelencia artística.',
    orgSlug:  'worship',
  },
  'ar-hombres': {
    name:     'AR Hombres',
    segmento: 'Ministerio de hombres',
    color:    '#2563EB',
    emoji:    '🛡️',
    desc:     'Comunidad de hombres comprometidos con crecer espiritualmente, servir a sus familias y ser líderes en sus esferas de influencia.',
  },
  'ar-mujeres': {
    name:     'AR Mujeres',
    segmento: 'Ministerio de mujeres',
    color:    '#DB2777',
    emoji:    '🌸',
    desc:     'Espacio de encuentro, crecimiento y comunidad para las mujeres de ARM, donde se celebra la identidad y el propósito femenino en Cristo.',
  },
  'ar-gold': {
    name:     'AR Gold',
    segmento: 'Adultos mayores de 65+ años',
    color:    '#B45309',
    emoji:    '⭐',
    desc:     'Ministerio que honra y acompaña a los adultos mayores, reconociendo su legado y ofreciéndoles comunidad, cuidado y propósito.',
  },
};

// ── Metadata dinámica ─────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const config = MINISTERIOS_CONFIG[slug];
  return { title: config?.name ?? 'Ministerio' };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function MinisterioPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const config = MINISTERIOS_CONFIG[slug];
  if (!config) notFound();

  return <MinisterioDetalleClient slug={slug} config={config} />;
}
