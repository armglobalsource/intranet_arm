export type StatsPreset = 'week' | 'month' | 'year' | 'custom';
const key = (d: Date) => d.toISOString().slice(0, 10);
export function statsPreset(preset: Exclude<StatsPreset, 'custom'>, now = new Date()) {
  // A single business date for cross-campus reporting, independent of Vercel's timezone.
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  if (preset === 'month') return { from: today.slice(0, 7) + '-01', to: today };
  if (preset === 'year') return { from: today.slice(0, 4) + '-01-01', to: today };
  const monday = new Date(`${today}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const end = new Date(monday); end.setUTCDate(end.getUTCDate() - 1);
  monday.setUTCDate(monday.getUTCDate() - 7);
  return { from: key(monday), to: key(end) };
}
export function validStatsRange(from: string, to: string) {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && key(new Date(s)) === s;
  return valid(from) && valid(to) && from >= '2000-01-01' && to <= '2100-12-31' && from <= to && (Date.parse(to) - Date.parse(from)) / 86400000 < 366;
}
export function statsChange(current: number, previous: number) {
  const delta = current - previous;
  return { delta, percent: previous > 0 ? Math.round(delta / previous * 1000) / 10 : null };
}
