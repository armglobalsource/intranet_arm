'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { CanDo } from '@/components/shared/CanDo';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import {
  useAllJobTitles,
  useCreateJobTitle,
  useUpdateJobTitle,
  useDeleteJobTitle,
  useJobTitleAffectedUsers,
  type JobTitle,
  type JobTitleAffectedUser,
} from '@/hooks/useJobTitles';

const AFFECTED_LIST_LIMIT = 5;

// ── AffectedPeopleList ──────────────────────────────────────────────────────────

function AffectedPeopleList({ people, isLoading }: { people: JobTitleAffectedUser[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2 text-[11.5px] text-amber-700">
        <div className="w-3 h-3 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
        Buscando personas afectadas...
      </div>
    );
  }

  const shown     = people.slice(0, AFFECTED_LIST_LIMIT);
  const remaining = people.length - shown.length;

  return (
    <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
      {shown.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-amber-100">
          <span className="text-[12px] font-medium text-slate-700 truncate">{p.firstName} {p.lastName}</span>
          <span className="text-[10px] text-amber-600 flex-shrink-0">
            {p.sources.includes('orgchart') && p.sources.includes('manual')
              ? 'perfil y organigrama'
              : p.sources.includes('orgchart') ? 'organigrama' : 'perfil'}
          </span>
        </div>
      ))}
      {remaining > 0 && (
        <p className="text-[11px] text-amber-600 italic px-2.5 py-1">y {remaining} más...</p>
      )}
    </div>
  );
}

// ── AffectedWarningBox ───────────────────────────────────────────────────────────
// Caja de advertencia reutilizable para editar / eliminar / activar-desactivar un cargo.

interface AffectedWarningBoxProps {
  people:        JobTitleAffectedUser[];
  isLoading:     boolean;
  title:         (count: number) => string;
  detailMessage?: string;
  noneMessage:   string;
}

function AffectedWarningBox({ people, isLoading, title, detailMessage, noneMessage }: AffectedWarningBoxProps) {
  if (isLoading) {
    return (
      <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11.5px] text-slate-500">
        <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin flex-shrink-0" />
        Revisando quién tiene este cargo...
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11.5px] text-emerald-700">
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        {noneMessage}
      </div>
    );
  }

  return (
    <div className="w-full text-left bg-amber-50 border border-amber-200 rounded-xl p-3">
      <p className="text-[12px] font-semibold text-amber-800">{title(people.length)}</p>
      {detailMessage && <p className="text-[11.5px] text-amber-700 mt-0.5 mb-2">{detailMessage}</p>}
      <AffectedPeopleList people={people} isLoading={false} />
    </div>
  );
}

const PAGE_SIZE = 20;

// ── CargoModal ────────────────────────────────────────────────────────────────

interface CargoModalProps {
  cargo:   JobTitle | null;
  onClose: () => void;
}

