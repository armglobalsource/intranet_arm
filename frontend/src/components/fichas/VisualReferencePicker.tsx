'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useVisualReferences,
  useUploadVisualReference,
  type VisualReference,
} from '@/hooks/useVisualReferences';
import { CanDo } from '@/components/shared/CanDo';

const ACCENT = '#0D9488';

interface VisualReferencePickerProps {
  value:    number[];
  onChange: (next: number[]) => void;
  editable?: boolean;
  /** Máximo de referencias por canción (defensa contra clicks accidentales). */
  max?: number;
}

/**
 * Muestra las referencias visuales seleccionadas como chips inline con
 * thumbnails, y un botón "+" que abre el modal para elegir más del catálogo
 * global. En modo NO editable solo muestra los thumbnails.
 */
export function VisualReferencePicker({
  value, onChange, editable = true, max = 30,
}: VisualReferencePickerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  // Traemos TODO el catálogo (no filtrado) para poder resolver los IDs
  // seleccionados a sus URLs. Con debounce del server el costo es aceptable.
  const { data: allRefs = [] } = useVisualReferences();

  // Mapa id → ref para lookup rápido
  const refById = useMemo(() => {
    const m = new Map<number, VisualReference>();
    allRefs.forEach((r) => m.set(r.id, r));
    return m;
  }, [allRefs]);

  const selected = value.map((id) => refById.get(id)).filter((r): r is VisualReference => !!r);

  function removeOne(id: number) {
    onChange(value.filter((v) => v !== id));
  }

  function handleModalDone(nextIds: number[]) {
    onChange(nextIds.slice(0, max));
    setModalOpen(false);
  }

  const STRIP_HEIGHT = 64; // altura fija de la tira (en px)

  // ── Vista NO editable — tira horizontal continua ──────────────────────────
  if (!editable) {
    if (selected.length === 0) {
      return <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>—</span>;
    }
    return (
      <div style={{
        display: 'flex',
        gap: 0,
        borderRadius: 4,
        overflow: 'hidden',
        border: '0.5px solid rgba(255,255,255,0.12)',
        width: 'fit-content',
        maxWidth: '100%',
        height: STRIP_HEIGHT,
      }}>
        {selected.map((r) => (
          <img
            key={r.id}
            src={r.imageUrl}
            alt={r.name}
            title={r.name}
            style={{
              height: '100%', width: 'auto', objectFit: 'cover',
              display: 'block', flexShrink: 0,
            }}
          />
        ))}
      </div>
    );
  }

  // ── Modo edición — mismo look de tira + X en hover + botón "+" al lado ────
  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch', flexWrap: 'wrap' }}>
        {selected.length > 0 && (
          <div
            className="ficha-no-print"
            style={{
              display: 'flex',
              gap: 0,
              borderRadius: 4,
              overflow: 'hidden',
              border: '0.5px solid rgba(127,119,221,0.35)',
              height: STRIP_HEIGHT,
              maxWidth: '100%',
              flexWrap: 'nowrap',
            }}
          >
            {selected.map((r) => (
              <div
                key={r.id}
                className="ref-img-wrap"
                style={{ position: 'relative', flexShrink: 0, height: '100%' }}
              >
                <img
                  src={r.imageUrl}
                  alt={r.name}
                  title={r.name}
                  style={{
                    height: '100%', width: 'auto', objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <button
                  onClick={() => removeOne(r.id)}
                  title="Quitar"
                  className="ref-img-remove"
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(220,38,38,0.95)', color: '#fff',
                    border: '1px solid rgba(0,0,0,0.4)',
                    fontSize: 11, lineHeight: 1, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0, opacity: 0,
                    transition: 'opacity 0.15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Versión estática visible en print — misma tira sin botones */}
        {selected.length > 0 && (
          <div className="ficha-print-only" style={{
            display: 'none', gap: 0, flexWrap: 'nowrap',
            borderRadius: 3, overflow: 'hidden',
            border: '0.5px solid #ccc',
            height: STRIP_HEIGHT,
            maxWidth: '100%',
          }}>
            {selected.map((r) => (
              <img key={r.id} src={r.imageUrl} alt={r.name}
                style={{
                  height: '100%', width: 'auto', objectFit: 'cover',
                  display: 'block', flexShrink: 0,
                }} />
            ))}
          </div>
        )}

        {value.length < max && (
          <button
            onClick={() => setModalOpen(true)}
            className="ficha-no-print"
            title="Agregar referencia visual"
            style={{
              height: STRIP_HEIGHT, minWidth: STRIP_HEIGHT, padding: '0 12px',
              borderRadius: 4,
              border: `1px dashed ${ACCENT}88`,
              background: `${ACCENT}12`,
              color: ACCENT,
              cursor: 'pointer',
              fontSize: 20, lineHeight: 1, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            +
          </button>
        )}
      </div>

      {/* Estilo global: muestra la X al hover en cada imagen de la tira. */}
      <style>{`
        .ref-img-wrap:hover .ref-img-remove { opacity: 1 !important; }
      `}</style>

      {modalOpen && (
        <PickerModal
          initialSelected={value}
          onDone={handleModalDone}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ── PickerModal ───────────────────────────────────────────────────────────────

function PickerModal({
  initialSelected, onDone, onClose,
}: {
  initialSelected: number[];
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[820px] max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
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
          setSelected((prev) => new Set(prev).add(newId));
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
