export const PRAYER_VOLUNTEERS = [
  {key: 'oradores', label: 'Oradores'}, {key: 'servicio', label: 'Servicio'},
  {key: 'tecnica', label: 'Técnica'}, {key: 'worship', label: 'Worship'},
  {key: 'cocina', label: 'Cocina'}, {key: 'rrss', label: 'Redes sociales'},
  {key: 'seguridad', label: 'Seguridad'},
];

export const isPrayerReport = (tipo: string, encuentro: string) => tipo === 'encuentro' && /\boraci[oó]n\b/i.test(encuentro);

export function mergeReportFields(...groups: {key: string; label: string}[][]) {
  return Array.from(new Map(groups.flat().map(c => [c.key, c])).values());
}
