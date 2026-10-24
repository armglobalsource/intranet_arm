// Vista comparativa de una ficha: cada fila de cada sección con su valor en
// cada encuentro, para ver de un vistazo qué es igual en todos, qué cambia y
// qué está compartido. También define cómo pasar una fila de "compartida" a
// "por encuentro" y al revés.

import type { Encuentro, Row, SectionName } from '@/types/ficha';
import { formatRange, parseMoment } from './ficha-timing';

export interface CompareCell { encuentroId: string; text: string }

export interface CompareRow {
  row: Row;
  label: string;
  shared: boolean;
  /** Valor compartido (cuando la fila es compartida). */
  sharedText: string;
  cells: CompareCell[];
  /** Algún encuentro tiene un valor distinto al resto. */
  differs: boolean;
  empty: boolean;
}

function songText(raw: string): string {
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && 'titulo' in v) {
      return [v.titulo, v.tonalidad && `(${v.tonalidad})`, v.cantante && `· ${v.cantante}`].filter(Boolean).join(' ');
    }
  } catch { /* texto plano */ }
  return raw;
}

/** Texto legible del valor de una fila en un encuentro. */
export function cellText(section: SectionName, row: Row, encuentroId: string, paletteName?: (id: string) => string | undefined): string {
  const raw = (row.shared ? (row.values?.shared ?? row.values?.[encuentroId]) : row.values?.[encuentroId]) ?? '';
  if (!raw.trim()) return '';
  if (section === 'horarios') {
    const { value } = parseMoment(row, encuentroId);
    return [formatRange(value), value.responsable, value.nota].filter(Boolean).join(' · ');
  }
  if (section === 'setList') return songText(raw).trim();
  if (section === 'outfit') return paletteName?.(raw) ?? raw;
  return raw.trim();
}

export function compareRows(section: SectionName, rows: Row[], encuentros: Encuentro[], paletteName?: (id: string) => string | undefined): CompareRow[] {
  return [...rows].sort((a, b) => a.order - b.order).map((row) => {
    const cells = encuentros.map((e) => ({ encuentroId: e.id, text: row.shared ? '' : cellText(section, row, e.id, paletteName) }));
    const sharedText = row.shared ? cellText(section, row, encuentros[0]?.id ?? 'unico', paletteName) : '';
    const distinct = new Set(cells.map((c) => c.text));
    const label = section === 'horarios' ? parseMoment(row, encuentros[0]?.id ?? 'unico').label : row.label;
    return {
      row, label, shared: !!row.shared, sharedText, cells,
      differs: !row.shared && distinct.size > 1,
      empty: row.shared ? !sharedText : cells.every((c) => !c.text),
    };
  });
}

/**
 * Valores de la fila al compartirla: se usa el valor de `preferId` o, si está
 * vacío, el primero con contenido. Devuelve también si había valores distintos
 * que se perderán.
 */
export function shareValues(row: Row, encuentros: Encuentro[], preferId?: string) {
  const ids = encuentros.map((e) => e.id);
  const order = preferId ? [preferId, ...ids.filter((id) => id !== preferId)] : ids;
  const keep = order.map((id) => row.values?.[id] ?? '').find((v) => v.trim()) ?? '';
  const distinct = new Set(ids.map((id) => (row.values?.[id] ?? '').trim()).filter(Boolean));
  const values: Record<string, string> = keep ? { shared: keep } : {};
  return { values, conflict: distinct.size > 1, kept: keep };
}

/** Valores de la fila al separarla: cada encuentro parte con el valor compartido. */
export function splitValues(row: Row, encuentros: Encuentro[]): Record<string, string> {
  const value = row.values?.shared ?? '';
  return value.trim() ? Object.fromEntries(encuentros.map((e) => [e.id, value])) : {};
}
