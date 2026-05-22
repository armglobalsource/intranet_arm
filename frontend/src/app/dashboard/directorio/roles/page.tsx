'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  useSystemRoles, useCreateRole, useUpdateRole, useDeleteRole,
  type SystemRole,
} from '@/hooks/useRoles';
import { PERMISSION_CATALOG } from '@/lib/permissions';

const PAGE_SIZE = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function permLabel(perm: string): string {
  const [resource, action] = perm.split(':');
  const cat = (PERMISSION_CATALOG as any)[resource];
  if (!cat) return perm;
  return cat.actions?.[action] ?? `${cat.label}: ${action}`;
}

function PermBadges({ permissions }: { permissions: string[] }) {
  if (permissions.includes('*')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10.5px] font-semibold">
        ✦ Acceso total
      </span>
    );
  }
  if (permissions.length === 0) {
    return <span className="text-[11px] italic text-slate-300">Sin permisos</span>;
  }
  const shown = permissions.slice(0, 2);
  const rest  = permissions.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((p) => (
        <span key={p} className="inline-flex px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10.5px]">{permLabel(p)}</span>
      ))}
      {rest > 0 && <span className="text-[10.5px] text-slate-400 self-center">+{rest} más</span>}
    </div>
  );
}

// ── PermissionsPanel ──────────────────────────────────────────────────────────

interface PermissionsPanelProps {
  rol:     SystemRole;
  onClose: () => void;
}

