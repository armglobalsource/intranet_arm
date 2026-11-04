'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useVisualReferences, useUploadVisualReference, type VisualReference } from '@/hooks/useVisualReferences';
import { CanDo } from '@/components/shared/CanDo';
import './visual-reference-gallery.css';

const ACCENT = '#3f536b';
export const FichaVisualReferencesContext = createContext<VisualReference[] | undefined>(undefined);
interface VisualReferencePickerProps {
  value: number[]; onChange: (next: number[]) => void; editable?: boolean; max?: number;
  variant?: 'gallery' | 'assembly';
}

export function VisualReferencePicker({value, onChange, editable = true, max = 30, variant = 'gallery'}: VisualReferencePickerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const publicRefs = useContext(FichaVisualReferencesContext);
  const {data: catalog = [], isError, isPending} = useVisualReferences(undefined, publicRefs === undefined);
  const allRefs = publicRefs ?? catalog;
  const byId = useMemo(() => new Map(allRefs.map(r => [r.id, r])), [allRefs]);
  const selected = value.map(id => byId.get(id)).filter((r): r is VisualReference => !!r);
  const activeIndex = selected.findIndex(r => r.id === activeId);
  return <div className={'visual-reference-gallery ' + (variant === 'assembly' ? 'visual-reference-assembly' : '')}>
    {!!selected.length && <p className="reference-gallery-count">{variant === 'assembly' ? 'Referencia de montaje' : selected.length + ' referencia' + (selected.length === 1 ? '' : 's') + ' · Selecciona una imagen para ampliarla'}</p>}
    <div className="reference-gallery-grid">{selected.map((r, i) => <figure key={r.id} className="reference-gallery-item">
      <button type="button" className="reference-gallery-open" aria-label={'Ampliar referencia ' + r.name} onClick={() => setActiveId(r.id)}>
        <img src={r.imageUrl} alt={r.name} loading="lazy" />
        <span className="reference-gallery-expand ficha-no-print" aria-hidden="true">↗</span>
      </button>
      <figcaption><span>{i + 1}. {r.name}</span>{editable && <button type="button" aria-label={'Quitar referencia ' + r.name} className="ficha-no-print" onClick={() => onChange(value.filter(id => id !== r.id))}>×</button>}</figcaption>
    </figure>)}</div>
    {publicRefs === undefined && isError && <p role="alert" className="reference-gallery-missing">No se pudieron cargar las referencias.</p>}
    {(publicRefs !== undefined || (!isError && !isPending)) && value.length > selected.length && <p className="reference-gallery-missing">Hay referencias que ya no están disponibles en el catálogo.</p>}
    {editable && <button type="button" className="reference-gallery-add ficha-no-print" onClick={() => setModalOpen(true)}>{variant === 'assembly' && value.length ? 'Cambiar imagen de montaje' : variant === 'assembly' ? '+ Agregar imagen de montaje' : '+ Agregar referencias'}</button>}
    {modalOpen && createPortal(<PickerModal initialSelected={value} max={max} onDone={ids => {onChange(ids.slice(0,max)); setModalOpen(false);}} onClose={() => setModalOpen(false)} />, document.body)}
    {activeIndex >= 0 && createPortal(<ReferenceLightbox refs={selected} index={activeIndex} onChange={i => setActiveId(selected[i].id)} onClose={() => setActiveId(null)} />, document.body)}
  </div>;
}

function ReferenceLightbox({refs, index, onChange, onClose}: {refs: VisualReference[]; index: number; onChange: (i: number) => void; onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {dialog.current?.showModal(); return () => dialog.current?.close();}, []);
  const ref = refs[index];
  return <dialog ref={dialog} className="reference-lightbox" aria-label="Referencia visual ampliada" onCancel={onClose} onKeyDown={e => {
    if (e.key === 'ArrowRight') {e.preventDefault(); onChange((index + 1) % refs.length);}
    if (e.key === 'ArrowLeft') {e.preventDefault(); onChange((index - 1 + refs.length) % refs.length);}
  }}>
    <header><span>{index + 1} / {refs.length} · {ref.name}</span><button type="button" autoFocus aria-label="Cerrar referencia ampliada" onClick={onClose}>×</button></header>
    <img src={ref.imageUrl} alt={ref.name} />
    <footer>{refs.length > 1 && <><button type="button" onClick={() => onChange((index - 1 + refs.length) % refs.length)}>← Anterior</button><button type="button" onClick={() => onChange((index + 1) % refs.length)}>Siguiente →</button></>}<a href={ref.imageUrl} target="_blank" rel="noopener noreferrer">Abrir imagen original ↗</a></footer>
  </dialog>;
}

