import { buildDefaultSections } from './fichas.defaults';

/** One ficha per block: shared teams stay within that block, platform varies by encounter. */
export function buildTemplateSections(type: string, template?: 'standard' | 'santiago' | 'legacy') {
  const sections = buildDefaultSections(type);
  if (type === 'oracion' || !template || template === 'legacy') return sections;
  for (const section of Object.values(sections) as any[]) {
    for (const row of section.rows) if (row.type === 'person') row.values = {};
  }
  sections.pastoral.rows = [
    { id: 'p1', label: 'Bienvenida y Noticias', type: 'person', shared: false, values: {}, order: 0, required: true },
    { id: 'p2', label: 'Predicación', type: 'person', shared: false, values: {}, order: 1, required: true },
    { id: 'p3', label: 'Siembra / Información / Despedida', type: 'person', shared: false, values: {}, order: 2, required: false },
  ];
  sections.produccion.rows = sections.produccion.rows.filter((r:any) => r.id !== 'pr11').map((r:any) => ({
    ...r, label: r.id === 'pr2' ? 'Responsable Técnico Campus' : r.id === 'pr8' ? 'Arena / Visuales' : r.label,
  }));
  sections.media.rows.find((r:any) => r.id === 'media1').label = 'Redes sociales / Historias';
  sections.escena.rows.find((r:any) => r.id === 'esc1').type = 'person';
  if (template === 'standard') {
    const center = sections.escena.rows.find((r:any) => r.id === 'esc11');
    center.label = 'Posición Centro 1';
    sections.escena.rows.splice(sections.escena.rows.indexOf(center) + 1, 0, { ...center, id: 'esc_center2', label: 'Posición Centro 2', values: {} });
    sections.escena.rows.forEach((r:any, i:number) => r.order = i);
  }
  // Timing is deliberately blank: PDF times belong to one event and contain inconsistencies.
  return sections;
}
