'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useOrgAllAreas,
  useCreateOrgArea,
  useUpdateOrgArea,
  useDeleteOrgArea,
  type CreateOrgAreaPayload,
} from '@/hooks/useOrgChart';
import type { OrgArea } from '@/types/orgchart';

const PRESET_COLORS = [
  '#D97706','#0D9488','#2563EB','#DB2777','#7C3AED',
  '#DC2626','#059669','#D97706','#0891B2','#9333EA',
];

// ── Modal ─────────────────────────────────────────────────────────────────────

interface AreaModalProps {
  area?:    OrgArea;
  onClose:  () => void;
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[min(480px,94vw)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="font-bold text-slate-900">{isEdit ? 'Editar área' : 'Nueva área'}</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Nombre + slug */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombre <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="AR Worship"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Slug <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="worship"
                disabled={isEdit}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          {/* Ícono + orden */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Ícono (emoji) <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.icon}
                onChange={(e) => set('icon', e.target.value)}
                placeholder="🎵"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Orden</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => set('sortOrder', Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('color', c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ background: c, borderColor: form.color === c ? '#1e293b' : 'transparent' }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border border-slate-200"
                title="Color personalizado"
              />
              <span className="text-xs text-slate-400 ml-1 font-mono">{form.color}</span>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Descripción</label>
            <textarea
              value={form.desc}
              onChange={(e) => set('desc', e.target.value)}
              rows={2}
              placeholder="Descripción del área…"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-none transition"
            />
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: `${form.color}20` }}>
              {form.icon || '?'}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: form.color }}>{form.name || 'Nombre del área'}</p>
              <p className="text-[11px] text-slate-400 line-clamp-1">{form.desc || 'Sin descripción'}</p>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!form.name.trim() || !form.slug.trim() || !form.icon.trim() || isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: form.color }}
            >
              {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear área'}
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

export default function AreasPage() {
  const { data: areas, isLoading } = useOrgAllAreas();
  const update  = useUpdateOrgArea();
  const destroy = useDeleteOrgArea();

  const [modal,    setModal]    = useState<'create' | OrgArea | null>(null);
  const [confirm,  setConfirm]  = useState<OrgArea | null>(null);
  const [search,   setSearch]   = useState('');

  const filtered = (areas ?? []).filter((a) =>
    !search.trim() ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.slug.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleActive(area: OrgArea) {
    update.mutate({ id: area.id, data: { isActive: !area.isActive } });
  }

  function handleDelete() {
    if (!confirm) return;
    destroy.mutate(confirm.id, { onSuccess: () => setConfirm(null) });
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/directorio" className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Áreas del Organigrama</h1>
          <p className="text-sm text-slate-400 mt-0.5">Gestiona las áreas que aparecen en el diagrama</p>
        </div>
        <button
          onClick={() => setModal('create')}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva área
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar área por nombre o slug…"
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-white transition"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['Área', 'Slug', 'Color', 'Estado', 'Acciones'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((area) => (
                <tr key={area.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors ${!area.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: `${area.color}20` }}>
                        {area.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{area.name}</p>
                        {area.desc && <p className="text-[10px] text-slate-400 line-clamp-1 max-w-[200px]">{area.desc}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">{area.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full" style={{ background: area.color }} />
                      <span className="text-xs font-mono text-slate-500">{area.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${area.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${area.isActive ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {area.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* Edit */}
                      <button
                        onClick={() => setModal(area)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Editar"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {/* Toggle active */}
                      <button
                        onClick={() => toggleActive(area)}
                        disabled={update.isPending}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title={area.isActive ? 'Deshabilitar' : 'Habilitar'}
                      >
                        {area.isActive ? (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => setConfirm(area)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                    {search ? `Sin resultados para "${search}"` : 'No hay áreas creadas aún'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal !== null && (
        <AreaModal
          area={modal !== 'create' ? (modal as OrgArea) : undefined}
          onClose={() => setModal(null)}
        />
      )}

      {/* Confirm delete */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[min(380px,92vw)] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-slate-900 mb-1">¿Eliminar área?</p>
            <p className="text-sm text-slate-500 mb-5">
              Se desactivará <strong>{confirm.name}</strong> y todos sus nodos. Esta acción es reversible.
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
