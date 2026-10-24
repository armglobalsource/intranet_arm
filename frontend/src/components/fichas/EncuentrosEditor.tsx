'use client';

// Editor de los encuentros de una ficha ya creada: nombre, hora, en vivo,
// agregar (vacío o copiando otro encuentro) y quitar. Se guarda todo junto.

import { useState } from 'react';
import type { Encuentro, FichaType } from '@/types/ficha';
import { apiErrorMessage } from '@/lib/api';

export type EncuentroDraft = Encuentro & { copyFrom?: string; isNew?: boolean };

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];
const MAX = 12;

function nextId(list: EncuentroDraft[]) {
  let n = list.length + 1;
  while (list.some((e) => e.id === `e${n}`)) n += 1;
  return `e${n}`;
}

/** Nombre del encuentro con su hora, sin repetirla si el nombre ya la trae. */
const withTime = (e: Encuentro) => (e.label.includes(e.time) ? e.label : `${e.label} · ${e.time}`);

function addHours(time: string, hours: number) {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '10:00';
  return `${String((h + hours) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface Props {
  encuentros: Encuentro[];
  type: FichaType;
  onSave: (list: EncuentroDraft[]) => Promise<void>;
  onClose: () => void;
}

export function EncuentrosEditor({ encuentros, type, onSave, onClose }: Props) {
  const [list, setList] = useState<EncuentroDraft[]>(() => encuentros.map((e) => ({ ...e })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = type === 'oracion' ? 2 : MAX;
  const existing = encuentros;
  const removed = existing.filter((e) => !list.some((x) => x.id === e.id));

  const update = (id: string, patch: Partial<EncuentroDraft>) => setList((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  function add() {
    setList((l) => {
      const last = l[l.length - 1];
      const id = nextId(l);
      const time = last ? addHours(last.time, 2) : '10:00';
      const source = [...l].reverse().find((e) => !e.isNew);
      return [...l, { id, label: `Encuentro ${l.length + 1}`, time, isLive: false, color: COLORS[l.length % COLORS.length], isNew: true, copyFrom: source?.id }];
    });
  }

  async function save() {
    setError(null);
    if (list.some((e) => !e.label.trim() || !/^\d{2}:\d{2}$/.test(e.time))) {
      setError('Cada encuentro necesita nombre y hora.');
      return;
    }
    setSaving(true);
    try {
      const sorted = [...list].sort((a, b) => a.time.localeCompare(b.time));
      await onSave(sorted);
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudieron guardar los encuentros'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ficha-no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="encuentros-title">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 id="encuentros-title" className="text-base font-bold text-[#243047]">Encuentros de la ficha</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-[#69768B] hover:text-[#243047]">✕</button>
        </div>
        <p className="mb-4 text-xs text-[#526078]">
          Agrega, quita o cambia la hora de los encuentros. Al guardar se ordenan por hora. Hasta {max} encuentros.
        </p>

        <div className="space-y-2">
          {list.map((e) => (
            <div key={e.id} className="rounded-xl border border-[#DEE3EB] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: e.color }} />
                <input
                  aria-label="Nombre del encuentro" value={e.label}
                  onChange={(ev) => update(e.id, { label: ev.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-[#CCD4E1] px-2 py-1.5 text-sm"
                />
                <input
                  type="time" aria-label="Hora" value={e.time}
                  onChange={(ev) => update(e.id, { time: ev.target.value })}
                  className="w-28 rounded-lg border border-[#CCD4E1] px-2 py-1.5 text-sm"
                />
                <label className="flex items-center gap-1 text-xs text-[#526078]">
                  <input type="checkbox" checked={e.isLive} onChange={(ev) => update(e.id, { isLive: ev.target.checked })} />
                  En vivo
                </label>
                <button
                  type="button" disabled={list.length <= 1}
                  onClick={() => setList((l) => l.filter((x) => x.id !== e.id))}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-[#B42318] hover:bg-red-50 disabled:opacity-40"
                >
                  Quitar
                </button>
              </div>
              {e.isNew && existing.length > 0 && (
                <label className="mt-2 flex items-center gap-2 text-xs text-[#526078]">
                  Empezar con los datos de
                  <select
                    value={e.copyFrom ?? ''} onChange={(ev) => update(e.id, { copyFrom: ev.target.value || undefined })}
                    className="rounded-lg border border-[#CCD4E1] px-2 py-1 text-xs"
                  >
                    <option value="">Ninguno (vacío)</option>
                    {existing.map((x) => <option key={x.id} value={x.id}>{withTime(x)}</option>)}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>

        <button
          type="button" onClick={add} disabled={list.length >= max}
          className="mt-3 text-sm font-semibold text-[#4338CA] hover:underline disabled:text-[#69768B] disabled:no-underline"
        >
          + Agregar encuentro
        </button>

        {removed.length > 0 && (
          <p className="mt-3 rounded-lg bg-[#FEF3F2] px-3 py-2 text-xs text-[#B42318]">
            Al guardar se borrarán los datos propios de: {removed.map(withTime).join(', ')}. Los datos compartidos se mantienen.
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-xs font-semibold text-[#B42318]">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#CCD4E1] px-3 py-1.5 text-sm font-semibold text-[#526078]">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#4338CA] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar encuentros'}
          </button>
        </div>
      </div>
    </div>
  );
}
