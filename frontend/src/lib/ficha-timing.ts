// Timing estructurado de la ficha (Horarios): cada momento guarda, por
// encuentro, un JSON con inicio, término, tipo, responsable, indicaciones y un
// vínculo opcional a una noticia (Info Encuentro) o canción (Set List).
// Los horarios antiguos (hora suelta o rangos escritos dentro del nombre) se
// leen igual y pasan al formato nuevo la primera vez que se editan.

import type { Row } from '@/types/ficha';

export type MomentKind = 'momento' | 'worship' | 'predicacion' | 'noticia' | 'video' | 'transicion' | 'oracion';

export const MOMENT_KINDS: { kind: MomentKind; label: string; color: string }[] = [
  { kind: 'momento',     label: 'Momento',     color: '#526078' },
  { kind: 'worship',     label: 'Worship',     color: '#6554C0' },
  { kind: 'predicacion', label: 'Predicación', color: '#D4890A' },
  { kind: 'noticia',     label: 'Noticia',     color: '#0B7A75' },
  { kind: 'video',       label: 'Video',       color: '#C2410C' },
  { kind: 'transicion',  label: 'Transición',  color: '#69768B' },
  { kind: 'oracion',     label: 'Oración',     color: '#087F5B' },
];

export interface MomentLink { seccion: 'anuncios' | 'setList'; rowId: string }

export interface MomentValue {
  inicio?: string;
  fin?: string;
  tipo?: MomentKind;
  responsable?: string;
  nota?: string;
  enlace?: MomentLink;
}

export interface ParsedMoment {
  row: Row;
  label: string;
  value: MomentValue;
  /** El valor todavía está en el formato antiguo (texto). */
  legacy: boolean;
}

const TIME = /(\d{1,2})[:.](\d{2})/;
const RANGE = /(\d{1,2}[:.]\d{2})\s*(?:[-–]|a)\s*(\d{1,2}[:.]\d{2})/;
const ONLY_TIME = /^\s*\d{1,2}[:.]\d{2}(?:\s*(?:[-–]|a)\s*\d{1,2}[:.]\d{2})?\s*(?:hrs?\.?)?\s*$/i;

