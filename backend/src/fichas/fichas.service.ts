import { BadRequestException, ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { hasPermission } from '../common/permissions';
import { CreateFichaDto, UpdateFichaDto, UpdateSectionDto, CloneFichaDto, UpdateLayoutVisualDto } from './dto/ficha.dto';
import {
  ALL_FICHA_SECTIONS,
  activeSectionsForType,
  deriveFichaStatus,
  formatFichaDateLabel,
  missingRequiredRows,
  parseFichaDate,
  type FichaSectionName,
} from './fichas.utils';

const COL = 'fichas';

const SECTIONS = ALL_FICHA_SECTIONS;
type SectionName = FichaSectionName;

// Secciones activas según tipo de ficha
const SECTIONS_ORACION: SectionName[] = ['pastoral', 'escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'outfit'];
const SECTIONS_REGULAR: SectionName[] = ['pastoral', 'escena', 'produccion', 'media', 'streaming', 'setList', 'horarios', 'anuncios', 'voluntarios', 'outfit'];

interface FichaAuthUser {
  sub: number;
  email: string;
  campusId?: number | null;
  permissions?: string[];
}

// ── Filas predeterminadas — Servicios regulares ───────────────────────────────

function defaultRows(section: SectionName): any[] {
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

function defaultRowsOracion(section: SectionName): any[] {
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

function buildDefaultSections(type: string) {
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

function buildDefaultCompletion(type: string): Partial<Record<SectionName, boolean>> {
  const activeSections = type === 'oracion' ? SECTIONS_ORACION : SECTIONS_REGULAR;
  return Object.fromEntries(activeSections.map((s) => [s, false]));
}

function mediaTargetsForLabel(label: string): string[] {
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

function encounterValue(row: any, encounterId: string): string {
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

function rowsForSingleEncounter(rows: any[] = [], encounterId: string): any[] {
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

function preservePrayerSections(sections: Record<string, any>, encounterId: string) {
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

function buildGlobalSectionsFromMixedFicha(
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

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FichasService {
  constructor(private fb: FirebaseService) {}

  private has(user: FichaAuthUser, permission: string): boolean {
    return hasPermission(user.permissions ?? [], permission);
  }

  private isGlobal(user: FichaAuthUser): boolean {
    return this.has(user, 'fichas:viewAll') || this.has(user, 'fichas:admin');
  }

  private canAccessFicha(ficha: any, user: FichaAuthUser): boolean {
    if (this.isGlobal(user)) return true;
    if (ficha.createdBy === user.sub) return true;
    if (user.campusId != null && String(ficha.campusId) === String(user.campusId)) return true;
    if (!ficha.published) return false;
    return Object.values(ficha.sections ?? {}).some((section: any) => section?.assignedTo === user.sub);
  }

  private assertCanAccessFicha(ficha: any, user: FichaAuthUser) {
    if (!this.canAccessFicha(ficha, user)) {
      throw new ForbiddenException('No tienes acceso a esta ficha');
    }
  }

  private assertCanManageFicha(ficha: any, user: FichaAuthUser) {
    if (this.isGlobal(user)) return;
    if (user.campusId != null && String(ficha.campusId) === String(user.campusId)) return;
    throw new ForbiddenException('No puedes modificar fichas de otro campus');
  }

  private assertCanPublishFicha(ficha: any, user: FichaAuthUser) {
    if (this.isGlobal(user) || ficha.createdBy === user.sub) return;
    throw new ForbiddenException('Solo el creador o un administrador puede publicar esta ficha');
  }

  async findAll(user: FichaAuthUser, campusId?: string, status?: string) {
    const effectiveCampusId = this.isGlobal(user)
      ? campusId
      : user.campusId != null ? String(user.campusId) : '__none__';

    let query: any = this.fb.db.collection(COL).orderBy('date', 'desc');
    if (effectiveCampusId) query = query.where('campusId', '==', effectiveCampusId);
    if (status)   query = query.where('status',   '==', status);
    query = query.select(
      'fichaId', 'campusId', 'campusName', 'type', 'title', 'date', 'status',
      'completionStatus', 'archived', 'published', 'createdBy', 'hiddenSections',
    );
    const snap = await query.get();
    return this.fb.toDocs(snap);
  }

  async findMine(userId: number, isAdmin: boolean) {
    const snap = await this.fb.db.collection(COL).orderBy('date', 'desc').get();
    const all  = this.fb.toDocs(snap).filter((ficha: any) => !ficha.archived);
    if (isAdmin) return all;

    return all.filter((ficha: any) => {
      // el creador siempre ve sus propias fichas (publicadas o no)
      if (ficha.createdBy === userId) return true;
      // otros usuarios solo ven fichas publicadas donde están asignados
      if (!ficha.published) return false;
      const sections = ficha.sections ?? {};
      return Object.values(sections).some((sec: any) => sec?.assignedTo === userId);
    });
  }

  async findPublishedForMobile(user: FichaAuthUser) {
    if (user.campusId == null) {
      throw new BadRequestException('Tu cuenta no tiene un campus asignado');
    }

    const campusId = Number(user.campusId);
    const campusValues: Array<string | number> = [String(user.campusId)];
    if (Number.isFinite(campusId)) campusValues.push(campusId);

    const snapshots = await Promise.all(
      campusValues.map((value) =>
        this.fb.db.collection(COL).where('campusId', '==', value).get(),
      ),
    );
    const byId = new Map<string, any>();
    for (const snapshot of snapshots) {
      for (const ficha of this.fb.toDocs(snapshot)) {
        if (ficha.published && !ficha.archived) byId.set(ficha.fichaId, ficha);
      }
    }

    return Array.from(byId.values())
      .map((ficha: any) => ({
        fichaId: ficha.fichaId,
        campusId: ficha.campusId,
        campusName: ficha.campusName,
        type: ficha.type,
        title: ficha.title,
        date: ficha.date,
        encuentros: ficha.encuentros ?? [],
        publishedAt: ficha.publishedAt ?? null,
      }))
      .sort((a: any, b: any) => {
        const aDate = a.date?.toDate?.() ?? new Date(a.date?.seconds ? a.date.seconds * 1000 : a.date);
        const bDate = b.date?.toDate?.() ?? new Date(b.date?.seconds ? b.date.seconds * 1000 : b.date);
        return aDate.getTime() - bDate.getTime();
      });
  }

  async findOne(fichaId: string) {
    const ref = this.fb.db.collection(COL).doc(fichaId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Ficha ${fichaId} no encontrada`);
    const ficha = this.fb.toObj(snap);
    const mediaMigration = migrateMediaData(ficha);
    if (!mediaMigration) return ficha;

    let migratedFicha = ficha;
    await this.fb.db.runTransaction(async (transaction) => {
      const currentSnap = await transaction.get(ref);
      if (!currentSnap.exists) {
        throw new NotFoundException(`Ficha ${fichaId} no encontrada`);
      }
      const currentFicha = this.fb.toObj(currentSnap);
      const currentMigration = migrateMediaData(currentFicha);
      if (!currentMigration) {
        migratedFicha = currentFicha;
        return;
      }
      transaction.update(ref, {
        ...currentMigration,
        mediaMigratedAt: this.fb.now(),
      });
      migratedFicha = { ...currentFicha, ...currentMigration };
    });
    return migratedFicha;
  }

  async findOneForUser(fichaId: string, user: FichaAuthUser) {
    const ficha = await this.findOne(fichaId);
    this.assertCanAccessFicha(ficha, user);
    return ficha;
  }

  async findPublic(fichaId: string) {
    const ficha = await this.findOne(fichaId);
    if (!ficha.published || ficha.archived) {
      throw new ForbiddenException('Esta ficha no está publicada');
    }
    const {
      createdBy, createdByName, lastModifiedBy, lastModifiedByName,
      archivedBy, archivedByName, publishedBy, publishedByName,
      ...publicFicha
    } = ficha;
    publicFicha.sections = Object.fromEntries(
      Object.entries(ficha.sections ?? {}).map(([name, section]: [string, any]) => {
        const { assignedTo, completedBy, revision, ...publicSection } = section;
        return [name, publicSection];
      }),
    );

    // Enriquecer con paletas y visual references usadas por esta ficha, así
    // el cliente público (que no puede autenticarse) puede resolver los IDs
    // sin llamar endpoints privados de /paletas y /visual-references.
    publicFicha.publicMeta = await this.buildPublicMeta(ficha);

    return publicFicha;
  }

  /**
   * Junta las paletas y visual references usadas por la ficha. Solo carga
   * los docs específicos referenciados (no la colección entera). Best-effort:
   * si falla algún lookup individual, devuelve arrays parciales sin error.
   */
  private async buildPublicMeta(ficha: any): Promise<{
    paletas: any[];
    visualRefs: any[];
  }> {
    // 1. Recolectar IDs de paletas — están en sections.outfit.rows[].values.<colId>
    const paletaIds = new Set<string>();
    const outfitRows = ficha.sections?.outfit?.rows ?? [];
    for (const row of outfitRows) {
      const values = row.values ?? {};
      for (const v of Object.values(values)) {
        if (typeof v === 'string' && v.trim()) paletaIds.add(String(v).trim());
      }
    }

    // 2. Recolectar IDs de visual references — están en layoutVisual.songs[].referenceIds
    const visualRefIds = new Set<number>();
    const layoutSongs = ficha.layoutVisual?.songs ?? [];
    for (const s of layoutSongs) {
      for (const id of s.referenceIds ?? []) {
        if (typeof id === 'number') visualRefIds.add(id);
      }
    }

    const [paletas, visualRefs] = await Promise.all([
      this.fetchPaletasByIds(Array.from(paletaIds)),
      this.fetchVisualRefsByIds(Array.from(visualRefIds)),
    ]);

    return { paletas, visualRefs };
  }

  private async fetchPaletasByIds(ids: string[]): Promise<any[]> {
    if (ids.length === 0) return [];
    const docs = await Promise.all(
      ids.map((id) => this.fb.db.collection('paletas').doc(id).get().catch(() => null)),
    );
    return docs
      .filter((d): d is FirebaseFirestore.DocumentSnapshot => !!d && d.exists)
      .map((d) => this.fb.toObj(d));
  }

  private async fetchVisualRefsByIds(ids: number[]): Promise<any[]> {
    if (ids.length === 0) return [];
    const docs = await Promise.all(
      ids.map((id) => this.fb.db.collection('visual_references').doc(String(id)).get().catch(() => null)),
    );
    return docs
      .filter((d): d is FirebaseFirestore.DocumentSnapshot => !!d && d.exists)
      .map((d) => this.fb.toObj(d));
  }

  async create(dto: CreateFichaDto, user: FichaAuthUser) {
    if (dto.type === 'oracion' && dto.encuentros.length !== 1) {
      throw new BadRequestException(
        'El Encuentro de Oración debe tener una ficha independiente con un solo horario.',
      );
    }
    if (!this.isGlobal(user)) {
      if (user.campusId == null || String(user.campusId) !== String(dto.campusId)) {
        throw new ForbiddenException('Solo puedes crear fichas para tu campus');
      }
    }
    const ref     = this.fb.db.collection(COL).doc();
    const fichaId = ref.id;
    const encuentrosPlain = JSON.parse(JSON.stringify(dto.encuentros));
    const doc = {
      fichaId,
      campusId:         dto.campusId,
      campusName:       dto.campusName,
      type:             dto.type,
      title:            dto.title,
      date:             this.fb.ts(parseFichaDate(dto.date)),
      encuentros:       encuentrosPlain,
      ...(dto.descripcion ? { descripcion: dto.descripcion } : {}),
      ...(dto.ubicacion   ? { ubicacion:   dto.ubicacion }   : {}),
      sections:         buildDefaultSections(dto.type),
      completionStatus: buildDefaultCompletion(dto.type),
      hiddenSections:   [],
      status:           'draft',
      published:        false,
      createdBy:        user.sub,
      createdByName:    user.email,
      createdAt:        this.fb.now(),
      lastModifiedBy:   user.sub,
      lastModifiedByName: user.email,
      lastModifiedAt:   this.fb.now(),
    };
    await ref.set(doc);
    return this.findOne(fichaId);
  }

  async update(fichaId: string, dto: UpdateFichaDto, user: FichaAuthUser) {
    const ficha = await this.findOne(fichaId);
    this.assertCanManageFicha(ficha, user);
    const data: any = {
      lastModifiedBy: user.sub,
      lastModifiedByName: user.email,
      lastModifiedAt: this.fb.now(),
    };
    if (dto.title          !== undefined) data.title          = dto.title;
    if (dto.date           !== undefined) data.date           = this.fb.ts(parseFichaDate(dto.date));
    if (dto.hiddenSections !== undefined) {
      data.hiddenSections = dto.hiddenSections;

      // Si alguna sección fue habilitada (ya no está en hiddenSections) y no existe
      // o tiene rows vacíos, inicializarla con sus filas por defecto.
      const previousHidden: string[] = ficha.hiddenSections ?? [];
      const newlyEnabled = previousHidden.filter(s => !dto.hiddenSections!.includes(s));
      for (const sectionName of newlyEnabled) {
        const existing = ficha.sections?.[sectionName];
        const needsInit = !existing || !existing.rows?.length;
        if (needsInit) {
          data[`sections.${sectionName}`] = {
            revision:     0,
            assignedTo:   existing?.assignedTo   ?? null,
            assignedName: existing?.assignedName ?? null,
            isCompleted:  false,
            completedBy:  null,
            completedAt:  null,
            rows:         (ficha.type === 'oracion' ? defaultRowsOracion : defaultRows)(sectionName as SectionName),
          };
          data[`completionStatus.${sectionName}`] = false;
        }
      }

      data.status = deriveFichaStatus(
        ficha.type,
        ficha.completionStatus ?? {},
        dto.hiddenSections,
      );
    }
    if (dto.sectionLayout !== undefined) {
      data.sectionLayout = dto.sectionLayout;
    }
    await this.fb.db.collection(COL).doc(fichaId).update(data);
    return this.findOne(fichaId);
  }

  async remove(fichaId: string, user: FichaAuthUser) {
    const ficha = await this.findOne(fichaId);
    this.assertCanManageFicha(ficha, user);
    const ref = this.fb.db.collection(COL).doc(fichaId);
    const changelog = await ref.collection('changelog').get();
    for (let index = 0; index < changelog.docs.length; index += 400) {
      const batch = this.fb.db.batch();
      changelog.docs.slice(index, index + 400).forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
    await ref.delete();
    return { fichaId };
  }

  async clone(fichaId: string, user: FichaAuthUser, dto: CloneFichaDto = {}) {
    const original = await this.findOne(fichaId);
    this.assertCanAccessFicha(original, user);
    if (original.type === 'oracion' && (original.encuentros?.length ?? 0) > 1) {
      throw new BadRequestException(
        'Separa primero los encuentros de esta ficha antes de clonarla.',
      );
    }
    if (!this.isGlobal(user) && user.campusId != null && String(original.campusId) !== String(user.campusId)) {
      throw new ForbiddenException('No puedes clonar fichas de otro campus');
    }
    const ref   = this.fb.db.collection(COL).doc();
    const newId = ref.id;
    const sections = JSON.parse(JSON.stringify(original.sections));

    for (const name of SECTIONS) {
      if (sections[name]) {
        sections[name].revision = 0;
        sections[name].isCompleted = false;
        sections[name].completedBy = null;
        sections[name].completedAt = null;
        sections[name].rows = (sections[name].rows ?? []).map((r: any) => ({ ...r, values: {} }));
        // Limpiar responsables solo si no se pidió conservarlos
        if (!dto.keepAssignees) {
          sections[name].assignedTo   = null;
          sections[name].assignedName = null;
        }
      }
    }

    // Generar título automático si se provee fecha
    let title = dto.title ?? `${original.title} (copia)`;
    if (!dto.title && dto.date) {
      const dateStr = formatFichaDateLabel(dto.date);
      // Usar el título base quitando cualquier "(copia)" previo
      const baseTitle = original.title.replace(/\s*\(copia\).*$/, '').trim();
      title = `${baseTitle} — ${dateStr}`;
    }

    const doc = {
      ...original,
      fichaId:          newId,
      title,
      date:             dto.date ? this.fb.ts(parseFichaDate(dto.date)) : original.date,
      sections,
      completionStatus: buildDefaultCompletion(original.type ?? 'multi'),
      status:           'draft',
      published:        false,
      publishedBy:      null,
      publishedByName:  null,
      publishedAt:      null,
      archived:         false,
      archivedBy:       null,
      archivedByName:   null,
      archivedAt:       null,
      createdBy:        user.sub,
      createdByName:    user.email,
      createdAt:        this.fb.now(),
      lastModifiedBy:   user.sub,
      lastModifiedByName: user.email,
      lastModifiedAt:   this.fb.now(),
    };
    await ref.set(doc);
    return this.findOne(newId);
  }

  async splitPrayerAndGlobal(fichaId: string, user: FichaAuthUser) {
    if (!this.isGlobal(user) && !this.has(user, 'fichas:create')) {
      throw new ForbiddenException('Necesitas permiso para crear la ficha separada');
    }

    const sourceRef = this.fb.db.collection(COL).doc(fichaId);
    const globalRef = this.fb.db.collection(COL).doc();

    await this.fb.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(sourceRef);
      if (!snap.exists) throw new NotFoundException(`Ficha ${fichaId} no encontrada`);
      const ficha = snap.data()!;
      this.assertCanManageFicha(ficha, user);

      const encuentros = ficha.encuentros ?? [];
      if (ficha.type !== 'oracion' || encuentros.length !== 2) {
        throw new BadRequestException(
          'Solo se pueden separar fichas de oración que contengan exactamente dos encuentros.',
        );
      }
      if (ficha.archived) {
        throw new BadRequestException('Desarchiva la ficha antes de separarla');
      }

      const prayerIndex = encuentros.findIndex((encuentro: any) =>
        /oraci[oó]n/i.test(String(encuentro.label ?? '')) &&
        !/global/i.test(String(encuentro.label ?? '')),
      );
      const resolvedPrayerIndex = prayerIndex >= 0 ? prayerIndex : 0;
      const prayerEncounter = encuentros[resolvedPrayerIndex];
      const globalEncounter = encuentros[resolvedPrayerIndex === 0 ? 1 : 0];

      const prayerSections = preservePrayerSections(
        ficha.sections ?? {},
        prayerEncounter.id,
      );
      const globalSections = buildGlobalSectionsFromMixedFicha(
        ficha.sections ?? {},
        globalEncounter.id,
      );
      const now = this.fb.now();

      transaction.update(sourceRef, {
        title: 'Encuentro de Oración',
        encuentros: [{ ...prayerEncounter, id: 'unico' }],
        sections: prayerSections,
        completionStatus: buildDefaultCompletion('oracion'),
        status: 'draft',
        published: false,
        publishedBy: null,
        publishedByName: null,
        publishedAt: null,
        splitInto: [globalRef.id],
        lastModifiedBy: user.sub,
        lastModifiedByName: user.email,
        lastModifiedAt: now,
      });

      transaction.set(globalRef, {
        fichaId: globalRef.id,
        campusId: ficha.campusId,
        campusName: ficha.campusName,
        type: 'unico',
        title: String(globalEncounter.label || 'Miércoles Global').replace(/\s*[·|-]\s*\d{1,2}:\d{2}.*$/i, ''),
        date: ficha.date,
        encuentros: [{ ...globalEncounter, id: 'unico' }],
        sections: globalSections,
        completionStatus: buildDefaultCompletion('unico'),
        hiddenSections: [],
        status: 'draft',
        published: false,
        createdBy: user.sub,
        createdByName: user.email,
        createdAt: now,
        lastModifiedBy: user.sub,
        lastModifiedByName: user.email,
        lastModifiedAt: now,
        archived: false,
        publishedBy: null,
        publishedByName: null,
        publishedAt: null,
        splitFrom: fichaId,
      });
    });

    return {
      prayerFicha: await this.findOne(fichaId),
      globalFicha: await this.findOne(globalRef.id),
    };
  }

  /**
   * Actualiza el bloque layoutVisual de la ficha (vista alternativa
   * accesible desde la píldora "Layout Visual"). No es una Section —
   * se guarda como campo top-level ficha.layoutVisual.
   *
   * Se sobrescribe completo con el array de songs recibido (patrón
   * "replace" simple: el frontend siempre manda el estado completo).
   */
  async updateLayoutVisual(
    fichaId: string,
    dto: UpdateLayoutVisualDto,
    user: FichaAuthUser,
  ) {
    const ref = this.fb.db.collection(COL).doc(fichaId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Ficha no encontrada');

    await ref.update({
      layoutVisual: {
        songs: dto.songs.map((s) => ({
          songRowId:          s.songRowId,
          iluminacion:        s.iluminacion ?? '',
          illuminationColors: s.illuminationColors ?? [],
          visualDescription:  s.visualDescription ?? '',
          referenceIds:       s.referenceIds ?? [],
        })),
        producerNotes: dto.producerNotes ?? '',
        updatedAt:     this.fb.now(),
        updatedBy:     user.sub,
      },
      lastModifiedBy:     user.sub,
      lastModifiedByName: user.email,
      lastModifiedAt:     this.fb.now(),
    });

    return this.findOne(fichaId);
  }

  async updateSection(
    fichaId: string,
    sectionName: string,
    dto: UpdateSectionDto,
    user: FichaAuthUser,
  ) {
    if (!SECTIONS.includes(sectionName as SectionName)) {
      throw new NotFoundException(`Sección ${sectionName} no existe`);
    }
    const { expectedRevision, ...sectionDto } = JSON.parse(JSON.stringify(dto));
    const ref = this.fb.db.collection(COL).doc(fichaId);
    await this.fb.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new NotFoundException(`Ficha ${fichaId} no encontrada`);
      const ficha = snap.data()!;
      this.assertCanManageFicha(ficha, user);
      const currentSection = ficha.sections?.[sectionName];
      if (!currentSection) {
        throw new NotFoundException(`La sección ${sectionName} no está activa en esta ficha`);
      }
      const currentRevision = Number(currentSection.revision ?? 0);
      if (expectedRevision !== undefined && Number(expectedRevision) !== currentRevision) {
        throw new ConflictException(
          'Esta sección fue modificada por otra persona. Recarga la ficha antes de continuar.',
        );
      }

      const sectionChanged = Array.isArray(sectionDto.rows);
      if (sectionChanged) {
        const incomingRows = new Map(
          sectionDto.rows.map((row: any) => [row.id, row]),
        );
        const rowIds = sectionDto.rows.map((row: any) => row.id);

        if (new Set(rowIds).size !== rowIds.length) {
          throw new BadRequestException(
            'La sección contiene filas duplicadas.',
          );
        }

        const removedRequiredRow = (currentSection.rows ?? []).find(
          (row: any) =>
            row.required &&
            (!incomingRows.has(row.id) ||
              (incomingRows.get(row.id) as any)?.required !== true),
        );

        if (removedRequiredRow) {
          throw new BadRequestException(
            `La fila obligatoria "${removedRequiredRow.label}" no se puede eliminar ni convertir en opcional.`,
          );
        }
      }

      const nextCompletion = {
        ...(ficha.completionStatus ?? {}),
        ...(sectionChanged ? { [sectionName]: false } : {}),
      };
      const update: any = {
        [`sections.${sectionName}`]: {
          ...currentSection,
          ...sectionDto,
          revision: currentRevision + 1,
          ...(sectionChanged ? {
            isCompleted: false,
            completedBy: null,
            completedAt: null,
          } : {}),
        },
        ...(sectionChanged ? {
          [`completionStatus.${sectionName}`]: false,
          status: deriveFichaStatus(ficha.type, nextCompletion, ficha.hiddenSections ?? []),
        } : {}),
        lastModifiedBy:     user.sub,
        lastModifiedByName: user.email,
        lastModifiedAt:     this.fb.now(),
      };
      transaction.update(ref, update);
    });

    await this.fb.db.collection(COL).doc(fichaId).collection('changelog').add({
      userId:    user.sub,
      userName:  user.email,
      timestamp: this.fb.now(),
      seccion:   sectionName,
      cambios:   sectionDto.rows
        ? { fields: ['rows'], rowCount: sectionDto.rows.length }
        : sectionDto,
    });

    return this.findOne(fichaId);
  }

  async completeSection(
    fichaId: string,
    sectionName: string,
    user: FichaAuthUser,
  ) {
    if (!SECTIONS.includes(sectionName as SectionName)) {
      throw new NotFoundException(`Sección ${sectionName} no existe`);
    }
    const ref = this.fb.db.collection(COL).doc(fichaId);
    await this.fb.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new NotFoundException(`Ficha ${fichaId} no encontrada`);
      const ficha = snap.data()!;
      this.assertCanManageFicha(ficha, user);
      const section = ficha.sections?.[sectionName];
      if (!section) {
        throw new NotFoundException(`La sección ${sectionName} no está activa en esta ficha`);
      }
      const missing = missingRequiredRows(
        section.rows ?? [],
        (ficha.encuentros ?? []).map((encuentro: any) => encuentro.id),
      );
      if (missing.length > 0) {
        throw new BadRequestException(`Completa los campos obligatorios: ${missing.join(', ')}`);
      }
      const nextCompletion = {
        ...(ficha.completionStatus ?? {}),
        [sectionName]: true,
      };
      transaction.update(ref, {
        [`sections.${sectionName}.isCompleted`]: true,
        [`sections.${sectionName}.completedBy`]: user.sub,
        [`sections.${sectionName}.completedAt`]: this.fb.now(),
        [`completionStatus.${sectionName}`]: true,
        status: deriveFichaStatus(ficha.type, nextCompletion, ficha.hiddenSections ?? []),
        lastModifiedBy: user.sub,
        lastModifiedByName: user.email,
        lastModifiedAt: this.fb.now(),
      });
    });
    return this.findOne(fichaId);
  }

  async reopenSection(fichaId: string, sectionName: string, user: FichaAuthUser) {
    const ref = this.fb.db.collection(COL).doc(fichaId);
    await this.fb.db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new NotFoundException(`Ficha ${fichaId} no encontrada`);
      const ficha = snap.data()!;
      this.assertCanManageFicha(ficha, user);
      if (!activeSectionsForType(ficha.type).includes(sectionName as SectionName)) {
        throw new NotFoundException(`La sección ${sectionName} no está activa en esta ficha`);
      }
      const nextCompletion = {
        ...(ficha.completionStatus ?? {}),
        [sectionName]: false,
      };
      transaction.update(ref, {
        [`sections.${sectionName}.isCompleted`]: false,
        [`sections.${sectionName}.completedBy`]: null,
        [`sections.${sectionName}.completedAt`]: null,
        [`completionStatus.${sectionName}`]: false,
        status: deriveFichaStatus(ficha.type, nextCompletion, ficha.hiddenSections ?? []),
        lastModifiedBy: user.sub,
        lastModifiedByName: user.email,
        lastModifiedAt: this.fb.now(),
      });
    });
    return this.findOne(fichaId);
  }

  async archive(fichaId: string, user: FichaAuthUser) {
    const ficha = await this.findOne(fichaId);
    this.assertCanManageFicha(ficha, user);
    await this.fb.db.collection(COL).doc(fichaId).update({
      archived:           true,
      archivedBy:         user.sub,
      archivedByName:     user.email,
      archivedAt:         this.fb.now(),
      published:          false,
      publishedBy:        null,
      publishedByName:    null,
      publishedAt:        null,
      lastModifiedBy:     user.sub,
      lastModifiedByName: user.email,
      lastModifiedAt:     this.fb.now(),
    });
    return this.findOne(fichaId);
  }

  async unarchive(fichaId: string, user: FichaAuthUser) {
    const ficha = await this.findOne(fichaId);
    this.assertCanManageFicha(ficha, user);
    await this.fb.db.collection(COL).doc(fichaId).update({
      archived:           false,
      archivedBy:         null,
      archivedByName:     null,
      archivedAt:         null,
      lastModifiedBy:     user.sub,
      lastModifiedByName: user.email,
      lastModifiedAt:     this.fb.now(),
    });
    return this.findOne(fichaId);
  }

  async publish(fichaId: string, user: FichaAuthUser) {
    const ficha = await this.findOne(fichaId);
    this.assertCanPublishFicha(ficha, user);
    if (ficha.archived) throw new BadRequestException('Desarchiva la ficha antes de publicarla');
    await this.fb.db.collection(COL).doc(fichaId).update({
      published:        true,
      publishedBy:      user.sub,
      publishedByName:  user.email,
      publishedAt:      this.fb.now(),
      lastModifiedBy:     user.sub,
      lastModifiedByName: user.email,
      lastModifiedAt:     this.fb.now(),
    });
    return this.findOne(fichaId);
  }

  async unpublish(fichaId: string, user: FichaAuthUser) {
    const ficha = await this.findOne(fichaId);
    this.assertCanPublishFicha(ficha, user);
    await this.fb.db.collection(COL).doc(fichaId).update({
      published:        false,
      publishedBy:      null,
      publishedByName:  null,
      publishedAt:      null,
      lastModifiedBy:     user.sub,
      lastModifiedByName: user.email,
      lastModifiedAt:     this.fb.now(),
    });
    return this.findOne(fichaId);
  }

  async getChangelog(fichaId: string, user: FichaAuthUser) {
    const ficha = await this.findOne(fichaId);
    this.assertCanAccessFicha(ficha, user);
    const snap = await this.fb.db
      .collection(COL).doc(fichaId)
      .collection('changelog').orderBy('timestamp', 'desc').limit(100).get();
    return this.fb.toDocs(snap);
  }
}
