import type { Row } from '@/types/ficha';

export type FichaColumns = { left: string[]; right: string[]; leftRatio?: number };

/** Move by identity: filtered views must never reorder unrelated row indices. */
export function reorderFichaRows(rows: Row[], activeId: string, overId: string): Row[] {
  const sorted = [...rows].sort((a, b) => a.order - b.order);
  const from = sorted.findIndex((row) => row.id === activeId);
  const to = sorted.findIndex((row) => row.id === overId);
  if (from < 0 || to < 0 || from === to) return rows;
  const [moved] = sorted.splice(from, 1);
  sorted.splice(to, 0, moved);
  return sorted.map((row, order) => ({ ...row, order }));
}

/** Column targets append; block targets insert at that block's position. */
export function moveFichaBlock(layout: FichaColumns, activeId: string, overId: string): FichaColumns {
  const from = layout.left.includes(activeId) ? 'left' : layout.right.includes(activeId) ? 'right' : null;
  const to = overId === 'column:left' || layout.left.includes(overId) ? 'left'
    : overId === 'column:right' || layout.right.includes(overId) ? 'right' : null;
  if (!from || !to || activeId === overId) return layout;
  const next = { ...layout, left: [...layout.left], right: [...layout.right] };
  const index = layout[to].indexOf(overId);
  next[from].splice(next[from].indexOf(activeId), 1);
  next[to].splice(index < 0 ? next[to].length : index, 0, activeId);
  return next;
}
