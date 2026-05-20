'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCloneFicha } from '@/hooks/useFichas';
import type { FichaListItem } from '@/types/ficha';

interface CloneModalProps {
  ficha:   FichaListItem;
  onClose: () => void;
}

function parseDate(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw?.toDate === 'function') return raw.toDate();
  if (typeof raw === 'string' || typeof raw === 'number') return new Date(raw);
  if (raw instanceof Date) return raw;
  if (raw.seconds) return new Date(raw.seconds * 1000);
  return null;
}

function toIsoDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function nextWeek(raw: any): string {
  const d = parseDate(raw);
  if (!d) return toIsoDateStr(new Date());
  const next = new Date(d);
  next.setDate(next.getDate() + 7);
  return toIsoDateStr(next);
}

export function CloneModal({ ficha, onClose }: CloneModalProps) {
  const router = useRouter();
  const clone  = useCloneFicha();

  const [date,          setDate]          = useState(() => nextWeek(ficha.date));
  const [keepAssignees, setKeepAssignees] = useState(false);
  const [error,         setError]         = useState('');

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleClone() {
    if (!date) { setError('La fecha es requerida'); return; }
    setError('');
    try {
      const newFicha = await clone.mutateAsync({ fichaId: ficha.fichaId, date, keepAssignees });
      onClose();
      router.push(`/dashboard/fichas-tecnicas/${newFicha.fichaId}`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al duplicar la ficha');
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Duplicar ficha</h2>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[200px]">
                    {ficha.campusName} · {ficha.title}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">

            {/* Fecha */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Nueva fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input w-full text-sm"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Por defecto: +7 días desde la ficha original
              </p>
            </div>

            {/* Toggle: mantener responsables */}
            <div
              className="flex items-start gap-3 p-3 rounded-xl cursor-pointer group transition-colors"
              style={{ background: keepAssignees ? 'rgba(99,102,241,0.06)' : '#F9FAFB', border: `1px solid ${keepAssignees ? 'rgba(99,102,241,0.2)' : '#E5E7EB'}` }}
              onClick={() => setKeepAssignees((v) => !v)}
            >
              {/* Toggle pill */}
              <div
                className={`w-9 h-5 rounded-full flex-shrink-0 flex items-center transition-colors mt-0.5 ${keepAssignees ? 'bg-indigo-500' : 'bg-gray-300'}`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${keepAssignees ? 'translate-x-4' : ''}`}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">Mantener responsables</p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                  Conserva los líderes asignados a cada sección. Los valores de las filas siempre se limpian.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleClone}
              disabled={clone.isPending || !date}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gray-900 hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {clone.isPending ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                  </svg>
                  Duplicando…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Duplicar ficha →
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
