'use client';

// Vista «Comparar»: todas las secciones de la ficha con su valor en cada
// encuentro. Destaca lo que cambia entre encuentros y, en modo edición,
// permite pasar cada fila de compartida a "por encuentro" y al revés.

import { useMemo, useState } from 'react';
import type { Encuentro, Row, SectionName } from '@/types/ficha';
import { SECTION_LABELS } from '@/types/ficha';
import { compareRows, shareValues, splitValues } from '@/lib/ficha-compare';

const ORDER: SectionName[] = ['horarios', 'pastoral', 'produccion', 'streaming', 'escena', 'setList', 'outfit', 'media', 'voluntarios', 'anuncios'];

interface Props {
  encuentros: Encuentro[];
  sections: SectionName[];
  rowsFor: (name: SectionName) => Row[];
  paletteName?: (id: string) => string | undefined;
  /** Solo en modo edición. */
  onRowPatch?: (section: SectionName, rowId: string, patch: Partial<Row>) => void;
}

export function FichaCompareView({ encuentros, sections, rowsFor, paletteName, onRowPatch }: Props) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const data = useMemo(() => ORDER
    .filter((name) => sections.includes(name))
    .map((name) => ({ name, rows: compareRows(name, rowsFor(name), encuentros, paletteName) })),
  [sections, rowsFor, encuentros, paletteName]);

  const totalDiff = data.reduce((n, s) => n + s.rows.filter((r) => r.differs).length, 0);

  function toggleShared(section: SectionName, row: Row) {
    if (!onRowPatch) return;
    if (row.shared) {
      onRowPatch(section, row.id, { shared: false, values: splitValues(row, encuentros) });
      setNotice(`«${row.label}» ahora se completa por encuentro. Cada encuentro partió con el valor que tenía en común.`);
      return;
    }
    const { values, conflict } = shareValues(row, encuentros);
    onRowPatch(section, row.id, { shared: true, values });
    setNotice(conflict
      ? `«${row.label}» ahora es igual para todos. Tenía valores distintos: quedó el del primer encuentro con datos.`
      : `«${row.label}» ahora es igual para todos los encuentros.`);
  }

  return (
    <div className="ficha-no-print px-4 py-5 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#243047]">Comparar encuentros</h2>
          <p className="text-xs text-[#526078]">
            {totalDiff === 0 ? 'Todos los encuentros tienen los mismos datos.' : `${totalDiff} ${totalDiff === 1 ? 'fila cambia' : 'filas cambian'} entre encuentros.`}
            {onRowPatch && ' Usa «Igual para todos» o «Por encuentro» en cada fila.'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#526078]">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
          Solo lo que cambia
        </label>
      </div>
      {notice && (
        <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2 text-xs text-[#3730A3]">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold" aria-label="Cerrar aviso">✕</button>
        </div>
      )}

      <div className="space-y-4">
        {data.map(({ name, rows }) => {
          const visible = rows.filter((r) => (onlyDiff ? r.differs : (onRowPatch || !r.empty)));
          if (!visible.length) return null;
          return (
            <section key={name} className="overflow-hidden rounded-xl border border-[#DEE3EB] bg-white">
              <h3 className="border-b border-[#EDF0F4] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#69768B]">{SECTION_LABELS[name]}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="text-left text-[#69768B]">
                      <th className="px-3 py-1.5 font-semibold">Fila</th>
                      {encuentros.map((e) => <th key={e.id} className="whitespace-nowrap px-3 py-1.5 font-semibold">{e.label || e.time}</th>)}
                      {onRowPatch && <th className="px-3 py-1.5" />}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.row.id} className={`border-t border-[#EDF0F4] align-top ${r.differs ? 'bg-[#FFF8EB]' : ''}`}>
                        <td className="px-3 py-1.5 font-semibold text-[#243047]">
                          {r.label}
                          {r.differs && <span className="ml-1.5 rounded-full border border-[#F2C46D] px-1.5 text-[9.5px] font-bold uppercase text-[#B45309]">Distinto</span>}
                        </td>
                        {r.shared ? (
                          <td colSpan={encuentros.length} className="px-3 py-1.5 text-[#243047]">
                            <span className="mr-1.5 rounded-full bg-[#E0F2F1] px-1.5 text-[9.5px] font-bold uppercase text-[#0B7A75]">Todos</span>
                            {r.sharedText || <span className="text-[#69768B]">—</span>}
                          </td>
                        ) : r.cells.map((c) => (
                          <td key={c.encuentroId} className="px-3 py-1.5 text-[#243047]">{c.text || <span className="text-[#69768B]">—</span>}</td>
                        ))}
                        {onRowPatch && (
                          <td className="whitespace-nowrap px-3 py-1.5 text-right">
                            <button
                              type="button" onClick={() => toggleShared(name, r.row)}
                              className="rounded-md border border-[#CCD4E1] px-2 py-0.5 text-[11px] font-semibold text-[#4338CA] hover:bg-[#EEF2FF]"
                              title={r.shared ? 'Separar: cada encuentro tendrá su propio valor' : 'Compartir: un solo valor para todos los encuentros'}
                            >
                              {r.shared ? 'Por encuentro' : 'Igual para todos'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
