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
  | 'streaming'
  | 'escena'        // AR Worship / Banda
  | 'setList'
  | 'horarios'
  | 'anuncios'      // Info Encuentro
  | 'voluntarios';

export const SECTION_LABELS: Record<SectionName, string> = {
  pastoral:    'Equipo Pastoral',
  produccion:  'Producción',
  streaming:   'Streaming',
  escena:      'AR Worship / Banda',
  setList:     'Set List',
  horarios:    'Horarios',
  anuncios:    'Info Encuentro',
  voluntarios: 'Voluntarios de Servicio',
};

export interface Row {
  id:       string;
  label:    string;
  type:     'text' | 'person' | 'song';
  shared:   boolean;
  values:   Record<string, string>;  // { e1: 'nombre', unico: 'valor' }
  order:    number;
  required: boolean;
}

export interface Section {
  assignedTo:   number | null;
  assignedName: string | null;
  isCompleted:  boolean;
  completedBy:  number | null;
  completedAt:  any | null;
  rows:         Row[];
}

export type CompletionStatus = Record<SectionName, boolean>;

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
  createdBy:        number;
  createdByName:    string;
  createdAt:        any;
  lastModifiedBy:   number;
  lastModifiedAt:   any;
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
}

export type CreateFichaPayload = {
  campusId:   string;
  campusName: string;
  type:       FichaType;
  title:      string;
  date:       string;
  encuentros: Encuentro[];
};

// ── Canción ───────────────────────────────────────────────────────────────────

export interface Cancion {
  cancionId:   string;
  titulo:      string;
  tonalidad:   string;   // G, D, C, A, B, E, F, ...
  usageCount:  number;
  createdAt:   any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function completionPercent(status: CompletionStatus): number {
  const keys = Object.keys(status) as SectionName[];
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
