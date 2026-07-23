/**
 * Normaliza la fecha civil de una ficha. Las fichas históricas se guardaron a
 * medianoche UTC, lo que las hacía aparecer el día anterior en Chile.
 */
export function parseFichaDate(raw: any): Date {
  if (!raw) return new Date(Number.NaN);
  if (typeof raw?.toDate === 'function') return normalizeTimestamp(raw.toDate());
  if (raw instanceof Date) return normalizeTimestamp(raw);
  if (raw?.seconds) return normalizeTimestamp(new Date(raw.seconds * 1000));
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  return normalizeTimestamp(new Date(raw));
}

function normalizeTimestamp(date: Date): Date {
  if (Number.isNaN(date.getTime())) return date;
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0
  ) {
    return new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      12,
      0,
      0,
    );
  }
  return date;
}

export function toFichaInputDate(raw: any): string {
  const date = parseFichaDate(raw);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
