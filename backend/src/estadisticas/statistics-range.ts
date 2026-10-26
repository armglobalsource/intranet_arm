import { BadRequestException } from '@nestjs/common';

export const isoDay = (date: Date) => date.toISOString().slice(0, 10);
export function shiftDay(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDay(date);
}
export function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && isoDay(date) === value;
}
export function statisticsRange(year: number, from?: string, to?: string, history = false, now = new Date()) {
  if (history) {
    if (from || to) throw new BadRequestException('El histórico calcula sus fechas automáticamente.');
    const start = '2020-01-01';
    const end = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
    return { start, end, days, previousStart: start, previousEnd: '2019-12-31' };
  }
  const start = from ?? `${year}-01-01`, end = to ?? `${year}-12-31`;
  if (!!from !== !!to || !validDay(start) || !validDay(end) || start > end || start < '2000-01-01' || end > '2100-12-31') {
    throw new BadRequestException('Selecciona un rango de fechas válido (2000–2100).');
  }
  const days = (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000 + 1;
  if (days > 366) throw new BadRequestException('El rango no puede superar 366 días.');
  return { start, end, days, previousStart: shiftDay(start, -days), previousEnd: shiftDay(start, -1) };
}

export function countryName(value?: string | null) {
  const name = (value ?? '').trim().replace(/\s+/g, ' ');
  const aliases: Record<string, string> = { cl: 'Chile', chile: 'Chile', ar: 'Argentina', argentina: 'Argentina', uy: 'Uruguay', uruguay: 'Uruguay', ve: 'Venezuela', venezuela: 'Venezuela', us: 'Estados Unidos', usa: 'Estados Unidos', 'ee.uu.': 'Estados Unidos', 'estados unidos': 'Estados Unidos', 'united states': 'Estados Unidos' };
  return aliases[name.toLowerCase()] ?? (name || 'Sin país asignado');
}
