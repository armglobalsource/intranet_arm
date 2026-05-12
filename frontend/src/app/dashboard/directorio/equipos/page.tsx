'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  useOrgAreas,
  useOrgAllTeams,
  useUpdateOrgTeam,
  useDeleteOrgTeam,
  useCreateOrgTeam,
} from '@/hooks/useOrgChart';
import type { OrgArea, OrgTeam } from '@/types/orgchart';

type TeamWithArea = OrgTeam & { area: OrgArea };

// ── Modal crear/editar equipo ──────────────────────────────────────────────────

interface TeamModalProps {
  team?:    TeamWithArea;
  areas:    OrgArea[];
  onClose:  () => void;
}

function TeamModal({ team, areas, onClose }: TeamModalProps) {
  const isEdit = !!team;
  const [name,   setName]   = useState(team?.name  ?? '');
  const [icon,   setIcon]   = useState(team?.icon  ?? '');
  const [desc,   setDesc]   = useState(team?.desc  ?? '');
  const [areaId, setAreaId] = useState<number>(team?.areaId ?? (areas[0]?.id ?? 0));
  const [colPos, setColPos] = useState<number>(team?.colPosition ?? 1);

  const create = useCreateOrgTeam();
  const update = useUpdateOrgTeam();
  const isPending = create.isPending || update.isPending;

  const selectedArea = areas.find((a) => a.id === areaId);

  function handleSubmit() {
    if (!name.trim()) return;
    if (isEdit) {
      update.mutate(
        { id: team!.id, data: { name: name.trim(), icon: icon.trim() || undefined, desc: desc.trim() || undefined, colPosition: colPos } },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(
        { areaId, name: name.trim(), icon: icon.trim() || undefined, desc: desc.trim() || undefined, colPosition: colPos },
        { onSuccess: onClose },
      );
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[min(460px,94vw)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="font-bold text-slate-900">{isEdit ? 'Editar equipo' : 'Nuevo equipo'}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Área <span className="text-red-400">*</span></label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition bg-white"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombre del equipo <span className="text-red-400">*</span></label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Equipo de Sonido"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Ícono (emoji)</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🎵"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Columna</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColPos(c)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all"
                    style={colPos === c
                      ? { background: selectedArea?.color ?? '#2563EB', color: '#fff', borderColor: selectedArea?.color ?? '#2563EB' }
                      : { borderColor: '#e2e8f0', color: '#64748b' }
                    }
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Descripción</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="Describe el rol de este equipo…"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-none transition"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: selectedArea?.color ?? '#0f172a' }}
            >
              {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear equipo'}
            </button>
            <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EquiposPage() {
  const { data: teams, isLoading } = useOrgAllTeams();
  const { data: areas = [] }       = useOrgAreas();
  const update  = useUpdateOrgTeam();
  const destroy = useDeleteOrgTeam();

  const [modal,   setModal]   = useState<'create' | TeamWithArea | null>(null);
  const [confirm, setConfirm] = useState<TeamWithArea | null>(null);
  const [filter,  setFilter]  = useState<number | 'all'>('all');
  const [search,  setSearch]  = useState('');

  const areaMap = useMemo(() => Object.fromEntries(areas.map((a) => [a.id, a])), [areas]);

  const teamsWithArea: TeamWithArea[] = useMemo(
    () => (teams ?? []).map((t) => ({ ...t, area: areaMap[t.areaId] ?? { id: t.areaId, slug: '', name: 'Sin área', color: '#94a3b8', icon: '❓', sortOrder: 0 } })),
    [teams, areaMap],
  );

  const filtered = teamsWithArea.filter(
    (t) =>
      (filter === 'all' || t.areaId === filter) &&
      (!search.trim() || t.name.toLowerCase().includes(search.toLowerCase())),
  );

  function toggleActive(t: TeamWithArea) {
    update.mutate({ id: t.id, data: { isActive: !t.isActive } });
  }

  function handleDelete() {
    if (!confirm) return;
    destroy.mutate(confirm.id, { onSuccess: () => setConfirm(null) });
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/directorio" className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Equipos del Organigrama</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gestiona los equipos de cada área</p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo equipo
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
          style={filter === 'all' ? { background: '#0f172a', color: '#fff', borderColor: '#0f172a' } : { borderColor: '#e2e8f0', color: '#64748b' }}
        >
          Todas las áreas
        </button>
        {areas.map((a) => (
          <button
            key={a.id}
            onClick={() => setFilter(a.id)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
            style={filter === a.id ? { background: a.color, color: '#fff', borderColor: a.color } : { borderColor: '#e2e8f0', color: '#64748b' }}
          >
            {a.icon} {a.name}
          </button>
        ))}
      </div>

      {/* Búsqueda por texto */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar equipo por nombre…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 bg-white transition"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Equipo', 'Área', 'Col', 'Miembros', 'Estado', 'Acciones'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${!t.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-base flex-shrink-0">
                        {t.icon ?? '👥'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                        {t.desc && <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{t.desc}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-white" style={{ background: t.area.color }}>
                      {t.area.icon} {t.area.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">Col {t.colPosition}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500">{t.memberships?.length ?? 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${t.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {t.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setModal(t)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Editar">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button onClick={() => toggleActive(t)} disabled={update.isPending} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title={t.isActive ? 'Deshabilitar' : 'Habilitar'}>
                        {t.isActive ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                      <button onClick={() => setConfirm(t)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Eliminar">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">No hay equipos{filter !== 'all' ? ' en esta área' : ''}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <TeamModal
          team={modal !== 'create' ? modal as TeamWithArea : undefined}
          areas={areas}
          onClose={() => setModal(null)}
        />
      )}

      {confirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[min(380px,92vw)] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-slate-900 mb-1">¿Eliminar equipo?</p>
            <p className="text-sm text-slate-500 mb-5">
              Se eliminará <strong>{confirm.name}</strong> y sus membresías.
            </p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={destroy.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                {destroy.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
              <button onClick={() => setConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