// ── PickerModal ───────────────────────────────────────────────────────────────

function PickerModal({
  initialSelected, onDone, onClose, max = 30,
}: {
  initialSelected: number[];
  max?: number;
  onDone: (ids: number[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch]                   = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected]               = useState<Set<number>>(new Set(initialSelected));
  const [showUpload, setShowUpload]           = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const { data: refs = [], isLoading } = useVisualReferences(debouncedSearch || undefined);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else if (max === 1) return new Set([id]); else if (next.size < max) next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Elegir referencias visuales" className="bg-white rounded-2xl shadow-2xl w-full max-w-[820px] max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: `${ACCENT}18` }}>🖼️</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">Elegir referencias visuales</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {selected.size} seleccionadas · Click en un thumbnail para marcar/desmarcar
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        {/* Search + upload */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o tag…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <CanDo permission="visual-references:manage">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-white transition-all whitespace-nowrap"
              style={{ background: ACCENT }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Subir nueva
            </button>
          </CanDo>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div key={i} className="aspect-square bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : refs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-50 flex items-center justify-center text-2xl mb-3">🖼️</div>
              <p className="text-[13px] font-semibold text-slate-700">
                {debouncedSearch ? 'No hay resultados' : 'El catálogo está vacío'}
              </p>
              <p className="text-[12px] text-slate-400 mt-1">
                {debouncedSearch
                  ? `No se encontraron imágenes para "${debouncedSearch}".`
                  : 'Sube la primera imagen para empezar a construir el catálogo.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {refs.map((r) => {
                const isSel = selected.has(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-label={'Seleccionar referencia ' + r.name}
                    aria-pressed={isSel}
                    onClick={() => toggle(r.id)}
                    className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      isSel ? 'border-teal-500 shadow-md' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover" />
                    {/* Overlay + info */}
                    <div className={`absolute inset-0 flex flex-col justify-end p-2 bg-gradient-to-t from-black/70 via-black/0 to-transparent ${
                      isSel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    } transition-opacity`}>
                      <p className="text-[10px] font-semibold text-white truncate text-left">{r.name}</p>
                    </div>
                    {/* Check mark cuando seleccionada */}
                    {isSel && (
                      <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center shadow-md">
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <span className="text-[12px] text-slate-500">{selected.size} seleccionadas</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:bg-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => onDone(Array.from(selected))}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all"
              style={{ background: ACCENT }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* Modal upload inline (comparte flujo con la página maintainer) */}
      {showUpload && <InlineUploadModal onClose={(newId?: number) => {
        setShowUpload(false);
        if (newId) {
          setSelected((prev) => max === 1 ? new Set([newId]) : new Set(prev).add(newId));
        }
      }} />}
    </div>
  );
}

// ── InlineUploadModal ────────────────────────────────────────────────────────

function InlineUploadModal({ onClose }: { onClose: (newId?: number) => void }) {
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

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setErrorMsg('Excede 5 MB'); return; }
    if (!f.type.startsWith('image/')) { setErrorMsg('Solo imágenes'); return; }
    setErrorMsg('');
    setFile(f);
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
        onSuccess: (data: any) => {
          setSaveState('saved');
          setTimeout(() => onClose(data?.id), 500);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message ?? 'Error al subir';
          setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
          setSaveState('error');
          setTimeout(() => setSaveState('idle'), 2500);
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4" onClick={() => onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: `${ACCENT}18` }}>+</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">Subir nueva referencia</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Se agregará al catálogo global</p>
          </div>
          <button onClick={() => onClose()} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          {preview ? (
            <div className="relative border-2 border-slate-200 rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center" style={{ height: 160 }}>
              <img src={preview} alt="preview" className="max-w-full max-h-full object-contain" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 px-3 py-1 rounded-lg bg-black/60 text-white text-[11px] font-medium"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 rounded-lg py-8 flex flex-col items-center gap-1.5 text-slate-400 hover:border-teal-400 hover:text-teal-500"
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-[12px] font-medium">Elegir imagen (hasta 5 MB)</span>
            </button>
          )}

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (ej: Azul frío – Worship)"
            autoFocus
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags separados por coma (ej: azul, worship)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />

          {errorMsg && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{errorMsg}</div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || saveState === 'saving' || saveState === 'saved'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : ACCENT }}
            >
              {saveState === 'idle'   && 'Subir y agregar'}
              {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Subiendo...</>}
              {saveState === 'saved'  && '✓ ¡Subida!'}
              {saveState === 'error'  && '✕ Error'}
            </button>
            <button
              onClick={() => onClose()}
              disabled={saveState === 'saving'}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
