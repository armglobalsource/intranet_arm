'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CanDo } from '@/components/shared/CanDo';
import {
  useArmCatalogos,
  useCreateArmCatalogo,
  useUpdateArmCatalogo,
  useDeleteArmCatalogo,
  type ArmCatalogo,
  type ArmCatalogoTipo,
} from '@/hooks/useArmCatalogos';

const ACCENT = '#DB2777';

const TABS: { tipo: ArmCatalogoTipo; label: string }[] = [
  { tipo: 'asistencia',  label: 'Asistencia' },
  { tipo: 'voluntarios', label: 'Voluntarios' },
  { tipo: 'moneda',      label: 'Monedas' },
];

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition';
const labelCls = 'block text-[11px] font-medium text-slate-500 mb-1';

// ── ArmCatalogoModal (crear/editar) ─────────────────────────────────────────────

function ArmCatalogoModal({ tipo, entry, onClose }: {
  tipo: ArmCatalogoTipo; entry: ArmCatalogo | null; onClose: () => void;
}) {
  const isEdit = !!entry;
  const [key,       setKey]       = useState(entry?.key ?? '');
  const [label,     setLabel]     = useState(entry?.label ?? '');
  const [sortOrder, setSortOrder] = useState(entry?.sortOrder ?? 0);
  const [errorMsg,  setErrorMsg]  = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const create = useCreateArmCatalogo();
  const update = useUpdateArmCatalogo();
  const canSubmit = key.trim().length > 0 && label.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    setSaveState('saving');
    setErrorMsg('');

    const onError = (err: any) => {
      const msg = err?.response?.data?.message ?? 'Error al guardar';
      setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2500);
    };
    const onSuccess = () => { setSaveState('saved'); setTimeout(onClose, 700); };

    if (isEdit) {
      update.mutate({ id: entry!.id, tipo, data: { label: label.trim(), sortOrder } }, { onSuccess, onError });
    } else {
      create.mutate({ tipo, key: key.trim(), label: label.trim(), sortOrder }, { onSuccess, onError });
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${ACCENT}18` }}>🧾</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">{isEdit ? 'Editar entrada' : 'Nueva entrada'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isEdit ? `Editando: ${entry!.label}` : `Catálogo: ${TABS.find((t) => t.tipo === tipo)?.label}`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Clave <span className="text-red-400">*</span></label>
            <input type="text" value={key} onChange={(e) => setKey(e.target.value)}
              disabled={isEdit} autoFocus={!isEdit}
              placeholder="ej: tweens"
              className={`${inputCls} font-mono disabled:bg-slate-50 disabled:text-slate-400`} />
            <p className="text-[11px] text-slate-400 mt-1">
              {isEdit
                ? 'No se puede modificar: ya puede estar guardada en registros históricos.'
                : 'Solo letras, números y guion bajo. Es el valor que se guarda en los registros — no se puede cambiar después.'}
            </p>
          </div>
          <div>
            <label className={labelCls}>Etiqueta visible <span className="text-red-400">*</span></label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
              autoFocus={isEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="ej: Tweens" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Orden</label>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))}
              className={`${inputCls} w-24`} />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-[12px] text-red-700">{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSubmit} disabled={!canSubmit || saveState === 'saving' || saveState === 'saved'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : ACCENT }}>
              {saveState === 'idle'   && (isEdit ? 'Guardar cambios' : '+ Crear')}
              {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>}
              {saveState === 'saved'  && '✓ ¡Guardado!'}
              {saveState === 'error'  && '✕ Error'}
            </button>
            <button onClick={onClose} disabled={saveState === 'saving'}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({ entry, onConfirm, onCancel, isPending }: {
  entry: ArmCatalogo; onConfirm: () => void; onCancel: () => void; isPending: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-slate-900">¿Eliminar "{entry.label}"?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              Si esta categoría ya fue usada en registros de encuentros o siembra, esos registros
              conservarán el valor pero ya no se mostrará en los formularios. Considera{' '}
              <span className="font-semibold">desactivarla</span> en vez de eliminarla si no estás seguro.
            </p>
          </div>
          <div className="flex gap-2 w-full pt-1">
            <button onClick={onCancel} disabled={isPending}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Eliminando...</>
                : 'Sí, eliminar'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ArmCatalogosPage ──────────────────────────────────────────────────────────

export default function ArmCatalogosPage() {
  const [tab, setTab] = useState<ArmCatalogoTipo>('asistencia');
  const { data: entries = [], isLoading } = useArmCatalogos(tab);
  const update = useUpdateArmCatalogo();
  const remove = useDeleteArmCatalogo();

  const [modalEntry,     setModalEntry]     = useState<ArmCatalogo | 'new' | null>(null);
  const [confirmDelete,  setConfirmDelete]  = useState<ArmCatalogo | null>(null);
  const [togglingId,     setTogglingId]     = useState<number | null>(null);

  function handleToggle(entry: ArmCatalogo) {
    setTogglingId(entry.id);
    update.mutate(
      { id: entry.id, tipo: tab, data: { isActive: !entry.isActive } },
      { onSettled: () => setTogglingId(null) },
    );
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    remove.mutate({ id: confirmDelete.id, tipo: tab }, { onSuccess: () => setConfirmDelete(null) });
  }

  return (
    <div className="space-y-5">

      {/* Back */}
      <Link
        href="/dashboard/directorio"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-400 hover:text-slate-700 transition-colors group"
      >
        <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Configuración
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Configuración APP Web</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Categorías de asistencia, voluntarios y monedas usadas en el registro de encuentros.
          </p>
        </div>
        <CanDo permission="arm-catalogos:manage">
          <button onClick={() => setModalEntry('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: ACCENT }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo
          </button>
        </CanDo>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t.tipo} onClick={() => setTab(t.tipo)}
            className="px-4 py-2 rounded-lg text-[12.5px] font-semibold transition-all"
            style={tab === t.tipo
              ? { background: '#fff', color: ACCENT, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }
              : { color: '#64748B' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Orden', 'Clave', 'Etiqueta', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isToggling = togglingId === entry.id;
                  return (
                    <tr key={entry.id}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${!entry.isActive ? 'opacity-60 bg-slate-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-4 py-3">
                        <span className="text-[12px] text-slate-400 font-mono">{entry.sortOrder}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{entry.key}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-medium text-slate-800">{entry.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.isActive
                          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo</span>
                          : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactivo</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <CanDo permission="arm-catalogos:manage">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setModalEntry(entry)} title="Editar"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button onClick={() => handleToggle(entry)} disabled={isToggling} title={entry.isActive ? 'Desactivar' : 'Activar'}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
                                entry.isActive ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                              }`}>
                              {isToggling
                                ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                                  </svg>
                              }
                            </button>
                            <button onClick={() => setConfirmDelete(entry)} title="Eliminar"
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                              </svg>
                            </button>
                          </div>
                        </CanDo>
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <p className="text-slate-400 text-sm">
                        No hay categorías registradas para {TABS.find((t) => t.tipo === tab)?.label}.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modales */}
      {modalEntry && (
        <ArmCatalogoModal
          tipo={tab}
          entry={modalEntry === 'new' ? null : modalEntry}
          onClose={() => setModalEntry(null)}
        />
      )}
      {confirmDelete && (
        <DeleteConfirmModal
          entry={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={remove.isPending}
        />
      )}
    </div>
  );
}
