'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { CanDo } from '@/components/shared/CanDo';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import Link from 'next/link';
import {
  useOrgAllAreas,
  useCreateOrgArea,
  useUpdateOrgArea,
  useDeleteOrgArea,
  type CreateOrgAreaPayload,
} from '@/hooks/useOrgChart';
import type { OrgArea } from '@/types/orgchart';

const PAGE_SIZE = 20;

const PRESET_COLORS = [
  '#D97706','#0D9488','#2563EB','#DB2777','#7C3AED',
  '#DC2626','#059669','#0891B2','#9333EA','#334155',
];

// ── AreaModal ─────────────────────────────────────────────────────────────────

interface AreaModalProps {
  area?:   OrgArea;
  onClose: () => void;
}

function AreaModal({ area, onClose }: AreaModalProps) {
  const isEdit = !!area;
  const [form, setForm] = useState<CreateOrgAreaPayload>({
    slug:      area?.slug      ?? '',
    name:      area?.name      ?? '',
    color:     area?.color     ?? '#2563EB',
    icon:      area?.icon      ?? '',
    desc:      area?.desc      ?? '',
    sortOrder: area?.sortOrder ?? 0,
  });

  const create = useCreateOrgArea();
  const update = useUpdateOrgArea();
  const isPending = create.isPending || update.isPending;

  function set(k: keyof CreateOrgAreaPayload, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.slug.trim() || !form.icon.trim()) return;
    if (isEdit) {
      update.mutate({ id: area!.id, data: form }, { onSuccess: onClose });
    } else {
      create.mutate(form, { onSuccess: onClose });
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${form.color}20` }}>
            {form.icon || '🗂️'}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">{isEdit ? 'Editar área' : 'Nueva área'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{isEdit ? `Editando: ${area!.name}` : 'Agrega una nueva área al organigrama'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Nombre <span className="text-red-400">*</span></label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="AR Worship"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Slug <span className="text-red-400">*</span></label>
              <input type="text" value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="worship" disabled={isEdit}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50 disabled:text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Ícono (emoji) <span className="text-red-400">*</span></label>
              <input type="text" value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="🎵"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 transition" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Orden</label>
              <input type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 transition" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-2">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button key={c} onClick={() => set('color', c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: form.color === c ? '#1e293b' : 'transparent' }} />
              ))}
              <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border border-slate-200" title="Color personalizado" />
              <span className="text-[11px] text-slate-400 ml-1 font-mono">{form.color}</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Descripción</label>
            <textarea value={form.desc} onChange={(e) => set('desc', e.target.value)} rows={2}
              placeholder="Descripción del área…"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 resize-none transition" />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${form.color}20` }}>
              {form.icon || '?'}
            </div>
            <div>
              <p className="text-[13px] font-bold" style={{ color: form.color }}>{form.name || 'Nombre del área'}</p>
              <p className="text-[11px] text-slate-400 line-clamp-1">{form.desc || 'Sin descripción'}</p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit}
              disabled={!form.name.trim() || !form.slug.trim() || !form.icon.trim() || isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: form.color }}>
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                : isEdit ? 'Guardar cambios' : 'Crear área'
              }
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50">
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
  area:      OrgArea;
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}