export function normalizeTime(text?: string | null): string | undefined {
  const m = TIME.exec(text ?? '');
  if (!m) return undefined;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function toMinutes(time?: string): number | null {
  const t = normalizeTime(time);
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function durationMinutes(v: MomentValue): number | null {
  const a = toMinutes(v.inicio), b = toMinutes(v.fin);
  if (a == null || b == null) return null;
  return b >= a ? b - a : b + 1440 - a;
}

/** Cambia la duración moviendo el término (el inicio queda fijo). */
export function withDuration(v: MomentValue, minutes: number | null): MomentValue {
  const a = toMinutes(v.inicio);
  if (a == null || minutes == null || !Number.isFinite(minutes) || minutes < 0) return { ...v, fin: minutes == null ? undefined : v.fin };
  return { ...v, fin: fromMinutes(a + Math.round(minutes)) };
}

export function guessKind(label: string): MomentKind {
  const l = label.toLowerCase();
  if (/worship|vio\b|arw|alabanza|canci/.test(l)) return 'worship';
  if (/predica|mensaje/.test(l)) return 'predicacion';
  if (/noticia|anuncio|bienvenida|despedida|info/.test(l)) return 'noticia';
  if (/video|countdown|cart[oó]n|clip/.test(l)) return 'video';
  if (/oraci[oó]n|respuesta/.test(l)) return 'oracion';
  if (/transici|ingreso|salida|cambio/.test(l)) return 'transicion';
  return 'momento';
}

/** Quita del nombre los rangos y duraciones escritos a mano: "Worship (17 min) | 20:00 - 20:17" → "Worship". */
export function cleanLabel(label: string): string {
  return label
    .replace(/^\s*\d{1,2}[:.]\d{2}(?:\s*(?:[-–]|a)\s*\d{1,2}[:.]\d{2})?\s*[—–\-|:]?\s*/, '')
    .replace(/\|?\s*\d{1,2}[:.]\d{2}\s*(?:[-–]|a)\s*\d{1,2}[:.]\d{2}/g, '')
    .replace(/\(\s*\d+\s*min\.?\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s|—–-]+$/, '')
    .trim() || label.trim();
}

function rawCell(row: Row, colId: string): string {
  return (row.shared ? (row.values?.shared ?? row.values?.[colId]) : row.values?.[colId]) ?? '';
}

function parseJson(raw: string): MomentValue | null {
  if (!raw.trim().startsWith('{')) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' && !('titulo' in v) ? v as MomentValue : null;
  } catch { return null; }
}

export function parseMoment(row: Row, colId: string): ParsedMoment {
  const raw = rawCell(row, colId);
  const json = parseJson(raw);
  if (json) return { row, label: cleanLabel(row.label), value: json, legacy: false };

  const value: MomentValue = {};
  const text = raw.trim();
  if (text && ONLY_TIME.test(text)) {
    const r = RANGE.exec(text);
    value.inicio = normalizeTime(r?.[1] ?? text);
    if (r) value.fin = normalizeTime(r[2]);
  } else if (text) {
    if (row.type === 'person') value.responsable = text; else value.nota = text;
  }
  const range = RANGE.exec(row.label);
  if (!value.inicio && range) { value.inicio = normalizeTime(range[1]); value.fin = normalizeTime(range[2]); }
  if (!value.inicio) value.inicio = normalizeTime(row.label);
  const minutes = /\(\s*(\d+)\s*min/i.exec(row.label);
  if (minutes && value.inicio && !value.fin) Object.assign(value, withDuration(value, Number(minutes[1])));
  const label = cleanLabel(row.label);
  value.tipo = guessKind(label);
  return { row, label, value, legacy: true };
}

export function encodeMoment(v: MomentValue): string {
  const clean: MomentValue = {};
  if (v.inicio) clean.inicio = normalizeTime(v.inicio);
  if (v.fin) clean.fin = normalizeTime(v.fin);
  if (v.tipo && v.tipo !== 'momento') clean.tipo = v.tipo;
  if (v.responsable?.trim()) clean.responsable = v.responsable;
  if (v.nota?.trim()) clean.nota = v.nota;
  if (v.enlace?.rowId) clean.enlace = v.enlace;
  return Object.keys(clean).length ? JSON.stringify(clean) : '';
}

export function hasContent(v: MomentValue) {
  return !!(v.inicio || v.fin || v.responsable || v.nota || v.enlace);
}

export interface MomentNode extends ParsedMoment { children: ParsedMoment[] }

/**
 * Momentos principales con sus sub-momentos. Ordenados por inicio cuando
 * `byTime`; si no, se respeta el orden manual (mientras se edita).
 */
export function momentTree(rows: Row[], colId: string, byTime: boolean): MomentNode[] {
  const parsed = [...rows].sort((a, b) => a.order - b.order).map((r) => parseMoment(r, colId));
  const ids = new Set(parsed.map((p) => p.row.id));
  const sort = (list: ParsedMoment[]) => byTime
    ? [...list].sort((a, b) => (toMinutes(a.value.inicio) ?? 1e6) - (toMinutes(b.value.inicio) ?? 1e6))
    : list;
  const roots = parsed.filter((p) => !p.row.parentId || !ids.has(p.row.parentId) || p.row.parentId === p.row.id);
  return sort(roots).map((r) => ({ ...r, children: sort(parsed.filter((p) => p.row.parentId === r.row.id && p !== r)) }));
}

export function kindInfo(kind?: MomentKind) {
  return MOMENT_KINDS.find((k) => k.kind === kind) ?? MOMENT_KINDS[0];
}

export function formatRange(v: MomentValue): string {
  if (!v.inicio) return '';
  return v.fin ? `${v.inicio}–${v.fin}` : v.inicio;
}
