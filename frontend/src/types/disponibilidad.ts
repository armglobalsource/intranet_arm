export interface EncounterSlot {
  scheduleKey:   string;
  dia:           string;
  hora:          string;   // puede ser "09:00 · 11:00" cuando hay bloque
  bloque?:       string;   // e.g. "AM", "PM"
  encounterDate: string;
  fichaType?:    string;
}

export interface DisponibilidadDoc {
  id:            number;
  userId:        number;
  userName:      string;
  campusId:      number;
  campusName:    string;
  weekLabel:     string;
  scheduleKey:   string;
  encounterDate: string;
  dia:           string;
  hora:          string;
  bloque?:       string | null;
  available:     boolean;
  nota:          string | null;
}

export interface MatrixVolunteer {
  userId:   number;
  userName: string;
  slots:    Record<string, { available: boolean; nota: string | null }>;
}

export interface MatrixResult {
  encounters: EncounterSlot[];
  volunteers: MatrixVolunteer[];
}

export interface SlotSubmit {
  scheduleKey: string;
  available:   boolean;
  nota?:       string;
}

export interface BulkSubmitPayload {
  campusId:  number;
  weekLabel: string;
  slots:     SlotSubmit[];
}

export type RosterStatus   = 'disponible' | 'no_disponible' | 'sin_responder';
export type RosterCategory = 'worship' | 'tecnico' | 'ninguno';

export interface RosterPerson {
  userId:    number;
  userName:  string;
  avatarUrl: string | null;
  status:    RosterStatus;
}

export interface RosterResult {
  worship: RosterPerson[];
  tecnico: RosterPerson[];
  ninguno: RosterPerson[];
}

/** Devuelve el label ISO "YYYY-Www" de la semana que contiene la fecha dada */
export function toWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Desplaza un weekLabel n semanas */
export function shiftWeek(weekLabel: string, delta: number): string {
  const match = weekLabel.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekLabel;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow  = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (dow - 1) * 86400000 + (week - 1) * 7 * 86400000);
  monday.setUTCDate(monday.getUTCDate() + delta * 7);
  return toWeekLabel(monday);
}

/** Formatea un weekLabel como "Semana del DD MMM" */
export function formatWeekLabel(weekLabel: string): string {
  const match = weekLabel.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekLabel;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow  = jan4.getUTCDay() || 7;
  const monday = new Date(jan4.getTime() - (dow - 1) * 86400000 + (week - 1) * 7 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}