function DeleteConfirmModal({ area, onConfirm, onCancel, isPending }: DeleteConfirmModalProps) {
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
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </div>

          <div>
            <p className="text-[15px] font-bold text-slate-900">¿Eliminar área?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              Estás a punto de eliminar el área{' '}
              <span className="font-semibold text-slate-700">"{area.name}"</span>.
              Esta acción no se puede deshacer.
            </p>
          </div>

          {/* Area preview */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 w-full">
            <AreaIcon area={area} size="sm" />
            <div className="min-w-0 text-left">
              <p className="text-[12px] font-semibold truncate" style={{ color: area.color }}>{area.name}</p>
              {area.desc && <p className="text-[11px] text-slate-400 truncate">{area.desc}</p>}
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

// ── AreaIcon ──────────────────────────────────────────────────────────────────

function AreaIcon({ area, size = 'md' }: { area: OrgArea; size?: 'sm' | 'md' }) {
  const dim  = size === 'sm' ? 'w-8 h-8 rounded-lg text-base' : 'w-9 h-9 rounded-xl text-lg';
  const imgD = size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-xl';

  if (area.iconUrl) {
    return (
      <img
        src={area.iconUrl}
        alt={area.name}
        className={`${imgD} object-contain flex-shrink-0`}
        style={{ background: `${area.color}15` }}
      />
    );
  }
  return (
    <div
      className={`${dim} flex items-center justify-center flex-shrink-0`}
      style={{ background: `${area.color}15` }}
    >
      {area.icon}
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
        className={`pl-3 pr-8 py-2 rounded-xl border text-[12.5px] font-medium appearance-none transition focus:outline-none focus:ring-2 focus:ring-purple-100 bg-white ${
          active
            ? 'border-purple-400 text-purple-700 bg-purple-50'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <svg className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${active ? 'text-purple-500' : 'text-slate-400'}`}
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

// ── AreasPage ─────────────────────────────────────────────────────────────────

export default function AreasPage() {
  const allowed = useRequirePermission('areas:view');
  const { data: areas = [], isLoading } = useOrgAllAreas();
  const update  = useUpdateOrgArea();
  const destroy = useDeleteOrgArea();

  const [modal,         setModal]         = useState<'create' | OrgArea | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OrgArea | null>(null);
  const [togglingId,    setTogglingId]    = useState<number | null>(null);

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

  function handleToggle(area: OrgArea) {
    setTogglingId(area.id);
    update.mutate({ id: area.id, data: { isActive: !area.isActive } }, { onSettled: () => setTogglingId(null) });
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    destroy.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
  }

  const filtered = useMemo(() => {
    let list = areas;
    if (debounced.trim()) list = list.filter((a) =>
      a.name.toLowerCase().includes(debounced.toLowerCase()) ||
      a.slug.toLowerCase().includes(debounced.toLowerCase()),
    );
    if (statusFilter === 'active')   list = list.filter((a) => a.isActive);
    if (statusFilter === 'inactive') list = list.filter((a) => !a.isActive);
    return list;
  }, [areas, debounced, statusFilter]);

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
          <h1 className="text-xl font-bold text-slate-900">Áreas</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filtered.length !== areas.length
              ? `${filtered.length} de ${areas.length} área${areas.length !== 1 ? 's' : ''}`
              : `${areas.length} área${areas.length !== 1 ? 's' : ''} en el organigrama`
            }
          </p>
        </div>
        <CanDo permission="areas:create">
          <button onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all bg-violet-600 hover:bg-violet-700">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nueva área
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
            placeholder="Buscar área por nombre o slug..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
          )}
        </div>

        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Estado">
          <option value="active">Activa</option>
          <option value="inactive">Inactiva</option>
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
          <div className="w-8 h-8 border-2 border-slate-300 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Área', 'Slug', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((area) => {
                  const isToggling = togglingId === area.id;
                  return (
                    <tr
                      key={area.id}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${!area.isActive ? 'opacity-60 bg-slate-50/40' : 'hover:bg-slate-50/60'}`}
                    >
                      {/* Área */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <AreaIcon area={area} />
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-slate-900">{area.name}</p>
                            {area.desc && <p className="text-[11px] text-slate-400 truncate max-w-[220px]">{area.desc}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Slug */}
                      <td className="px-4 py-3">
                        <span className="text-[11.5px] font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">{area.slug}</span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        {area.isActive
                          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activa</span>
                          : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactiva</span>
                        }
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <CanDo permission="areas:edit">
                            <button onClick={() => setModal(area)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Editar">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleToggle(area)} disabled={isToggling}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${area.isActive ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                              title={area.isActive ? 'Desactivar' : 'Activar'}>
                              {isToggling
                                ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                                  </svg>
                              }
                            </button>
                          </CanDo>
                          <CanDo permission="areas:delete">
                            <button
                              onClick={() => setConfirmDelete(area)}
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
                    <td colSpan={4} className="px-4 py-14 text-center">
                      <p className="text-slate-400 text-sm">
                        {search || hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay áreas creadas aún.'}
                      </p>
                      {(search || hasFilters) && (
                        <button
                          onClick={() => { setStatusFilter(''); setSearch(''); }}
                          className="mt-2 text-[12px] text-purple-500 hover:text-purple-700 underline underline-offset-2"
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
      {modal !== null && (
        <AreaModal
          area={modal !== 'create' ? (modal as OrgArea) : undefined}
          onClose={() => setModal(null)}
        />
      )}
      {confirmDelete && (
        <DeleteConfirmModal
          area={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={destroy.isPending}
        />
      )}
    </div>
  );
}
