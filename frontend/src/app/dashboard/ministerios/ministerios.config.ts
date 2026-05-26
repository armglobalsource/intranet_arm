// Configuración centralizada de los 8 ministerios pastorales de ARM Global.
// Importar desde aquí en cualquier página o componente de esta sección.

export interface MinistrioConfig {
  slug:     string;
  name:     string;
  segmento: string;
  color:    string;
  emoji:    string;
  desc:     string;
  orgSlug?: string; // si existe área en el organigrama, carga su árbol
}

export const MINISTERIOS: MinistrioConfig[] = [
  {
    slug:     'ar-kids',
    name:     'AR Kids',
    segmento: 'Niños de 2 a 7 años',
    color:    '#F59E0B',
    emoji:    '🧒',
    desc:     'Espacio diseñado para que los más pequeños de la familia ARM vivan una experiencia con Dios a su medida, con dinámica, creatividad y amor.',
  },
  {
    slug:     'ar-tweens',
    name:     'AR Tweens',
    segmento: 'Preadolescentes de 8 a 12 años',
    color:    '#10B981',
    emoji:    '👦',
    desc:     'Un lugar donde los preadolescentes pueden conocer a Jesús y crecer en su fe en una etapa clave de su desarrollo.',
  },
  {
    slug:     'ar-teens',
    name:     'AR Teens',
    segmento: 'Adolescentes de 13 a 17 años',
    color:    '#6366F1',
    emoji:    '🎯',
    desc:     'Ministerio dedicado a acompañar a los adolescentes en su identidad y propósito en Cristo durante los años más desafiantes de su vida.',
  },
  {
    slug:     'ar-jovenes',
    name:     'AR Jóvenes (JVNS)',
    segmento: 'Jóvenes de 18 a 30 años',
    color:    '#EC4899',
    emoji:    '🔥',
    desc:     'Comunidad vibrante que desafía a la generación joven a vivir con propósito, conectar con Dios y transformar su entorno.',
  },
  {
    slug:     'ar-worship',
    name:     'AR Worship',
    segmento: 'Ministerio de alabanza',
    color:    '#D97706',
    emoji:    '🎵',
    desc:     'Lideran el ministerio musical de adoración con foco en el desarrollo espiritual y la excelencia artística.',
    orgSlug:  'worship',
  },
  {
    slug:     'ar-hombres',
    name:     'AR Hombres',
    segmento: 'Ministerio de hombres',
    color:    '#2563EB',
    emoji:    '🛡️',
    desc:     'Comunidad de hombres comprometidos con crecer espiritualmente, servir a sus familias y ser líderes en sus esferas de influencia.',
  },
  {
    slug:     'ar-mujeres',
    name:     'AR Mujeres',
    segmento: 'Ministerio de mujeres',
    color:    '#DB2777',
    emoji:    '🌸',
    desc:     'Espacio de encuentro, crecimiento y comunidad para las mujeres de ARM, donde se celebra la identidad y el propósito femenino en Cristo.',
  },
  {
    slug:     'ar-gold',
    name:     'AR Gold',
    segmento: 'Adultos mayores de 65+ años',
    color:    '#B45309',
    emoji:    '⭐',
    desc:     'Ministerio que honra y acompaña a los adultos mayores, reconociendo su legado y ofreciéndoles comunidad, cuidado y propósito.',
  },
];

// Mapa por slug para lookups rápidos desde las páginas de detalle
export const MINISTERIOS_MAP: Record<string, MinistrioConfig> = Object.fromEntries(
  MINISTERIOS.map((m) => [m.slug, m]),
);
