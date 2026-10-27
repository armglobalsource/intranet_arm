export const ALL_FICHA_SECTIONS = [
  'pastoral', 'escena', 'produccion', 'media', 'streaming',
  'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit',
] as const;

export type FichaSectionName = typeof ALL_FICHA_SECTIONS[number];

export const FICHA_SECTION_LABELS: Record<FichaSectionName, string> = {
  pastoral:    'Equipo Pastoral',
  produccion:  'Producción',
  media:       'Media',
  streaming:   'Streaming',
  escena:      'AR Worship',
  setList:     'Set List',
  horarios:    'Timing',
  anuncios:    'Info Encuentro',
  voluntarios: 'Voluntarios de Servicio',
  outfit:      'Outfit / Paleta',
};

const ORACION_SECTIONS: FichaSectionName[] = [
  'pastoral', 'escena', 'produccion', 'media', 'streaming',
  'setList', 'horarios', 'outfit',
];

export function activeSectionsForType(type?: string): FichaSectionName[] {
  return type === 'oracion' ? ORACION_SECTIONS : [...ALL_FICHA_SECTIONS];
}

/**
 * Las fichas representan un día civil, no un instante. Se persiste a mediodía
 * UTC para evitar que un valor YYYY-MM-DD retroceda al día anterior en Chile.
 */
export function parseFichaDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error('Fecha inválida');
    return parsed;
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
}

export function formatFichaDateLabel(value: string): string {
  return parseFichaDate(value).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function deriveFichaStatus(
  type: string | undefined,
  completionStatus: Record<string, boolean> | undefined,
  hiddenSections: string[] = [],
): 'draft' | 'in_progress' | 'complete' {
  const visible = activeSectionsForType(type).filter((name) => !hiddenSections.includes(name));
  if (visible.length > 0 && visible.every((name) => completionStatus?.[name] === true)) {
    return 'complete';
  }
  if (visible.some((name) => completionStatus?.[name] === true)) return 'in_progress';
  return 'draft';
}

export function missingRequiredRows(
  rows: Array<{ label?: string; required?: boolean; shared?: boolean; values?: Record<string, string>; assignments?: Record<string, {mode: string; people: unknown[]}> }>,
  encuentroIds: string[],
): string[] {
  return rows
    .filter((row) => row.required)
    .filter((row) => {
      const values = row.values ?? {};
      const assignmentMissing = (key: string) => {
        const a = row.assignments?.[key];
        return a?.mode === 'pending' || (a?.mode === 'people' && a.people.length === 0);
      };
      if ((row.shared ? ['shared'] : encuentroIds).some(assignmentMissing)) return true;
      if (row.shared) {
        return !Object.values(values).some((value) => String(value ?? '').trim().length > 0);
      }
      return encuentroIds.some((id) => !String(values[id] ?? '').trim());
    })
    .map((row) => row.label?.trim() || 'Campo obligatorio');
}
