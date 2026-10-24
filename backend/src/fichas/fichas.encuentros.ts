// Cambiar los encuentros de una ficha ya creada: agregar, quitar, renombrar o
// mover su hora. Los valores por encuentro de cada fila siguen al id del
// encuentro; al quitar uno se borran sus valores y al agregar uno se pueden
// copiar los de otro encuentro existente.

import { BadRequestException } from '@nestjs/common';

export const MAX_ENCUENTROS = 12;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface EncuentroInput {
  id: string;
  label: string;
  time: string;
  isLive: boolean;
  color: string;
  /** Solo para encuentros nuevos: id de un encuentro existente cuyos valores se copian. */
  copyFrom?: string;
}

export interface EncuentrosChange {
  kind: 'encuentros';
  added: string[];
  removed: string[];
  changed: { before: string; after: string }[];
}

const describe = (e: { label?: string; time?: string }) => [e.label, e.time].filter(Boolean).join(' · ');

/**
 * Aplica la nueva lista de encuentros sobre la ficha `f` (la modifica) y
 * devuelve el cambio para el historial, o null si no cambió nada. Devuelve
 * también las secciones cuyas filas cambiaron, para subir su revisión.
 */
export function applyEncuentros(f: any, input: EncuentroInput[]): { change: EncuentrosChange | null; touched: string[] } {
  if (!input.length) throw new BadRequestException('La ficha necesita al menos un encuentro');
  if (input.length > MAX_ENCUENTROS) throw new BadRequestException(`Una ficha admite hasta ${MAX_ENCUENTROS} encuentros`);
  if (f.type === 'oracion' && input.length > 2) throw new BadRequestException('La ficha de oración admite hasta dos encuentros');
  const ids = input.map((e) => e.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !id || id === 'shared')) {
    throw new BadRequestException('Cada encuentro necesita un identificador único');
  }
  for (const e of input) {
    if (!TIME.test(e.time)) throw new BadRequestException(`Hora inválida para «${e.label}»: usa HH:MM`);
    if (!e.label?.trim()) throw new BadRequestException('Cada encuentro necesita un nombre');
  }

  const before: any[] = f.encuentros ?? [];
  const oldById = new Map(before.map((e) => [e.id, e]));
  const removed = before.filter((e) => !ids.includes(e.id));
  const added = input.filter((e) => !oldById.has(e.id));
  for (const e of added) {
    if (e.copyFrom && !oldById.has(e.copyFrom)) throw new BadRequestException('El encuentro a copiar ya no existe');
  }
  const changed = input
    .filter((e) => oldById.has(e.id))
    .map((e) => ({ before: describe(oldById.get(e.id)), after: describe(e) }))
    .filter((c) => c.before !== c.after);

  const touched = new Set<string>();
  for (const [name, section] of Object.entries<any>(f.sections ?? {})) {
    for (const row of section?.rows ?? []) {
      const values = row.values ?? {};
      for (const e of removed) {
        if (e.id in values) { delete values[e.id]; touched.add(name); }
      }
      for (const e of added) {
        const source = e.copyFrom ? values[e.copyFrom] : undefined;
        if (!row.shared && source) { values[e.id] = source; touched.add(name); }
      }
      row.values = values;
    }
  }

  const removedIds = new Set(removed.map((e) => e.id));
  for (const slot of f.layoutVisual?.slots ?? []) {
    if (Array.isArray(slot.encuentroIds)) slot.encuentroIds = slot.encuentroIds.filter((id: string) => !removedIds.has(id));
  }

  f.encuentros = input.map(({ copyFrom: _copy, ...e }) => ({ ...e, label: e.label.trim() }));
  if (f.type !== 'oracion') f.type = input.length > 1 ? 'multi' : 'unico';

  const change: EncuentrosChange = {
    kind: 'encuentros',
    added: added.map(describe),
    removed: removed.map(describe),
    changed,
  };
  const order = (list: any[]) => list.map((e) => e.id).join('|');
  const reordered = !added.length && !removed.length && order(before) !== order(input);
  const any = change.added.length || change.removed.length || change.changed.length || reordered;
  return { change: any ? change : null, touched: [...touched] };
}
