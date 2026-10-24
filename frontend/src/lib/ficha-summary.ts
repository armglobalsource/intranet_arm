// Lógica de la primera vista de una ficha (lectura en 15 segundos) y de su
// historial de cambios. Sin React: se prueba aparte.

import type { Row, SectionName } from '@/types/ficha';
import { formatRange, parseMoment, toMinutes } from './ficha-timing';

export interface TimingMoment {
  id: string;
  label: string;
  time: string;
  minutes: number;
  main: boolean;
}

export interface FichaChange {
  document_id: string;
  seccion: string | null;
  userName: string | null;
  timestamp: string;
  cambios: any;
}

/** Minutos desde medianoche de la primera hora "HH:MM" del texto. */
export function parseClock(text: string | undefined | null): number | null {
  const m = /(\d{1,2})[:.](\d{2})/.exec(text ?? '');
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

const MAIN_MOMENT = /worship|vio|predicaci[oó]n|inicio|respuesta|siembra|despedida|bienvenida/i;

/**
 * Momentos principales del timing para un encuentro, ordenados por hora (los
 * sub-momentos quedan fuera). Lee el formato estructurado y el antiguo.
 */
export function timingFor(rows: Row[], colId: string): TimingMoment[] {
  const ids = new Set(rows.map((r) => r.id));
  return rows
    .filter((row) => !row.parentId || !ids.has(row.parentId))
    .map((row) => {
      const { label, value } = parseMoment(row, colId);
      const minutes = toMinutes(value.inicio);
      if (minutes == null) return null;
      const main = (value.tipo && value.tipo !== 'momento' && value.tipo !== 'transicion') || MAIN_MOMENT.test(label);
      return { id: row.id, label, time: formatRange(value), minutes, main };
    })
    .filter((m): m is TimingMoment => m !== null)
    .sort((a, b) => a.minutes - b.minutes);
}

/** Momento en curso y siguiente, para el día del encuentro. */
export function nowAndNext(moments: TimingMoment[], nowMinutes: number) {
  let current: TimingMoment | null = null, next: TimingMoment | null = null;
  for (const m of moments) {
    if (m.minutes <= nowMinutes) current = m;
    else { next = m; break; }
  }
  return { current, next };
}

export function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function relativeTime(value: string | Date | null | undefined, now = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  const diff = Math.max(0, now.getTime() - date.getTime()) / 60000;
  if (diff < 1) return 'hace un momento';
  if (diff < 60) return `hace ${Math.round(diff)} min`;
  if (diff < 24 * 60) return `hace ${Math.round(diff / 60)} h`;
  const days = Math.round(diff / (24 * 60));
  if (days < 7) return days === 1 ? 'ayer' : `hace ${days} días`;
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

/** Cambios de las últimas horas: se destacan en la agenda y en la ficha. */
export function isRecent(value: string | Date | null | undefined, hours = 48, now = new Date()) {
  if (!value) return false;
  return now.getTime() - new Date(value).getTime() < hours * 3600 * 1000;
}

const KIND_TEXT: Record<string, string> = {
  complete: 'marcó como completa', reopen: 'reabrió', layout: 'cambió el orden de las secciones',
  layoutVisual: 'actualizó el Layout Visual', publish: 'publicó la ficha', unpublish: 'despublicó la ficha',
  archive: 'archivó la ficha', unarchive: 'desarchivó la ficha',
};

function quote(text: string | null | undefined) { return text ? `«${text}»` : 'vacío'; }

/** Frases legibles de una entrada del historial. */
export function describeChange(entry: FichaChange, sectionLabels: Partial<Record<SectionName, string>>): { title: string; details: string[] } {
  const c = entry.cambios ?? {};
  const section = entry.seccion ? (sectionLabels[entry.seccion as SectionName] ?? entry.seccion) : null;
  switch (c.kind) {
    case 'rows': {
      const details = (c.changes ?? []).map((ch: any) => {
        const where = ch.encuentro ? ` (${ch.encuentro})` : '';
        if (ch.kind === 'added') return `Agregó la fila ${quote(ch.label)}`;
        if (ch.kind === 'removed') return `Quitó la fila ${quote(ch.label)}`;
        if (ch.kind === 'renamed') return `Renombró ${quote(ch.before)} a ${quote(ch.after)}`;
        return `${ch.label}${where}: ${quote(ch.before)} → ${quote(ch.after)}`;
      });
      if (c.truncated) details.push('…y otros cambios');
      return { title: `Editó ${section ?? 'la ficha'}`, details };
    }
    case 'assign':
      return { title: `Cambió el responsable de ${section}`, details: [`${quote(c.before)} → ${quote(c.after)}`] };
    case 'title':
      return { title: 'Cambió el título', details: [`${quote(c.before)} → ${quote(c.after)}`] };
    case 'date':
      return { title: 'Cambió la fecha', details: [`${c.before ?? '—'} → ${c.after ?? '—'}`] };
    case 'modules': {
      const label = (n: string) => sectionLabels[n as SectionName] ?? n;
      const details = [
        ...(c.shown ?? []).map((n: string) => `Mostró ${label(n)}`),
        ...(c.hidden ?? []).map((n: string) => `Ocultó ${label(n)}`),
      ];
      return { title: 'Cambió los módulos visibles', details };
    }
    case 'complete':
      return { title: `Marcó ${section} como completa`, details: [] };
    case 'reopen':
      return { title: `Reabrió ${section}`, details: [] };
    default:
      if (KIND_TEXT[c.kind]) return { title: KIND_TEXT[c.kind][0].toUpperCase() + KIND_TEXT[c.kind].slice(1), details: [] };
      // Registros anteriores al historial detallado solo sabían la sección.
      return { title: section ? `Editó ${section}` : 'Editó la ficha', details: [] };
  }
}
