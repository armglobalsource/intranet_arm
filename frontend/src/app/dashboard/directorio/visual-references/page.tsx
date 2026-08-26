'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CanDo } from '@/components/shared/CanDo';
import {
  useVisualReferences,
  useUploadVisualReference,
  useUpdateVisualReference,
  useDeleteVisualReference,
  type VisualReference,
} from '@/hooks/useVisualReferences';

const ACCENT = '#0D9488'; // teal — distinto a los otros hubs

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition';
const labelCls = 'block text-[11px] font-medium text-slate-500 mb-1';

// ── UploadModal ───────────────────────────────────────────────────────────────

function UploadModal({ onClose }: { onClose: () => void }) {
  const upload = useUploadVisualReference();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file,      setFile]      = useState<File | null>(null);
  const [preview,   setPreview]   = useState<string>('');
  const [name,      setName]      = useState('');
  const [tags,      setTags]      = useState('');
  const [errorMsg,  setErrorMsg]  = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // Preview local con URL.createObjectURL (revoke en cleanup)
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setErrorMsg('El archivo excede el límite de 5 MB');
      return;
    }
    if (!f.type.startsWith('image/')) {
      setErrorMsg('Solo se aceptan imágenes (JPG, PNG, WebP, etc.)');
      return;
    }
    setErrorMsg('');
    setFile(f);
    // Autopoblar nombre desde el filename si aún está vacío
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''));
  }

  const canSubmit = !!file && name.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    setSaveState('saving');
    setErrorMsg('');
    upload.mutate(
      { file: file!, name: name.trim(), tags: tags.trim() || undefined },
      {
        onSuccess: () => { setSaveState('saved'); setTimeout(onClose, 700); },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? 'Error al subir la imagen';
          setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
          setSaveState('error');
          setTimeout(() => setSaveState('idle'), 2500);
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${ACCENT}18` }}>🖼️</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">Subir nueva referencia visual</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Se agregará al catálogo global</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* File picker con preview */}
          <div>
            <label className={labelCls}>Imagen <span className="text-red-400">*</span></label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            {preview ? (
              <div className="relative border-2 border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center" style={{ height: 200 }}>
                <img src={preview} alt="preview" className="max-w-full max-h-full object-contain" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium hover:bg-black/80 transition"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 rounded-lg py-10 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-teal-400 hover:text-teal-500 transition"
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="text-[12.5px] font-medium">Click para elegir imagen</span>
                <span className="text-[10.5px]">JPG, PNG, WebP — hasta 5 MB</span>
              </button>
            )}
          </div>

          <div>
            <label className={labelCls}>Nombre <span className="text-red-400">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="ej: Azul frío – Worship" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Tags (separados por coma)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="ej: azul, worship, particulas" className={inputCls} />
            <p className="text-[11px] text-slate-400 mt-1">
              Los tags permiten buscar y filtrar la imagen después. Se guardan en minúsculas.
            </p>
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
              {saveState === 'idle'   && 'Subir imagen'}
              {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Subiendo...</>}
              {saveState === 'saved'  && '✓ ¡Subida!'}
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

// ── EditModal ─────────────────────────────────────────────────────────────────

function EditModal({ entry, onClose }: { entry: VisualReference; onClose: () => void }) {
  const update = useUpdateVisualReference();
  const [name,      setName]      = useState(entry.name);
  const [tags,      setTags]      = useState(entry.tags.join(', '));
  const [errorMsg,  setErrorMsg]  = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    setSaveState('saving');
    setErrorMsg('');
    update.mutate(
      { id: entry.id, data: { name: name.trim(), tags: tags.trim() } },
      {
        onSuccess: () => { setSaveState('saved'); setTimeout(onClose, 700); },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? 'Error al guardar';
          setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
          setSaveState('error');
          setTimeout(() => setSaveState('idle'), 2500);
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${ACCENT}18` }}>✎</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">Editar referencia</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{entry.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center" style={{ height: 140 }}>
            <img src={entry.imageUrl} alt={entry.name} className="max-w-full max-h-full object-contain" />
          </div>

          <div>
            <label className={labelCls}>Nombre <span className="text-red-400">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Tags (separados por coma)</label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="ej: azul, worship, particulas" className={inputCls} />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <span className="text-[12px] text-red-700">{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSubmit} disabled={!canSubmit || saveState === 'saving' || saveState === 'saved'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : ACCENT }}>
              {saveState === 'idle'   && 'Guardar cambios'}
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
  entry: VisualReference; onConfirm: () => void; onCancel: () => void; isPending: boolean;
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
            <p className="text-[15px] font-bold text-slate-900">¿Eliminar "{entry.name}"?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              La imagen se borrará del almacenamiento. Si alguna ficha existente la
              está referenciando, verá el recuadro vacío. Esta acción no se puede deshacer.
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

// ── VisualReferencesPage ──────────────────────────────────────────────────────

export default function VisualReferencesPage() {
  const [search, setSearch]                 = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [uploadOpen, setUploadOpen]         = useState(false);
  const [editing, setEditing]               = useState<VisualReference | null>(null);
  const [confirmDelete, setConfirmDelete]   = useState<VisualReference | null>(null);

  // Debounce del search input para no golpear la API en cada tecla
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: refs = [], isLoading } = useVisualReferences(debouncedSearch || undefined);
  const remove = useDeleteVisualReference();

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    remove.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Referencias visuales</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Biblioteca de imágenes reutilizables para el layout visual de fichas técnicas.
          </p>
        </div>
        <CanDo permission="visual-references:manage">
          <button onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all flex-shrink-0"
            style={{ background: ACCENT }}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Subir imagen
          </button>
        </CanDo>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o tag…"
          className={inputCls + ' pl-9'}
        />
        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-square bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : refs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-2xl">🖼️</div>
          <div className="text-center">
            <p className="text-[14px] font-semibold text-slate-700">
              {debouncedSearch ? 'No hay resultados' : 'La biblioteca está vacía'}
            </p>
            <p className="text-[12.5px] text-slate-400 mt-1">
              {debouncedSearch
                ? `No se encontraron imágenes para "${debouncedSearch}".`
                : 'Sube la primera imagen para empezar a construir el catálogo.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {refs.map((ref) => (
            <div key={ref.id} className={`group bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow ${!ref.isActive ? 'opacity-50' : ''}`}>
              {/* Thumbnail */}
              <div className="aspect-square bg-slate-50 relative overflow-hidden">
                <img src={ref.imageUrl} alt={ref.name} className="w-full h-full object-cover" />
                <CanDo permission="visual-references:manage">
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditing(ref)}
                      title="Editar"
                      className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 shadow-sm"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setConfirmDelete(ref)}
                      title="Eliminar"
                      className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-red-500 hover:bg-white hover:text-red-700 shadow-sm"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </CanDo>
              </div>
              {/* Info */}
              <div className="p-3">
                <p className="text-[12.5px] font-semibold text-slate-800 truncate" title={ref.name}>{ref.name}</p>
                {ref.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ref.tags.slice(0, 4).map((t) => (
                      <span key={t} className="text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">
                        {t}
                      </span>
                    ))}
                    {ref.tags.length > 4 && (
                      <span className="text-[9.5px] text-slate-400 self-center">+{ref.tags.length - 4}</span>
                    )}
                  </div>
                )}
                {ref.usageCount > 0 && (
                  <p className="text-[10.5px] text-slate-400 mt-1.5">Usada {ref.usageCount}×</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modales */}
      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} />}
      {editing && <EditModal entry={editing} onClose={() => setEditing(null)} />}
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
