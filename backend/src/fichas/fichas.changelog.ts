// Historial legible de una ficha: qué cambió, de qué a qué y en qué encuentro.
// Las ediciones seguidas de una misma persona en una misma sección se agrupan
// (el editor guarda solo cada pocos segundos) para que el historial no se llene
// de una entrada por tecla.

export const CHANGELOG_MERGE_WINDOW_MS = 10 * 60 * 1000;
const MAX_ROW_CHANGES = 40;
const MAX_TEXT = 160;

export interface RowChange {
  kind: 'added' | 'removed' | 'renamed' | 'value';
  rowId: string;
  label: string;
  /** Encuentro afectado; null cuando el valor es compartido por todos. */
  encuentro: string | null;
  before: string | null;
  after: string | null;
}

export type ChangelogEntry =
  | { kind: 'rows'; changes: RowChange[]; truncated?: boolean }
  | { kind: 'assign'; before: string | null; after: string | null }
  | { kind: 'complete' } | { kind: 'reopen' }
  | { kind: 'title'; before: string; after: string }
  | { kind: 'date'; before: string | null; after: string | null }
  | { kind: 'modules'; shown: string[]; hidden: string[] }
  | { kind: 'equipo'; rol: 'encargadoTecnico' | 'responsableActualizacion'; before: string | null; after: string | null }
  | { kind: 'encuentros'; added: string[]; removed: string[]; changed: { before: string; after: string }[] }
  | { kind: 'layout' } | { kind: 'layoutVisual' }
  | { kind: 'publish' } | { kind: 'unpublish' } | { kind: 'archive' } | { kind: 'unarchive' };

/** Texto visible de un valor: las canciones se guardan como JSON. */
export function displayValue(raw: unknown): string | null {
  if (raw == null) return null;
  let text = String(raw).trim();
  if (!text) return null;
  if (text.startsWith('{')) {
    try {
      const v = JSON.parse(text);
      if (v && typeof v === 'object' && v.titulo) {
        text = [v.titulo, v.tonalidad && `(${v.tonalidad})`, v.cantante && `· ${v.cantante}`].filter(Boolean).join(' ');
      } else if (v && typeof v === 'object' && ('inicio' in v || 'fin' in v || 'nota' in v || 'enlace' in v || 'responsable' in v)) {
        // Momento del timing (Horarios).
        const range = v.inicio ? (v.fin ? `${v.inicio}–${v.fin}` : v.inicio) : null;
        text = [range, v.tipo, v.responsable, v.nota, v.enlace && 'con vínculo'].filter(Boolean).join(' · ') || '—';
      }
    } catch { /* texto normal */ }
  }
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

/** Encuentro visible para una clave de valor ("shared" o el id del encuentro). */
function encuentroLabel(key: string, encuentros: { id: string; time?: string; label?: string }[]) {
  if (key === 'shared') return null;
  const e = encuentros.find(x => x.id === key);
  return e?.time ?? e?.label ?? key;
}

export function diffRows(oldRows: any[], newRows: any[], encuentros: { id: string; time?: string; label?: string }[]): RowChange[] {
  const before = new Map((oldRows ?? []).map(r => [r.id, r]));
  const after = new Map((newRows ?? []).map(r => [r.id, r]));
  const changes: RowChange[] = [];
  for (const [id, row] of after) {
    const prev = before.get(id);
    const label = String(row.label ?? prev?.label ?? '');
    if (!prev) {
      changes.push({ kind: 'added', rowId: id, label, encuentro: null, before: null, after: null });
    } else if ((prev.label ?? '') !== (row.label ?? '')) {
      changes.push({ kind: 'renamed', rowId: id, label, encuentro: null, before: prev.label ?? '', after: row.label ?? '' });
    }
    if (prev && (prev.parentId ?? null) !== (row.parentId ?? null)) {
      // Momento del timing que pasa a colgar de otro (o vuelve a ser principal).
      const parent = (pid: string | null | undefined) => (pid ? `Sub-momento de ${after.get(pid)?.label ?? before.get(pid)?.label ?? pid}` : 'Momento principal');
      changes.push({ kind: 'value', rowId: `${id}#parent`, label, encuentro: null, before: parent(prev.parentId), after: parent(row.parentId) });
    }
    if (prev && !!prev.shared !== !!row.shared) {
      // Pasar a compartida (o separar) reescribe los valores: basta con una línea.
      const scope = (shared: boolean) => (shared ? 'Igual para todos' : 'Por encuentro');
      changes.push({ kind: 'value', rowId: `${id}#shared`, label, encuentro: null, before: scope(!!prev.shared), after: scope(!!row.shared) });
      continue;
    }
    const keys = new Set([...Object.keys(prev?.values ?? {}), ...Object.keys(row.values ?? {})]);
    for (const key of keys) {
      const a = displayValue(prev?.values?.[key]), b = displayValue(row.values?.[key]);
      if (a === b && JSON.stringify(prev?.assignments?.[key] ?? null) !== JSON.stringify(row.assignments?.[key] ?? null)) {
        const describe = (v:any) => v ? (v.people ?? []).map((p:any) => `${[p.title, p.name].filter(Boolean).join(' ')} (${p.userId ? `#${p.userId}` : 'manual'})`).join(' / ') || v.mode : 'Sin vínculo';
        changes.push({ kind: 'value', rowId: `${id}#people`, label, encuentro: encuentroLabel(key, encuentros), before: describe(prev?.assignments?.[key]), after: describe(row.assignments?.[key]) });
      }
      if (a !== b) changes.push({ kind: 'value', rowId: id, label, encuentro: encuentroLabel(key, encuentros), before: a, after: b });
    }
  }
  for (const [id, row] of before) {
    if (!after.has(id)) changes.push({ kind: 'removed', rowId: id, label: String(row.label ?? ''), encuentro: null, before: null, after: null });
  }
  return changes;
}

/**
 * Une una entrada nueva de filas con la anterior de la misma persona y sección:
 * conserva el "antes" original y el "después" más reciente, y descarta los
 * cambios que volvieron a su valor inicial.
 */
export function mergeRowChanges(previous: RowChange[], next: RowChange[]): RowChange[] {
  const key = (c: RowChange) => `${c.kind === 'value' ? 'value' : c.kind}|${c.rowId}|${c.encuentro ?? ''}`;
  const merged = new Map(previous.map(c => [key(c), { ...c }]));
  for (const c of next) {
    const k = key(c);
    const old = merged.get(k);
    if (old && (c.kind === 'value' || c.kind === 'renamed')) merged.set(k, { ...old, label: c.label, after: c.after });
    else if (c.kind === 'removed' && merged.get(`added|${c.rowId}|`)) {
      // Fila agregada y luego borrada dentro de la misma edición: no deja rastro.
      for (const k2 of [...merged.keys()]) if (k2.split('|')[1] === c.rowId) merged.delete(k2);
    } else merged.set(k, { ...c });
  }
  return [...merged.values()].filter(c => c.kind === 'added' || c.kind === 'removed' || c.before !== c.after);
}

export function capRowChanges(changes: RowChange[]): { kind: 'rows'; changes: RowChange[]; truncated?: boolean } {
  return changes.length > MAX_ROW_CHANGES
    ? { kind: 'rows', changes: changes.slice(0, MAX_ROW_CHANGES), truncated: true }
    : { kind: 'rows', changes };
}
