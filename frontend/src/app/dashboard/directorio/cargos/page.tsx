'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useAllJobTitles,
  useCreateJobTitle,
  useUpdateJobTitle,
  useDeleteJobTitle,
  type JobTitle,
} from '@/hooks/useJobTitles';

// ── CargoModal ────────────────────────────────────────────────────────────────

interface CargoModalProps {
  cargo:   JobTitle | null;   // null → crear
  onClose: () => void;
}

function CargoModal({ cargo, onClose }: CargoModalProps) {
  const isEdit = !!cargo;
  const [name,      setName]      = useState(cargo?.name ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg,  setErrorMsg]  = useState('');

  const create = useCreateJobTitle();
  const update = useUpdateJobTitle();

  const canSubmit = name.trim().length > 0;

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
    const onSuccess = () => { setSaveState('saved'); setTimeout(onClose, 800); };

    if (isEdit) {
      update.mutate({ id: cargo!.id, data: { name: name.trim() } }, { onSuccess, onError });
    } else {
      create.mutate({ name: name.trim() }, { onSuccess, onError });
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[400px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">💼</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">{isEdit ? 'Editar cargo' : 'Nuevo cargo'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{isEdit ? `Editando: ${cargo!.name}` : 'Agrega un nuevo cargo al catálogo'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Nombre */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Nombre del cargo <span className="text-red-400">*</span>
            </label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition"
              placeholder="Ej: Líder de Worship, Encargado de Guitarras..."
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-[12px] text-red-700">{errorMsg}</span>
            </div>
          )}

          {/* Botones */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit} disabled={!canSubmit || saveState === 'saving' || saveState === 'saved'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : '#D97706' }}
            >
              {saveState === 'idle'   && (isEdit ? 'Guardar cambios' : '+ Crear cargo')}
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

// ── CargosPage ────────────────────────────────────────────────────────────────

export default function CargosPage() {
  const router = useRouter();
  const { data: cargos = [], isLoading } = useAllJobTitles();
  const update = useUpdateJobTitle();
  const remove = useDeleteJobTitle();

  const [modal,      setModal]      = useState<'create' | 'edit' | null>(null);
  const [selected,   setSelected]   = useState<JobTitle | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [search,     setSearch]     = useState('');

  function openEdit(c: JobTitle) { setSelected(c); setModal('edit'); }
  function openCreate() { setSelected(null); setModal('create'); }
  function closeModal() { setModal(null); setSelected(null); }

  function handleToggle(c: JobTitle) {
    setTogglingId(c.id);
    update.mutate({ id: c.id, data: { isActive: !c.isActive } }, { onSettled: () => setTogglingId(null) });
  }

  function handleDelete(id: number) {
    if (deletingId !== id) { setDeletingId(id); return; }
    remove.mutate(id, { onSettled: () => setDeletingId(null) });
  }

  const active   = cargos.filter((c) => c.isActive).length;
  const total    = cargos.length;
  const filtered = cargos.filter((c) => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-full bg-slate-50 p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/directorio')}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <h1 className="text-[22px] font-bold text-slate-900 leading-tight">Catálogo de Cargos</h1>
            <p className="text-slate-400 text-[13px] mt-0.5">
              {isLoading ? 'Cargando...' : `${active} activos · ${total} total`}
            </p>
          </div>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-[13px] font-semibold transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo cargo
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cargo por nombre…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 bg-white transition"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Cabecera */}
        <div className="grid grid-cols-[3fr_80px_80px_120px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
          {['CARGO', 'ORDEN', 'ESTADO', 'ACCIONES'].map((h) => (
            <span key={h} className="text-[10.5px] font-bold tracking-widest text-slate-400 uppercase">{h}</span>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl">💼</div>
            <div>
              <p className="text-[13px] font-medium text-slate-700">
                {search ? `Sin resultados para "${search}"` : 'No hay cargos creados'}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                {search ? 'Prueba con otro término' : 'Crea el primer cargo con el botón de arriba'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((cargo) => {
              const isInactive   = !cargo.isActive;
              const isToggling   = togglingId === cargo.id;
              const isDelConfirm = deletingId === cargo.id;

              return (
                <div
                  key={cargo.id}
                  className={`grid grid-cols-[3fr_80px_80px_120px] gap-4 items-center px-5 py-3.5 transition-colors ${isInactive ? 'opacity-60 bg-slate-50/60' : 'hover:bg-slate-50/50'}`}
                >
                  {/* Nombre */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-base flex-shrink-0">
                      💼
                    </div>
                    <p className="text-[13.5px] font-semibold text-slate-900 truncate">{cargo.name}</p>
                  </div>

                  {/* Orden */}
                  <span className="text-[12.5px] text-slate-400 font-mono">{cargo.sortOrder}</span>

                  {/* Estado */}
                  {cargo.isActive
                    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium w-fit"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo</span>
                    : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium w-fit"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactivo</span>
                  }

                  {/* Acciones */}
                  <div className="flex items-center gap-1.5">
                    {/* Editar */}
                    <button
                      onClick={() => openEdit(cargo)} title="Editar"
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>

                    {/* Activar / Desactivar */}
                    <button
                      onClick={() => handleToggle(cargo)} disabled={isToggling}
                      title={isInactive ? 'Activar' : 'Desactivar'}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-50 ${
                        isInactive
                          ? 'border-emerald-200 text-emerald-500 hover:bg-emerald-50'
                          : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {isToggling
                        ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                        : isInactive
                          ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                          : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      }
                    </button>

                    {/* Eliminar (doble clic) */}
                    <button
                      onClick={() => handleDelete(cargo.id)}
                      title={isDelConfirm ? 'Confirmar eliminación' : 'Eliminar'}
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                        isDelConfirm
                          ? 'border-red-300 bg-red-50 text-red-500 hover:bg-red-100'
                          : 'border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200'
                      }`}
                    >
                      {isDelConfirm
                        ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                      }
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deletingId !== null && (
        <p className="mt-3 text-center text-[12px] text-slate-400">
          Haz clic en ✓ nuevamente para confirmar la eliminación
        </p>
      )}

      {/* Modal */}
      {modal && (
        <CargoModal
          cargo={modal === 'edit' ? selected : null}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