function CargoModal({ cargo, onClose }: CargoModalProps) {
  const isEdit = !!cargo;
  const [name,      setName]      = useState(cargo?.name ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg,  setErrorMsg]  = useState('');

  const create = useCreateJobTitle();
  const update = useUpdateJobTitle();
  const { data: affected = [], isLoading: loadingAffected } = useJobTitleAffectedUsers(isEdit ? cargo!.id : null);

  const canSubmit = name.trim().length > 0 && (!isEdit || !loadingAffected);

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
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">💼</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">{isEdit ? 'Editar cargo' : 'Nuevo cargo'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{isEdit ? `Editando: ${cargo!.name}` : 'Agrega un nuevo cargo al catálogo'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
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

          {isEdit && (
            <AffectedWarningBox
              people={affected}
              isLoading={loadingAffected}
              title={(n) => `⚠️ ${n} persona${n !== 1 ? 's tienen' : ' tiene'} este cargo asignado`}
              detailMessage="Cambiar el nombre les afectará a todas:"
              noneMessage="No hay nadie con este cargo, así que no se afectará a ningún usuario."
            />
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-[12px] text-red-700">{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit} disabled={!canSubmit || saveState === 'saving' || saveState === 'saved'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : '#D97706' }}
            >
              {saveState === 'idle'   && isEdit && loadingAffected && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Cargando...</>}
              {saveState === 'idle'   && !(isEdit && loadingAffected) && (isEdit ? 'Guardar cambios' : '+ Crear cargo')}
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

interface DeleteConfirmModalProps {
  cargo:     JobTitle;
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}

function DeleteConfirmModal({ cargo, onConfirm, onCancel, isPending }: DeleteConfirmModalProps) {
  const { data: affected = [], isLoading: loadingAffected } = useJobTitleAffectedUsers(cargo.id);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </div>

          <div>
            <p className="text-[15px] font-bold text-slate-900">¿Eliminar cargo?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              Estás a punto de eliminar el cargo{' '}
              <span className="font-semibold text-slate-700">"{cargo.name}"</span>.
              Esta acción no se puede deshacer.
            </p>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 w-full">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-base flex-shrink-0">💼</div>
            <p className="text-[12px] font-semibold text-slate-800 truncate text-left">{cargo.name}</p>
          </div>

          <AffectedWarningBox
            people={affected}
            isLoading={loadingAffected}
            title={(n) => `⚠️ ${n} persona${n !== 1 ? 's se verán afectadas' : ' se verá afectada'} con esta eliminación`}
            detailMessage="Se les quitará este cargo automáticamente del perfil y/o del organigrama:"
            noneMessage="No hay nadie con este cargo, así que la eliminación no afectará a ningún usuario."
          />

          <div className="flex gap-2 w-full pt-1">
            <button onClick={onCancel} disabled={isPending}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={isPending || loadingAffected}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 disabled:hover:bg-red-600">
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Eliminando...</>
                : loadingAffected
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Cargando...</>
                : 'Sí, eliminar'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ToggleConfirmModal ────────────────────────────────────────────────────────

interface ToggleConfirmModalProps {
  cargo:     JobTitle;
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}

function ToggleConfirmModal({ cargo, onConfirm, onCancel, isPending }: ToggleConfirmModalProps) {
  const { data: affected = [], isLoading: loadingAffected } = useJobTitleAffectedUsers(cargo.id);
  const activating = !cargo.isActive;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center ${activating ? 'bg-emerald-50' : 'bg-slate-100'}`}>
            <svg className={`w-7 h-7 ${activating ? 'text-emerald-500' : 'text-slate-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </div>

          <div>
            <p className="text-[15px] font-bold text-slate-900">¿{activating ? 'Activar' : 'Desactivar'} cargo?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              Estás a punto de {activating ? 'activar' : 'desactivar'} el cargo{' '}
              <span className="font-semibold text-slate-700">"{cargo.name}"</span>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 w-full">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-base flex-shrink-0">💼</div>
            <p className="text-[12px] font-semibold text-slate-800 truncate text-left">{cargo.name}</p>
          </div>

          <AffectedWarningBox
            people={affected}
            isLoading={loadingAffected}
            title={(n) => `⚠️ ${n} persona${n !== 1 ? 's tienen' : ' tiene'} este cargo asignado`}
            detailMessage={
              activating
                ? 'Volverá a estar disponible para asignarlo desde el organigrama y el perfil.'
                : 'Lo conservarán en su perfil/organigrama, pero dejará de estar disponible para asignarlo a más personas.'
            }
            noneMessage="No hay nadie con este cargo, así que este cambio no afectará a ningún usuario."
          />

          <div className="flex gap-2 w-full pt-1">
            <button onClick={onCancel} disabled={isPending}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={isPending || loadingAffected}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-50 ${activating ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800'}`}>
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{activating ? 'Activando...' : 'Desactivando...'}</>
                : loadingAffected
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Cargando...</>
                : (activating ? 'Sí, activar' : 'Sí, desactivar')
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FilterSelect ──────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, placeholder, children }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  const active = value !== '';
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pl-3 pr-8 py-2 rounded-xl border text-[12.5px] font-medium appearance-none transition focus:outline-none focus:ring-2 focus:ring-amber-100 bg-white ${
          active
            ? 'border-amber-400 text-amber-700 bg-amber-50'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <svg className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${active ? 'text-amber-500' : 'text-slate-400'}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  const btnCls = (active: boolean, disabled?: boolean) =>
    `min-w-[32px] h-8 px-2 rounded-lg text-[12px] font-medium transition-colors flex items-center justify-center ${
      disabled ? 'text-slate-300 cursor-not-allowed' :
      active   ? 'bg-slate-900 text-white' :
                 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className={btnCls(false, page === 1)}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="w-8 text-center text-slate-400 text-[12px]">…</span>
          : <button key={p} onClick={() => onChange(p)} className={btnCls(p === page)}>{p}</button>
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className={btnCls(false, page === totalPages)}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  );
}

// ── CargosPage ────────────────────────────────────────────────────────────────

export default function CargosPage() {
  const allowed = useRequirePermission('cargos:view');
  const { data: cargos = [], isLoading } = useAllJobTitles();
  const update = useUpdateJobTitle();
  const remove = useDeleteJobTitle();

  const [modal,         setModal]         = useState<'create' | 'edit' | null>(null);
  const [selected,      setSelected]      = useState<JobTitle | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<JobTitle | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<JobTitle | null>(null);

  const [search,       setSearch]       = useState('');
  const [debounced,    setDebounced]    = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page,         setPage]         = useState(1);
  const debRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(debRef.current);
  }, [search]);

  useEffect(() => setPage(1), [debounced, statusFilter]);

  function openEdit(c: JobTitle)  { setSelected(c); setModal('edit'); }
  function openCreate()            { setSelected(null); setModal('create'); }
  function closeModal()            { setModal(null); setSelected(null); }

  function handleToggleConfirm() {
    if (!confirmToggle) return;
    update.mutate(
      { id: confirmToggle.id, data: { isActive: !confirmToggle.isActive } },
      { onSuccess: () => setConfirmToggle(null) },
    );
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    remove.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
  }

  const filtered = useMemo(() => {
    let list = cargos;
    if (debounced.trim()) list = list.filter((c) => c.name.toLowerCase().includes(debounced.toLowerCase()));
    if (statusFilter === 'active')   list = list.filter((c) => c.isActive);
    if (statusFilter === 'inactive') list = list.filter((c) => !c.isActive);
    return list;
  }, [cargos, debounced, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = !!statusFilter;

  if (!allowed) return null;

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
          <h1 className="text-xl font-bold text-slate-900">Cargos</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filtered.length !== cargos.length
              ? `${filtered.length} de ${cargos.length} cargo${cargos.length !== 1 ? 's' : ''}`
              : `${cargos.length} cargo${cargos.length !== 1 ? 's' : ''} en el catálogo`
            }
          </p>
        </div>
        <CanDo permission="cargos:create">
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all bg-amber-500 hover:bg-amber-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo cargo
          </button>
        </CanDo>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cargo por nombre..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
          )}
        </div>

        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Estado">
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </FilterSelect>

        {hasFilters && (
          <button
            onClick={() => setStatusFilter('')}
            className="text-[12px] text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Cargo', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((cargo) => {
                  return (
                    <tr
                      key={cargo.id}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${!cargo.isActive ? 'opacity-60 bg-slate-50/40' : 'hover:bg-slate-50/60'}`}
                    >
                      {/* Cargo */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-base flex-shrink-0">💼</div>
                          <p className="text-[13.5px] font-semibold text-slate-900">{cargo.name}</p>
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        {cargo.isActive
                          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo</span>
                          : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactivo</span>
                        }
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <CanDo permission="cargos:edit">
                            <button onClick={() => openEdit(cargo)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Editar">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            <button
                              onClick={() => setConfirmToggle(cargo)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${cargo.isActive ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                              title={cargo.isActive ? 'Desactivar' : 'Activar'}>
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                              </svg>
                            </button>
                          </CanDo>

                          <CanDo permission="cargos:delete">
                            <button
                              onClick={() => setConfirmDelete(cargo)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Eliminar">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                              </svg>
                            </button>
                          </CanDo>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-14 text-center">
                      <p className="text-slate-400 text-sm">
                        {search || hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay cargos creados aún.'}
                      </p>
                      {(search || hasFilters) && (
                        <button
                          onClick={() => { setStatusFilter(''); setSearch(''); }}
                          className="mt-2 text-[12px] text-amber-500 hover:text-amber-700 underline underline-offset-2"
                        >
                          Limpiar todos los filtros
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-slate-100 px-4">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-slate-400">
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {modal && (
        <CargoModal
          cargo={modal === 'edit' ? selected : null}
          onClose={closeModal}
        />
      )}
      {confirmDelete && (
        <DeleteConfirmModal
          cargo={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={remove.isPending}
        />
      )}
      {confirmToggle && (
        <ToggleConfirmModal
          cargo={confirmToggle}
          onConfirm={handleToggleConfirm}
          onCancel={() => setConfirmToggle(null)}
          isPending={update.isPending}
        />
      )}
    </div>
  );
}
