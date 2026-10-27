import type { AssignmentEdit, Encuentro, Row, RowAssignment, SectionName } from '@/types/ficha';

export const ASSIGNMENT_LABELS: Record<RowAssignment['mode'], string> = {
  people: 'Personas del directorio', pending: 'Por confirmar', fixed: 'Fija',
  sequence: 'Secuencia', not_applicable: 'No aplica', team: 'Equipo',
};
export function assignmentText(a: RowAssignment) {
  return [a.mode === 'people' ? a.people.map(p => [p.title, p.name].filter(Boolean).join(' ')).join(' / ') : ASSIGNMENT_LABELS[a.mode], a.note].filter(Boolean).join(' · ');
}
function personValue(value: string, section: SectionName, row: Row) {
  if (section !== 'horarios' && row.type !== 'song') return value;
  try { return JSON.parse(value || '{}')[section === 'horarios' ? 'responsable' : 'cantante'] ?? ''; } catch { return ''; }
}
function writePerson(value: string, text: string, section: SectionName, row: Row) {
  if (section !== 'horarios' && row.type !== 'song') return text;
  let data = {};
  try { data = JSON.parse(value || '{}'); } catch { /* legacy fields are upgraded by the editor */ }
  return JSON.stringify({ ...data, [section === 'horarios' ? 'responsable' : 'cantante']: text });
}

/** Expand a shared row before editing a single encounter; preserve every other value. */
export function editAssignmentCell(row: Row, section: SectionName, key: string, value: string, encounters: Encuentro[], edit?: AssignmentEdit): Row {
  const values = { ...row.values };
  const assignments = { ...row.assignments };
  if (!edit) {
    if (personValue(values[key] ?? '', section, row) !== personValue(value, section, row)) delete assignments[key];
    return { ...row, values: { ...values, [key]: value }, assignments };
  }
  let shared = row.shared;
  if (shared && edit.scope !== 'all' && encounters.length > 1) {
    for (const e of encounters) {
      values[e.id] = values.shared ?? values[e.id] ?? '';
      if (assignments.shared) assignments[e.id] = structuredClone(assignments.shared);
    }
    delete values.shared; delete assignments.shared; shared = false;
  }
  const current = encounters.find(e => e.id === edit.encounterId) ?? encounters[0] ?? {id: key, time: '00:00'};
  const targets = shared ? ['shared'] : edit.scope === 'current' ? [current.id] : encounters
    .filter(e => edit.scope === 'all' || (e.time < '15:00') === (current.time < '15:00')).map(e => e.id);
  for (const target of targets) {
    assignments[target] = structuredClone(edit.assignment);
    const source = target === current?.id || target === 'shared' ? value : values[target] ?? '';
    values[target] = writePerson(source, assignmentText(edit.assignment), section, row);
  }
  return { ...row, shared, values, assignments };
}
