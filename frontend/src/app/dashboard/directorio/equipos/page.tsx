'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { CanDo } from '@/components/shared/CanDo';
import {
  useOrgAreas,
  useOrgAllTeams,
  useUpdateOrgTeam,
  useDeleteOrgTeam,
  useCreateOrgTeam,
} from '@/hooks/useOrgChart';
import type { OrgArea, OrgTeam } from '@/types/orgchart';

const PAGE_SIZE = 20;

type TeamWithArea = OrgTeam & { area: OrgArea };

// ── TeamModal ─────────────────────────────────────────────────────────────────

interface TeamModalProps {
  team?:   TeamWithArea;
  areas:   OrgArea[];
  onClose: () => void;
}

function TeamModal({ team, areas, onClose }: TeamModalProps) {
  const isEdit = !!team;
  const [name,   setName]   = useState(team?.name ?? '');
  const [desc,   setDesc]   = useState(team?.desc ?? '');
  const [areaId, setAreaId] = useState<number>(team?.areaId ?? (areas[0]?.id ?? 0));

  const create = useCreateOrgTeam();
  const update = useUpdateOrgTeam();
  const isPending = create.isPending || update.isPending;

  const selectedArea = areas.find((a) => a.id === areaId);


  function handleSubmit() {
    if (!name.trim()) return;
    if (isEdit) {
      update.mutate(
        { id: team!.id, data: { name: name.trim(), desc: desc.trim() || undefined } },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(
        { areaId, name: name.trim(), desc: desc.trim() || undefined },
        { onSuccess: onClose },
      );
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[460px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: selectedArea?.color ?? '#0D9488' }}
          >
            {name.trim() ? name.trim()[0].toUpperCase() : '?'}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">{isEdit ? 'Editar equipo' : 'Nuevo equipo'}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{isEdit ? `Editando: ${team!.name}` : 'Agrega un nuevo equipo al área'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {!isEdit && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Área <span className="text-red-400">*</span></label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition bg-white"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Nombre del equipo <span className="text-red-400">*</span></label>
            <input
              autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="Ej: Equipo de Sonido"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Descripción</label>
            <textarea
              value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
              placeholder="Describe el rol de este equipo…"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-teal-400 resize-none transition"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit} disabled={!name.trim() || isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: selectedArea?.color ?? '#0D9488' }}
            >
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>
                : isEdit ? 'Guardar cambios' : 'Crear equipo'
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
  team:      TeamWithArea;
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}

function DeleteConfirmModal({ team, onConfirm, onCancel, isPending }: DeleteConfirmModalProps) {
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
            <p className="text-[15px] font-bold text-slate-900">¿Eliminar equipo?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              Estás a punto de eliminar el equipo{' '}
              <span className="font-semibold text-slate-700">"{team.name}"</span>{' '}
              y todas sus membresías. Esta acción no se puede deshacer.
            </p>
          </div>

          {/* Team preview */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 w-full">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: team.area.color }}
            >
              {team.name[0].toUpperCase()}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[12px] font-semibold text-slate-800 truncate">{team.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{team.area.name}</p>
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
        className={`pl-3 pr-8 py-2 rounded-xl border text-[12.5px] font-medium appearance-none transition focus:outline-none focus:ring-2 focus:ring-teal-100 bg-white ${
          active
            ? 'border-teal-400 text-teal-700 bg-teal-50'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <svg className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${active ? 'text-teal-500' : 'text-slate-400'}`}
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

// ── EquiposPage ───────────────────────────────────────────────────────────────

export default function EquiposPage() {
  const { data: teams = [],  isLoading } = useOrgAllTeams();
  const { data: areas = [] }             = useOrgAreas();
  const update  = useUpdateOrgTeam();
  const destroy = useDeleteOrgTeam();

  const [modal,         setModal]         = useState<'create' | TeamWithArea | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TeamWithArea | null>(null);
  const [togglingId,    setTogglingId]    = useState<number | null>(null);

  const [search,      setSearch]      = useState('');
  const [debounced,   setDebounced]   = useState('');
  const [areaFilter,  setAreaFilter]  = useState('');
  const [page,        setPage]        = useState(1);
  const debRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(debRef.current);
  }, [search]);

  useEffect(() => setPage(1), [debounced, areaFilter]);

  const areaMap = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, a])),
    [areas],
  );

  const teamsWithArea: TeamWithArea[] = useMemo(
    () => teams.map((t) => ({
      ...t,
      area: areaMap[t.areaId] ?? { id: t.areaId, slug: '', name: 'Sin área', color: '#94a3b8', icon: '❓', sortOrder: 0 },
    })),
    [teams, areaMap],
  );

  const filtered = useMemo(() => {
    let list = teamsWithArea;
    if (areaFilter) list = list.filter((t) => String(t.areaId) === areaFilter);
    if (debounced.trim()) list = list.filter((t) => t.name.toLowerCase().includes(debounced.toLowerCase()));
    return list;
  }, [teamsWithArea, areaFilter, debounced]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = !!areaFilter;

  function handleToggle(t: TeamWithArea) {
    setTogglingId(t.id);
    update.mutate({ id: t.id, data: { isActive: !t.isActive } }, { onSettled: () => setTogglingId(null) });
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    destroy.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
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
          <h1 className="text-xl font-bold text-slate-900">Equipos</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filtered.length !== teamsWithArea.length
              ? `${filtered.length} de ${teamsWithArea.length} equipo${teamsWithArea.length !== 1 ? 's' : ''}`
              : `${teamsWithArea.length} equipo${teamsWithArea.length !== 1 ? 's' : ''} en el organigrama`
            }
          </p>
        </div>
        <CanDo permission="equipos:create">
          <button onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all bg-teal-600 hover:bg-teal-700">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo equipo
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
            placeholder="Buscar equipo por nombre..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
          )}
        </div>

        <FilterSelect value={areaFilter} onChange={setAreaFilter} placeholder="Área">
          {areas.map((a) => (
            <option key={a.id} value={String(a.id)}>{a.name}</option>
          ))}
        </FilterSelect>

        {hasFilters && (
          <button
            onClick={() => setAreaFilter('')}
            className="text-[12px] text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Equipo', 'Área', 'Miembros', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((t) => {
                  const isToggling = togglingId === t.id;
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${!t.isActive ? 'opacity-60 bg-slate-50/40' : 'hover:bg-slate-50/60'}`}
                    >
                      {/* Equipo */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                            style={{ background: t.area.color }}
                          >
                            {t.name[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-slate-900">{t.name}</p>
                            {t.desc && <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{t.desc}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Área */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full text-white"
                          style={{ background: t.area.color }}
                        >
                          {t.area.iconUrl
                            ? <img src={t.area.iconUrl} alt="" className="w-3.5 h-3.5 object-contain rounded-sm" />
                            : <span className="text-[11px]">{t.area.icon}</span>
                          }
                          {t.area.name}
                        </span>
                      </td>

                      {/* Miembros */}
                      <td className="px-4 py-3">
                        <span className="text-[12.5px] text-slate-500">{t.memberships?.length ?? 0}</span>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-3">
                        {t.isActive
                          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo</span>
                          : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactivo</span>
                        }
                      </td>

                      {/* Acciones */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <CanDo permission="equipos:edit">
                            <button onClick={() => setModal(t)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Editar">
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>

                            <button
                              onClick={() => handleToggle(t)} disabled={isToggling}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${t.isActive ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                              title={t.isActive ? 'Desactivar' : 'Activar'}>
                              {isToggling
                                ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                                  </svg>
                              }
                            </button>
                          </CanDo>

                          <CanDo permission="equipos:delete">
                            <button
                              onClick={() => setConfirmDelete(t)}
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
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <p className="text-slate-400 text-sm">
                        {search || hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay equipos creados aún.'}
                      </p>
                      {(search || hasFilters) && (
                        <button
                          onClick={() => { setAreaFilter(''); setSearch(''); }}
                          className="mt-2 text-[12px] text-teal-500 hover:text-teal-700 underline underline-offset-2"
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
        <TeamModal
          team={modal !== 'create' ? (modal as TeamWithArea) : undefined}
          areas={areas}
          onClose={() => setModal(null)}
        />
      )}
      {confirmDelete && (
        <DeleteConfirmModal
          team={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={destroy.isPending}
        />
      )}
    </div>
  );
}