function PermissionsPanel({ rol, onClose }: PermissionsPanelProps) {
  const update     = useUpdateRole();
  const isWildcard = rol.permissions.includes('*');

  const [selected,  setSelected]  = useState<Set<string>>(new Set(rol.permissions));
  const [wildcard,  setWildcard]  = useState(isWildcard);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  function toggle(perm: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm); else next.add(perm);
      return next;
    });
  }

  function toggleWildcard() { setWildcard((w) => !w); setSelected(new Set()); }

  function handleSave() {
    setSaveState('saving');
    const permissions = wildcard ? ['*'] : Array.from(selected);
    update.mutate(
      { id: rol.id, data: { permissions } },
      {
        onSuccess: () => { setSaveState('saved'); setTimeout(onClose, 700); },
        onError:   () => { setSaveState('error'); setTimeout(() => setSaveState('idle'), 2000); },
      },
    );
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[620px] overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-lg">🛡️</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">Permisos — <span className="font-mono text-indigo-600">{rol.name}</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">Configura qué puede hacer este rol en el sistema</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${wildcard ? 'bg-indigo-50 border border-indigo-200' : 'border border-slate-200 hover:bg-slate-50'}`}>
            <div
              className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${wildcard ? 'bg-indigo-600' : 'border-2 border-slate-300'}`}
              onClick={toggleWildcard}
            >
              {wildcard && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </div>
            <div className="flex-1" onClick={toggleWildcard}>
              <p className="text-[13px] font-semibold text-slate-900">Acceso total <span className="font-mono text-[11px] text-indigo-500 ml-1">*</span></p>
              <p className="text-[11px] text-slate-400">Este rol puede hacer todo en el sistema sin restricciones</p>
            </div>
          </label>
        </div>

        <div className={`overflow-y-auto flex-1 px-5 py-4 ${wildcard ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex flex-col gap-4">
            {Object.entries(PERMISSION_CATALOG).map(([resource, cfg]) => (
              <div key={resource}>
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <p className="text-[11.5px] font-bold text-slate-700 uppercase tracking-wider">{cfg.label}</p>
                    <div className="flex-1 h-px bg-slate-100"/>
                  </div>
                  {'description' in cfg && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{(cfg as any).description}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(cfg.actions).map(([action, label]) => {
                    const perm    = `${resource}:${action}`;
                    const checked = selected.has(perm);
                    return (
                      <label key={perm} onClick={() => toggle(perm)}
                        className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer border transition-colors ${
                          checked ? 'bg-indigo-50 border-indigo-200' : 'border-slate-200 hover:bg-slate-50'
                        }`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${checked ? 'bg-indigo-600' : 'border-2 border-slate-300'}`}>
                          {checked && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <p className="text-[12px] font-medium text-slate-800 leading-tight">{label as string}</p>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50">
          <span className="text-[12px] text-slate-400 flex-1">
            {wildcard ? 'Acceso total activado' : `${selected.size} permiso${selected.size !== 1 ? 's' : ''} seleccionado${selected.size !== 1 ? 's' : ''}`}
          </span>
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-100 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saveState === 'saving' || saveState === 'saved'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : '#4F46E5' }}>
            {saveState === 'idle'   && 'Guardar permisos'}
            {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Guardando...</>}
            {saveState === 'saved'  && '✓ Guardado'}
            {saveState === 'error'  && '✕ Error'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RolModal ──────────────────────────────────────────────────────────────────

interface RolModalProps {
  rol:     SystemRole | null;
  onClose: () => void;
}

function RolModal({ rol, onClose }: RolModalProps) {
  const isEdit      = !!rol;
  const isSystemRol = isEdit && rol!.isSystem;

  const [name,        setName]        = useState(rol?.name ?? '');
  const [description, setDescription] = useState(rol?.description ?? '');
  const [saveState,   setSaveState]   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg,    setErrorMsg]    = useState('');

  const create    = useCreateRole();
  const update    = useUpdateRole();
  const canSubmit = name.trim().length >= 2;

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
    const data = { name: name.trim(), description: description.trim() || undefined };
    if (isEdit) update.mutate({ id: rol!.id, data }, { onSuccess, onError });
    else        create.mutate(data, { onSuccess, onError });
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
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-lg">🔐</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">{isEdit ? 'Editar rol' : 'Nuevo rol del sistema'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isEdit ? `Editando: ${rol!.name}` : 'Define un nuevo rol para controlar acceso y funcionalidades'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {isSystemRol && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-amber-500 mt-0.5">⚠️</span>
              <span className="text-[12px] text-amber-800">Este es un rol del sistema. El nombre no puede modificarse.</span>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Nombre del rol <span className="text-red-400">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              disabled={isSystemRol} autoFocus={!isSystemRol}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition disabled:bg-slate-50 disabled:text-slate-400"
              placeholder="Ej: branding, editor, supervisor..." />
            <p className="text-[11px] text-slate-400 mt-1">Identificador interno del rol</p>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Descripción <span className="text-slate-400 font-normal">(opcional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              autoFocus={isSystemRol} rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition resize-none"
              placeholder="Describe las responsabilidades y accesos de este rol..." />
          </div>
          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-[12px] text-red-700">{errorMsg}</span>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSubmit} disabled={!canSubmit || saveState === 'saving' || saveState === 'saved'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : '#4F46E5' }}>
              {saveState === 'idle'   && (isEdit ? 'Guardar cambios' : '+ Crear rol')}
              {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Guardando...</>}
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
  rol:       SystemRole;
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}

function DeleteConfirmModal({ rol, onConfirm, onCancel, isPending }: DeleteConfirmModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[380px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-slate-900">¿Eliminar rol?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              Estás a punto de eliminar el rol{' '}
              <span className="font-mono font-semibold text-slate-700">"{rol.name}"</span>.
              Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 w-full">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-base flex-shrink-0">🔓</div>
            <div className="min-w-0 text-left">
              <p className="text-[12px] font-mono font-semibold text-slate-800 truncate">{rol.name}</p>
              {rol.description && <p className="text-[11px] text-slate-400 truncate">{rol.description}</p>}
            </div>
          </div>
          <div className="flex gap-2 w-full pt-1">
            <button onClick={onCancel} disabled={isPending}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Eliminando...</>
                : 'Sí, eliminar'
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
        className={`pl-3 pr-8 py-2 rounded-xl border text-[12.5px] font-medium appearance-none transition focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white ${
          active
            ? 'border-indigo-400 text-indigo-700 bg-indigo-50'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <svg className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${active ? 'text-indigo-500' : 'text-slate-400'}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
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
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="w-8 text-center text-slate-400 text-[12px]">…</span>
          : <button key={p} onClick={() => onChange(p)} className={btnCls(p === page)}>{p}</button>
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className={btnCls(false, page === totalPages)}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  );
}

// ── RolesPage ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { data: roles = [], isLoading } = useSystemRoles();
  const update = useUpdateRole();
  const remove = useDeleteRole();

  const [modal,         setModal]         = useState<'create' | 'edit' | null>(null);
  const [permsFor,      setPermsFor]      = useState<SystemRole | null>(null);
  const [selected,      setSelected]      = useState<SystemRole | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SystemRole | null>(null);
  const [togglingId,    setTogglingId]    = useState<number | null>(null);

  const [search,        setSearch]        = useState('');
  const [debounced,     setDebounced]     = useState('');
  const [tipoFilter,    setTipoFilter]    = useState('');
  const [permisoFilter, setPermisoFilter] = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [page,          setPage]          = useState(1);
  const debRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(debRef.current);
  }, [search]);

  useEffect(() => setPage(1), [debounced, tipoFilter, permisoFilter, statusFilter]);

  function openEdit(r: SystemRole)  { setSelected(r); setModal('edit'); }
  function openCreate()              { setSelected(null); setModal('create'); }
  function closeModal()              { setModal(null); setSelected(null); }

  function handleToggle(r: SystemRole) {
    if (r.isSystem) return;
    setTogglingId(r.id);
    update.mutate({ id: r.id, data: { isActive: !r.isActive } }, { onSettled: () => setTogglingId(null) });
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    remove.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
  }

  const filtered = useMemo(() => {
    let list = roles;
    if (debounced.trim()) list = list.filter((r) =>
      r.name.toLowerCase().includes(debounced.toLowerCase()) ||
      r.description?.toLowerCase().includes(debounced.toLowerCase()),
    );
    if (tipoFilter === 'system') list = list.filter((r) => r.isSystem);
    if (tipoFilter === 'custom') list = list.filter((r) => !r.isSystem);
    if (permisoFilter) list = list.filter((r) =>
      r.permissions.includes('*') || r.permissions.some((p) => p.startsWith(permisoFilter + ':')),
    );
    if (statusFilter === 'active')   list = list.filter((r) => r.isActive);
    if (statusFilter === 'inactive') list = list.filter((r) => !r.isActive);
    return list;
  }, [roles, debounced, tipoFilter, permisoFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = tipoFilter || permisoFilter || statusFilter;

  // Resources for the permission filter
  const permResources = Object.entries(PERMISSION_CATALOG).map(([key, cfg]) => ({ key, label: cfg.label }));

  return (
    <div className="space-y-5">

      {/* Back */}
      <Link
        href="/dashboard/directorio"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-400 hover:text-slate-700 transition-colors group"
      >
        <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Configuración
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Roles del Sistema</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filtered.length !== roles.length
              ? `${filtered.length} de ${roles.length} rol${roles.length !== 1 ? 'es' : ''}`
              : `${roles.length} rol${roles.length !== 1 ? 'es' : ''} configurado${roles.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all bg-indigo-600 hover:bg-indigo-700">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo rol
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100">
        <span className="text-indigo-400 mt-0.5 text-lg flex-shrink-0">🔐</span>
        <div>
          <p className="text-[13px] font-medium text-indigo-900">Roles del sistema vs. Cargos</p>
          <p className="text-[12px] text-indigo-600 mt-0.5 leading-relaxed">
            Los <strong>roles</strong> controlan el acceso y funcionalidades (ej: admin, branding).
            Los <strong>cargos</strong> son los títulos organizacionales de la persona (ej: Líder de Worship).
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o descripción..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
          )}
        </div>

        <FilterSelect value={tipoFilter} onChange={setTipoFilter} placeholder="Tipo">
          <option value="system">Sistema</option>
          <option value="custom">Custom</option>
        </FilterSelect>

        <FilterSelect value={permisoFilter} onChange={setPermisoFilter} placeholder="Permisos">
          {permResources.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </FilterSelect>

        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Estado">
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </FilterSelect>

        {hasFilters && (
          <button
            onClick={() => { setTipoFilter(''); setPermisoFilter(''); setStatusFilter(''); }}
            className="text-[12px] text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"/>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Rol', 'Tipo', 'Permisos', 'Usuarios', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((rol) => {
                  const isToggling = togglingId === rol.id;
                  return (
                    <tr
                      key={rol.id}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${!rol.isActive ? 'opacity-60 bg-slate-50/40' : 'hover:bg-slate-50/60'}`}
                    >
                      {/* Rol */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${rol.isSystem ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                            {rol.isSystem ? '🔒' : '🔓'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold font-mono text-slate-900 truncate">{rol.name}</p>
                            {rol.description && <p className="text-[11px] text-slate-400 truncate max-w-[160px]">{rol.description}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        {rol.isSystem
                          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"/>Sistema</span>
                          : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>Custom</span>
                        }
                      </td>

                      {/* Permisos */}
                      <td className="px-4 py-3"><PermBadges permissions={rol.permissions}/></td>

                      {/* Usuarios */}
                      <td className="px-4 py-3">
                        <span className="text-[12.5px] text-slate-500">{rol.userCount ?? 0}</span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        {rol.isActive
                          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"/>Activo</span>
                          : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"/>Inactivo</span>
                        }
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">

                          {/* Configurar permisos */}
                          <button onClick={() => setPermsFor(rol)} title="Configurar permisos"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                          </button>

                          {/* Editar */}
                          <button onClick={() => openEdit(rol)} title="Editar"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>

                          {/* Toggle activo */}
                          <button
                            onClick={() => handleToggle(rol)}
                            disabled={isToggling || rol.isSystem}
                            title={rol.isSystem ? 'Los roles del sistema no pueden deshabilitarse' : rol.isActive ? 'Desactivar' : 'Activar'}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                              rol.isActive ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {isToggling
                              ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"/>
                              : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
                                </svg>
                            }
                          </button>

                          {/* Eliminar */}
                          <button
                            onClick={() => !rol.isSystem && setConfirmDelete(rol)}
                            disabled={rol.isSystem}
                            title={rol.isSystem ? 'Los roles del sistema no pueden eliminarse' : 'Eliminar'}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <p className="text-slate-400 text-sm">
                        {search || hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay roles creados aún.'}
                      </p>
                      {hasFilters && (
                        <button
                          onClick={() => { setTipoFilter(''); setPermisoFilter(''); setStatusFilter(''); setSearch(''); }}
                          className="mt-2 text-[12px] text-indigo-500 hover:text-indigo-700 underline underline-offset-2"
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
                <Pagination page={page} totalPages={totalPages} onChange={setPage}/>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {modal    && <RolModal rol={modal === 'edit' ? selected : null} onClose={closeModal}/>}
      {permsFor && <PermissionsPanel rol={permsFor} onClose={() => setPermsFor(null)}/>}
      {confirmDelete && (
        <DeleteConfirmModal
          rol={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={remove.isPending}
        />
      )}
    </div>
  );
}
