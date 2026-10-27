export type FichaType   = 'unico' | 'multi' | 'oracion';
export type FichaStatus = 'draft' | 'in_progress' | 'complete';

export interface Encuentro {
  id:     string;    // 'e1' | 'e2' | 'e3' | 'unico'
  label:  string;    // "11:00 (EN VIVO)"
  time:   string;    // "11:00"
  isLive: boolean;
  color:  string;
}

export type SectionName =
  | 'pastoral'
  | 'produccion'
  | 'media'
  | 'streaming'
  | 'escena'        // AR Worship / Banda
  | 'setList'
  | 'horarios'
  | 'anuncios'      // Info Encuentro
  | 'voluntarios'
  | 'outfit';       // Paleta de Colores / Vestimenta

export const SECTION_LABELS: Record<SectionName, string> = {
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

export interface FichaPerson { userId?: number; name: string }
export interface FichaEquipo { encargadoTecnico?: FichaPerson | null; responsableActualizacion?: FichaPerson | null }
export type FichaRole = 'productor' | 'editor' | 'encargado' | 'responsable' | 'area' | 'visuales' | 'lector';
export interface FichaPermisos {
  rol: FichaRole;
  view: boolean;
  structure: boolean;
  content: boolean;
  sections: SectionName[];
  layoutVisual: boolean;
  publish: boolean;
  designateEncargado: boolean;
  designateResponsable: boolean;
}

export const FICHA_ROLE_LABELS: Record<FichaRole, string> = {
  productor:   'Productor General',
  editor:      'Editor de fichas del campus',
  encargado:   'Encargado Técnico de la ficha',
  responsable: 'Responsable de Actualización',
  area:        'Responsable de área',
  visuales:    'Responsable global de visuales',
  lector:      'Consulta',
};

export interface RowAssignment {
  mode: 'people' | 'pending' | 'fixed' | 'sequence' | 'not_applicable' | 'team';
  people: { userId: number; name: string }[];
  note: string;
}
export type AssignmentEdit = { assignment: RowAssignment; scope: 'current' | 'block' | 'all'; encounterId: string };

export interface Row {
  assignments?: Record<string, RowAssignment>;
  id:       string;
  label:    string;
  type:     'text' | 'person' | 'song';
  shared:   boolean;
  values:   Record<string, string>;  // { e1: 'nombre', unico: 'valor' }
  order:    number;
  required: boolean;
  /** Horarios: momento principal del que este es un sub-momento. */
  parentId?: string | null;
}

export interface Section {
  revision?:     number;
  assignedTo:   number | null;
  assignedName: string | null;
  isCompleted:  boolean;
  completedBy:  number | null;
  completedAt:  any | null;
  rows:         Row[];
}

export type CompletionStatus = Record<SectionName, boolean>;

/**
 * Vista alternativa de la ficha: una tabla por canción con iluminación,
 * descripción de visuales y referencias visuales (imágenes del catálogo).
 * Se persiste como campo top-level de la ficha, NO como Section.
 */
export interface LayoutVisualSong {
  /** Coincide con el row.id de sections.setList.rows para auto-sync. */
  songRowId:          string;
  iluminacion:        string;
  /** Swatches hex (#RRGGBB) que representan la paleta de luces. */
  illuminationColors?: string[];
  visualDescription:  string;
  /** IDs de refs del catálogo (visual_references). */
  referenceIds:       number[];
}

/**
 * Un "slot" del layout visual. Para fichas de 1 encuentro (unico/oracion)
 * hay un único slot con id='default'. Para fichas multi-encuentro se
 * derivan 2 slots por hora: 'am' (encuentros con time < 15:00) y 'pm'
 * (encuentros con time >= 15:00). Cada slot tiene su propia tabla de
 * canciones y sus notas.
 */
export interface LayoutVisualSlot {
  /** 'default' | 'am' | 'pm' — identificador del slot. */
  id:             string;
  /** Etiqueta legible ('' | 'AM' | 'PM'). */
  label:          string;
  /** IDs de encuentros que este slot cubre. */
  encuentroIds:   string[];
  songs:          LayoutVisualSong[];
  /** Notas del productor en HTML (TipTap). Vacío o ausente si no editó. */
  producerNotes?: string;
}

export interface LayoutVisual {
  /** Forma actual: arreglo de slots. Los readers deben usar `slots` cuando
   *  esté disponible. Los writers backend normalizan la forma antigua a
   *  slots automáticamente. */
  slots?:         LayoutVisualSlot[];
  /** Forma legacy (fichas creadas antes del split AM/PM). Solo se usa
   *  como fallback cuando `slots` no existe. */
  songs?:         LayoutVisualSong[];
  producerNotes?: string;
  updatedAt?:     any;
  updatedBy?:     number;
}

export interface Ficha {
  fichaId:          string;
  campusId:         string;
  campusName:       string;
  type:             FichaType;
  title:            string;
  date:             any;           // Firestore Timestamp
  encuentros:       Encuentro[];
  sections:         Record<SectionName, Section>;
  completionStatus: CompletionStatus;
  status:           FichaStatus;
  createdBy:          number;
  createdByName:      string;
  createdAt:          any;
  lastModifiedBy:     number;
  lastModifiedByName?: string;
  lastModifiedAt:     any;
  archived?:          boolean;
  archivedBy?:        number | null;
  archivedByName?:    string | null;
  archivedAt?:        any | null;
  published?:         boolean;
  publishedBy?:       number | null;
  publishedByName?:   string | null;
  publishedAt?:       any | null;
  hiddenSections?:    SectionName[];
  sectionLayout?:     { left: string[]; right: string[]; leftRatio?: number };
  layoutVisual?:      LayoutVisual;
  /** Quién responde por la ficha y quién la actualiza (Etapa 4). */
  equipo?:            FichaEquipo;
  /** Lo que el usuario actual puede hacer en esta ficha (lo calcula la API). */
  permisos?:          FichaPermisos;
  /** Solo presente en respuestas de /fichas/public/:id — permite al cliente
   *  público resolver IDs de paletas y visual references sin llamar
   *  endpoints privados. */
  publicMeta?: {
    paletas:    any[];
    visualRefs: any[];
  };
}

export interface FichaListItem {
  fichaId:          string;
  campusId:         string;
  campusName:       string;
  type:             FichaType;
  title:            string;
  date:             any;
  status:           FichaStatus;
  completionStatus: CompletionStatus;
  archived?:          boolean;
  published?:         boolean;
  createdBy?:         number;
  hiddenSections?:    SectionName[];
}

export type CreateFichaPayload = {
  template?: 'standard' | 'santiago' | 'legacy';
  campusId:    string;
  campusName:  string;
  type:        FichaType;
  title:       string;
  date:        string;
  encuentros:  Encuentro[];
  descripcion?: string;
  ubicacion?:   string;
};

// ── Canción ───────────────────────────────────────────────────────────────────

export interface Cancion {
  cancionId:   string;
  titulo:      string;
  tonalidad:   string;   // G, D, C, A, B, E, F, ...
  tipo?:       string;   // 'Rápidas' | 'Lentas'
  bpm?:        number;
  compas?:     string;   // '4/4' | '6/8' | '12/8'
  usageCount:  number;
  createdAt:   any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function completionPercent(status: CompletionStatus, hidden: SectionName[] = []): number {
  const keys = (Object.keys(status) as SectionName[]).filter(k => !hidden.includes(k));
  if (!keys.length) return 0;
  const done = keys.filter(k => status[k]).length;
  return Math.round((done / keys.length) * 100);
}

export function statusColor(status: FichaStatus) {
  if (status === 'complete')    return { bg: 'rgba(29,158,117,0.12)', text: '#1D9E75' };
  if (status === 'in_progress') return { bg: 'rgba(127,119,221,0.12)', text: '#7F77DD' };
  return { bg: 'rgba(0,0,0,0.05)', text: 'rgba(0,0,0,0.3)' };
}

export function statusLabel(status: FichaStatus) {
  if (status === 'complete')    return 'Completa';
  if (status === 'in_progress') return 'En progreso';
  return 'Borrador';
}
