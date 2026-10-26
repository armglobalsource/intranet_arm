export const STATS_ROOT = '/dashboard/produccion-general/estadisticas';
export const STATS_VIEWS = [
  { id: 'summary', slug: '', label: 'Resumen', description: 'Indicadores principales y comparación del período.' },
  { id: 'operations', slug: 'operacion', label: 'Operación semanal', description: 'Seguimiento de reportes y próximos pasos por campus.' },
  { id: 'campuses', slug: 'campus', label: 'Campus', description: 'Resultados por país y campus, con su contexto de registro.' },
  { id: 'trends', slug: 'evolucion', label: 'Evolución', description: 'Tendencias de asistencia y distribución de las participaciones.' },
  { id: 'projections', slug: 'proyecciones', label: 'Proyecciones', description: 'Escenarios de asistencia para las próximas cuatro semanas.' },
  { id: 'quality', slug: 'calidad', label: 'Calidad de datos', description: 'Cobertura del período y datos que necesitan revisión.' },
  { id: 'records', slug: 'registros', label: 'Registros', description: 'Consulta el detalle que respalda los indicadores.' },
] as const;
export type StatsView = typeof STATS_VIEWS[number]['id'];
export function statsHref(slug: string) { return slug ? `${STATS_ROOT}/${slug}` : STATS_ROOT; }
export function statsView(pathname: string) {
  return STATS_VIEWS.find(view => statsHref(view.slug) === pathname) ?? STATS_VIEWS[0];
}
