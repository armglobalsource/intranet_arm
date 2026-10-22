import { ALL_FICHA_SECTIONS, deriveFichaStatus, type FichaSectionName } from './fichas.utils';
const SECTIONS = ALL_FICHA_SECTIONS;
type SectionName = FichaSectionName;
const SECTIONS_ORACION: SectionName[] = ['pastoral', 'escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'outfit'];
const SECTIONS_REGULAR: SectionName[] = [...ALL_FICHA_SECTIONS];
// ── Filas predeterminadas — Servicios regulares ───────────────────────────────

export function defaultRows(section: SectionName): any[] {
  switch (section) {

    // ── Equipo Pastoral ────────────────────────────────────────────────────
    case 'pastoral':
      return [
        { id: 'p1', label: 'Bienvenida',          type: 'person', shared: false, values: {}, order: 0, required: true  },
        { id: 'p2', label: 'Predicación',          type: 'person', shared: false, values: {}, order: 1, required: true  },
        { id: 'p3', label: 'Siembra',              type: 'person', shared: false, values: {}, order: 2, required: false },
        { id: 'p4', label: 'Despedida y Oración',  type: 'person', shared: false, values: {}, order: 3, required: false },
      ];

    // ── AR Worship / Banda ─────────────────────────────────────────────────
    case 'escena':
      return [
        { id: 'esc1',  label: 'VIO',                  type: 'text',   shared: true, values: {}, order: 0,  required: false },
        { id: 'esc2',  label: 'Encargado Armonías',   type: 'person', shared: true, values: {}, order: 1,  required: false },
        { id: 'esc3',  label: 'Voz 1',               type: 'person', shared: true, values: {}, order: 2,  required: false },
        { id: 'esc4',  label: 'Voz 2',               type: 'person', shared: true, values: {}, order: 3,  required: false },
        { id: 'esc5',  label: 'Voz 3',               type: 'person', shared: true, values: {}, order: 4,  required: false },
        { id: 'esc6',  label: 'Gtr Eléctrica / MD',  type: 'person', shared: true, values: {}, order: 5,  required: false },
        { id: 'esc7',  label: 'Piano',               type: 'person', shared: true, values: {}, order: 6,  required: false },
        { id: 'esc8',  label: 'Bajo',                type: 'person', shared: true, values: {}, order: 7,  required: false },
        { id: 'esc9',  label: 'Batería',             type: 'person', shared: true, values: {}, order: 8,  required: false },
        { id: 'esc10', label: 'Posición Izquierda', type: 'person', shared: true, values: {}, order: 9,  required: false },
        { id: 'esc11', label: 'Posición Centro',    type: 'person', shared: true, values: {}, order: 10, required: false },
        { id: 'esc12', label: 'Posición Derecha',   type: 'person', shared: true, values: {}, order: 11, required: false },
        { id: 'esc_comment', label: 'Comentarios del Productor', type: 'text', shared: true, values: {}, order: 12, required: false },
      ];

    // ── Producción ─────────────────────────────────────────────────────────
    case 'produccion':
      return [
        { id: 'pr1',  label: 'Productor General',        type: 'person', shared: true, values: { shared: 'Ps. Rodrigo Quiroz' }, order: 0,  required: true  },
        { id: 'pr2',  label: 'Encargado Técnico',        type: 'person', shared: true, values: {},                               order: 1,  required: false },
        { id: 'pr3',  label: 'Productor del Encuentro',  type: 'person', shared: true, values: {},                               order: 2,  required: true  },
        { id: 'pr4',  label: 'Sonido',                   type: 'person', shared: true, values: {},                               order: 3,  required: true  },
        { id: 'pr5',  label: 'Asistente Sonido',         type: 'person', shared: true, values: {},                               order: 4,  required: false },
        { id: 'pr6',  label: 'Stage',                    type: 'person', shared: true, values: {},                               order: 5,  required: false },
        { id: 'pr7',  label: 'Iluminación',              type: 'person', shared: true, values: {},                               order: 6,  required: false },
        { id: 'pr8',  label: 'Visuales',                 type: 'person', shared: true, values: {},                               order: 7,  required: false },
        { id: 'pr9',  label: 'ProPresenter',             type: 'person', shared: true, values: {},                               order: 8,  required: false },
        { id: 'pr10', label: 'Broadcast',                type: 'person', shared: true, values: {},                               order: 9,  required: false },
        { id: 'pr11', label: 'RRSS',                     type: 'person', shared: true, values: {},                               order: 10, required: false },
      ];

    // ── Media ──────────────────────────────────────────────────────────────
    case 'media':
      return [
        { id: 'media1', label: 'Historias',            type: 'person', shared: true, values: {}, order: 0, required: false },
        { id: 'media2', label: 'Fotografía',           type: 'person', shared: true, values: {}, order: 1, required: false },
        { id: 'media3', label: 'Edición',              type: 'person', shared: true, values: {}, order: 2, required: false },
        { id: 'media4', label: 'Registro Audiovisual', type: 'person', shared: true, values: {}, order: 3, required: false },
      ];

    // ── Streaming ──────────────────────────────────────────────────────────
    case 'streaming':
      return [
        { id: 'st1', label: 'Director / Wirecast', type: 'person', shared: true, values: {}, order: 0, required: true  },
        { id: 'st2', label: 'Cam 1',              type: 'person', shared: true, values: {}, order: 1, required: false },
        { id: 'st3', label: 'Cam 2',              type: 'person', shared: true, values: {}, order: 2, required: false },
        { id: 'st4', label: 'Cam 3 / Pluma',      type: 'person', shared: true, values: {}, order: 3, required: false },
        { id: 'st5', label: 'Cam 4 / Móvil',      type: 'person', shared: true, values: {}, order: 4, required: false },
      ];

    // ── Set List ───────────────────────────────────────────────────────────
    case 'setList':
      return [
        { id: 'sl1', label: 'Canción 1', type: 'song', shared: false, values: {}, order: 0, required: false },
        { id: 'sl2', label: 'Canción 2', type: 'song', shared: false, values: {}, order: 1, required: false },
        { id: 'sl3', label: 'Canción 3', type: 'song', shared: false, values: {}, order: 2, required: false },
        { id: 'sl4', label: 'Canción 4', type: 'song', shared: false, values: {}, order: 3, required: false },
        { id: 'sl5', label: 'Canción 5', type: 'song', shared: false, values: {}, order: 4, required: false },
        { id: 'sl6', label: 'Canción 6', type: 'song', shared: false, values: {}, order: 5, required: false },
      ];

    // ── Horarios ───────────────────────────────────────────────────────────
    case 'horarios':
      return [
        { id: 'h1', label: 'Preparación sala',    type: 'text', shared: true,  values: {}, order: 0, required: false },
        { id: 'h2', label: 'Apertura puertas',    type: 'text', shared: false, values: {}, order: 1, required: false },
        { id: 'h3', label: 'Ensayo',              type: 'text', shared: false, values: {}, order: 2, required: false },
        { id: 'h4', label: 'Inicio Encuentro',    type: 'text', shared: false, values: {}, order: 3, required: false },
        { id: 'h5', label: 'Inicio Worship',      type: 'text', shared: false, values: {}, order: 4, required: false },
        { id: 'h6', label: 'Predicación',         type: 'text', shared: false, values: {}, order: 5, required: false },
        { id: 'h7', label: 'Tiempo de Respuesta', type: 'text', shared: false, values: {}, order: 6, required: false },
        { id: 'h8', label: 'Cierre / Despedida',  type: 'text', shared: false, values: {}, order: 7, required: false },
      ];

    // ── Info Encuentro ─────────────────────────────────────────────────────
    case 'anuncios':
      return [
        { id: 'an1', label: 'Info Bienvenida',  type: 'text', shared: true, values: {}, order: 0, required: false },
        { id: 'an2', label: 'Info Despedida 1', type: 'text', shared: true, values: {}, order: 1, required: false },
        { id: 'an3', label: 'Info Despedida 2', type: 'text', shared: true, values: {}, order: 2, required: false },
        { id: 'an4', label: 'Info Despedida 3', type: 'text', shared: true, values: {}, order: 3, required: false },
        { id: 'an5', label: 'Próximo evento',   type: 'text', shared: true, values: {}, order: 4, required: false },
      ];

    // ── Voluntarios ────────────────────────────────────────────────────────
    case 'voluntarios':
      return [
        { id: 'v1',  label: 'Encargado',         type: 'person', shared: true, values: {}, order: 0,  required: false },
        { id: 'v2',  label: 'Carteles 1',        type: 'person', shared: true, values: {}, order: 1,  required: false },
        { id: 'v3',  label: 'Carteles 2',        type: 'person', shared: true, values: {}, order: 2,  required: false },
        { id: 'v4',  label: 'AR Kids',           type: 'person', shared: true, values: {}, order: 3,  required: false },
        { id: 'v5',  label: 'AR Tweens',         type: 'person', shared: true, values: {}, order: 4,  required: false },
        { id: 'v6',  label: 'Cafetería',         type: 'person', shared: true, values: {}, order: 5,  required: false },
        { id: 'v7',  label: 'Ingreso Auditorio', type: 'person', shared: true, values: {}, order: 6,  required: false },
        { id: 'v8',  label: 'Auditorio',         type: 'person', shared: true, values: {}, order: 7,  required: false },
        { id: 'v9',  label: 'Siembra',           type: 'person', shared: true, values: {}, order: 8,  required: false },
        { id: 'v10', label: 'Sala bebés',        type: 'person', shared: true, values: {}, order: 9,  required: false },
      ];

    // ── Outfit / Paleta de colores ─────────────────────────────────────────
    case 'outfit':
      return [
        { id: 'outfit_palette', label: 'Paleta', type: 'text', shared: true, values: {}, order: 0, required: false },
      ];
  }
  return [];
}

// ── Filas predeterminadas — Encuentro de Oración ─────────────────────────────

export function defaultRowsOracion(section: SectionName): any[] {
  switch (section) {

    // ── Equipo Plataforma (Oradores) ───────────────────────────────────────
    case 'pastoral':
      return [
        { id: 'or_p1', label: 'Orador 1', type: 'person', shared: true, values: {}, order: 0, required: true  },
        { id: 'or_p2', label: 'Orador 2', type: 'person', shared: true, values: {}, order: 1, required: false },
        { id: 'or_p3', label: 'Orador 3', type: 'person', shared: true, values: {}, order: 2, required: false },
      ];

    // ── Equipo ARW (simplificado) ──────────────────────────────────────────
    case 'escena':
      return [
        { id: 'or_e1', label: 'Vox / Gtr',   type: 'person', shared: true, values: {}, order: 0, required: false },
        { id: 'or_e2', label: 'Vox / Piano', type: 'person', shared: true, values: {}, order: 1, required: false },
        { id: 'or_e3', label: 'Gtr / MD',    type: 'person', shared: true, values: {}, order: 2, required: false },
      ];

    // ── Equipo Técnico (oración) ───────────────────────────────────────────
    case 'produccion':
      return [
        { id: 'or_pr1',  label: 'Prod. Responsable',   type: 'person', shared: true, values: {}, order: 0,  required: true  },
        { id: 'or_pr2',  label: 'Productor',           type: 'person', shared: true, values: {}, order: 1,  required: false },
        { id: 'or_pr3',  label: 'Sala',                type: 'person', shared: true, values: {}, order: 2,  required: false },
        { id: 'or_pr4',  label: 'Asist. Sonido',       type: 'person', shared: true, values: {}, order: 3,  required: false },
        { id: 'or_pr5',  label: 'Broadcast',           type: 'person', shared: true, values: {}, order: 4,  required: false },
        { id: 'or_pr6',  label: 'Stage',               type: 'person', shared: true, values: {}, order: 5,  required: false },
        { id: 'or_pr7',  label: 'Visual / ProPresenter', type: 'person', shared: true, values: {}, order: 6, required: false },
        { id: 'or_pr8',  label: 'Visual / Arena',      type: 'person', shared: true, values: {}, order: 7,  required: false },
        { id: 'or_pr10', label: 'Iluminación',         type: 'person', shared: true, values: {}, order: 9,  required: false },
      ];

    case 'media':
      return defaultRows('media');

    // ── Equipo Streaming (oración) ─────────────────────────────────────────
    case 'streaming':
      return [
        { id: 'or_st1', label: 'Responsable',    type: 'person', shared: true, values: {}, order: 0, required: true  },
        { id: 'or_st2', label: 'Dir. TV',        type: 'person', shared: true, values: {}, order: 1, required: false },
        { id: 'or_st3', label: 'Cam 1',          type: 'person', shared: true, values: {}, order: 2, required: false },
        { id: 'or_st4', label: 'Cam 2',          type: 'person', shared: true, values: {}, order: 3, required: false },
        { id: 'or_st5', label: 'Cam 3',          type: 'person', shared: true, values: {}, order: 4, required: false },
        { id: 'or_st6', label: 'Cam 4 (Móvil)',  type: 'person', shared: true, values: {}, order: 5, required: false },
      ];

    // ── Set List — canciones de oración (shared, por momento) ─────────────
    case 'setList':
      return [
        { id: 'or_sl1', label: 'Bienvenida — Canción',           type: 'song', shared: true, values: {}, order: 0, required: false },
        { id: 'or_sl2', label: 'Gratitud — Canción',             type: 'song', shared: true, values: {}, order: 1, required: false },
        { id: 'or_sl3', label: 'Testimonios — Canción',          type: 'song', shared: true, values: {}, order: 2, required: false },
        { id: 'or_sl4', label: 'Peticiones — Canción 1',         type: 'song', shared: true, values: {}, order: 3, required: false },
        { id: 'or_sl5', label: 'Peticiones — Canción 2',         type: 'song', shared: true, values: {}, order: 4, required: false },
        { id: 'or_sl6', label: 'Oración Presencial — Canción 1', type: 'song', shared: true, values: {}, order: 5, required: false },
        { id: 'or_sl7', label: 'Oración Presencial — Canción 2', type: 'song', shared: true, values: {}, order: 6, required: false },
      ];

    // ── Horarios — flujo del Encuentro de Oración ──────────────────────────
    case 'horarios':
      return [
        { id: 'or_h1',  label: '05:00 — Llegada de Equipo',                      type: 'text', shared: true, values: { shared: 'Voluntarios · ARW · Equipo técnico' }, order: 0,  required: false },
        { id: 'or_h2',  label: '05:10-05:40 — Preparativos',                     type: 'text', shared: true, values: { shared: 'Ensambles · Prueba · Montaje áreas' },  order: 1,  required: false },
        { id: 'or_h3',  label: '05:25-05:35 — Link de Prueba',                   type: 'text', shared: true, values: { shared: 'Transmisión · Sonido' },               order: 2,  required: false },
        { id: 'or_h4',  label: '05:40-05:50 — VIO (Tiempo de ajustes)',           type: 'text', shared: true, values: { shared: 'Información Final Precisa' },          order: 3,  required: false },
        { id: 'or_h5',  label: '05:55 — Ingreso Auditorio',                      type: 'text', shared: true, values: {},                                               order: 4,  required: false },
        { id: 'or_h6',  label: '06:00 — Counter',                                type: 'text', shared: true, values: {},                                               order: 5,  required: false },
        { id: 'or_h7',  label: '06:05-06:08 — Bienvenida',                       type: 'person', shared: true, values: {}, order: 6,  required: false },
        { id: 'or_h8',  label: '06:12-06:17 — Gratitud',                         type: 'person', shared: true, values: {}, order: 7,  required: false },
        { id: 'or_h9',  label: '06:20-06:26 — Testimonios',                      type: 'person', shared: true, values: {}, order: 8,  required: false },
        { id: 'or_h10', label: '06:29-06:40 — Peticiones Campus Virtual',        type: 'person', shared: true, values: {}, order: 9,  required: false },
        { id: 'or_h11', label: '06:43-06:55 — Oración Peticiones',              type: 'person', shared: true, values: {}, order: 10, required: false },
        { id: 'or_h12', label: '07:00 — Despedida y Agradecimiento',             type: 'person', shared: true, values: {}, order: 11, required: false },
      ];

    // ── Outfit / Paleta de colores (igual para oración) ────────────────────
    case 'outfit':
      return defaultRows('outfit');

    default: return [];
  }
}

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildDefaultSections(type: string) {
  const activeSections = type === 'oracion' ? SECTIONS_ORACION : SECTIONS_REGULAR;
  const rowsFn = type === 'oracion' ? defaultRowsOracion : defaultRows;
  const sections: Record<string, any> = {};
  for (const name of activeSections) {
    sections[name] = {
      revision:     0,
      assignedTo:   null,
      assignedName: null,
      isCompleted:  false,
      completedBy:  null,
      completedAt:  null,
      rows:         rowsFn(name),
    };
  }
  return sections;
}

export function buildDefaultCompletion(type: string): Partial<Record<SectionName, boolean>> {
  const activeSections = type === 'oracion' ? SECTIONS_ORACION : SECTIONS_REGULAR;
  return Object.fromEntries(activeSections.map((s) => [s, false]));
}

export function mediaTargetsForLabel(label: string): string[] {
  const normalized = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
  const targets: string[] = [];
  if (normalized.includes('historias')) targets.push('media1');
  if (normalized.includes('fotografia')) targets.push('media2');
  if (normalized.includes('edicion')) targets.push('media3');
  if (normalized === 'registro' || normalized.includes('registro audiovisual')) targets.push('media4');
  return targets;
}

export function migrateMediaData(ficha: any) {
  const sections = Object.fromEntries(
    Object.entries(ficha.sections ?? {}).map(([name, section]: [string, any]) => [
      name,
      {
        ...section,
        rows: (section.rows ?? []).map((row: any) => ({
          ...row,
          values: { ...(row.values ?? {}) },
        })),
      },
    ]),
  );
  const production = sections.produccion;
  const legacyRows = (production?.rows ?? []).filter(
    (row: any) => mediaTargetsForLabel(String(row.label ?? '')).length > 0,
  );
  if (sections.media && legacyRows.length === 0) return null;

  const media = sections.media ?? {
    revision: 0,
    assignedTo: production?.assignedTo ?? null,
    assignedName: production?.assignedName ?? null,
    isCompleted: false,
    completedBy: null,
    completedAt: null,
    rows: defaultRows('media'),
  };
  const mediaRows = defaultRows('media').map((defaultRow) => {
    const existing = (media.rows ?? []).find((row: any) => row.id === defaultRow.id);
    return existing ? { ...defaultRow, ...existing } : defaultRow;
  });

  for (const legacyRow of legacyRows) {
    for (const targetId of mediaTargetsForLabel(String(legacyRow.label ?? ''))) {
      const target = mediaRows.find((row: any) => row.id === targetId);
      if (!target) continue;
      const existingValues = Object.values(target.values ?? {}).some(
        (value) => String(value ?? '').trim().length > 0,
      );
      if (!existingValues) target.values = { ...(legacyRow.values ?? {}) };
    }
  }

  sections.media = {
    ...media,
    revision: Number(media.revision ?? 0),
    rows: mediaRows,
  };
  if (production) {
    sections.produccion = {
      ...production,
      revision: Number(production.revision ?? 0) + (legacyRows.length > 0 ? 1 : 0),
      rows: (production.rows ?? []).filter(
        (row: any) => mediaTargetsForLabel(String(row.label ?? '')).length === 0,
      ),
    };
  }

  const completionStatus = {
    ...(ficha.completionStatus ?? {}),
    media: Boolean(ficha.completionStatus?.media),
  };
  return {
    sections,
    completionStatus,
    status: deriveFichaStatus(
      ficha.type,
      completionStatus,
      ficha.hiddenSections ?? [],
    ),
  };
}

export function encounterValue(row: any, encounterId: string): string {
  const values = row?.values ?? {};
  if (row?.shared) {
    return String(
      values.shared ??
      Object.values(values).find((value) => String(value ?? '').trim()) ??
      '',
    );
  }
  return String(values[encounterId] ?? '');
}

export function rowsForSingleEncounter(rows: any[] = [], encounterId: string): any[] {
  return rows.map((row) => {
    const value = encounterValue(row, encounterId);
    return {
      ...row,
      values: row.shared
        ? (value ? { shared: value } : {})
        : (value ? { unico: value } : {}),
    };
  });
}

export function preservePrayerSections(sections: Record<string, any>, encounterId: string) {
  return Object.fromEntries(
    Object.entries(sections ?? {}).map(([name, section]: [string, any]) => [
      name,
      {
        ...section,
        revision: 0,
        isCompleted: false,
        completedBy: null,
        completedAt: null,
        rows: rowsForSingleEncounter(section.rows, encounterId),
      },
    ]),
  );
}

export function buildGlobalSectionsFromMixedFicha(
  sourceSections: Record<string, any>,
  encounterId: string,
) {
  const target = buildDefaultSections('unico');

  for (const sectionName of SECTIONS_REGULAR) {
    const source = sourceSections?.[sectionName];
    const targetSection = target[sectionName];
    if (!source || !targetSection) continue;

    targetSection.assignedTo = source.assignedTo ?? null;
    targetSection.assignedName = source.assignedName ?? null;
    const usedIds = new Set(targetSection.rows.map((row: any) => row.id));

    for (const [index, sourceRow] of (source.rows ?? []).entries()) {
      const value = encounterValue(sourceRow, encounterId).trim();
      if (!value) continue;

      const normalizedLabel = String(sourceRow.label ?? '').trim().toLocaleLowerCase('es');
      const equivalent = targetSection.rows.find(
        (row: any) => String(row.label ?? '').trim().toLocaleLowerCase('es') === normalizedLabel,
      );
      if (equivalent) {
        equivalent.values = equivalent.shared ? { shared: value } : { unico: value };
        continue;
      }

      let id = `separado_${sectionName}_${index + 1}`;
      while (usedIds.has(id)) id = `${id}_x`;
      usedIds.add(id);
      targetSection.rows.push({
        id,
        label: sourceRow.label || `Dato conservado ${index + 1}`,
        type: sourceRow.type ?? 'text',
        shared: Boolean(sourceRow.shared),
        values: sourceRow.shared ? { shared: value } : { unico: value },
        order: targetSection.rows.length,
        required: false,
      });
    }
  }

  return target;
}

