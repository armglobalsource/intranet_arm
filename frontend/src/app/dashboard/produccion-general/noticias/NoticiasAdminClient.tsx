'use client';

import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useActiveCampuses } from '@/hooks/useCampus';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface MediaItem { type: 'image' | 'video' | 'instagram' | 'youtube'; url: string; caption?: string; }

interface Noticia {
  id:           number;
  title:        string;
  body:         string;
  excerpt?:     string;
  type:         string;
  status:       'draft' | 'published';
  campusId?:    string | null;
  imageUrl?:    string;
  videoUrl?:    string;
  instagramUrl?: string;
  mediaItems?:  MediaItem[];
  pinned?:      boolean;
  authorId:     number;
  createdAt:    string;
  updatedAt:    string;
  publishedAt?: string | null;
}

type NoticiaForm = Omit<Noticia, 'id' | 'authorId' | 'createdAt' | 'updatedAt'>;

const EMPTY_FORM: NoticiaForm = {
  title: '', body: '', excerpt: '', type: 'news',
  status: 'draft', campusId: null,
  imageUrl: '', videoUrl: '', instagramUrl: '',
  mediaItems: [], pinned: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(raw: string): string {
  const d = Math.floor((Date.now() - new Date(raw).getTime()) / 1000);
  if (d < 60) return 'Ahora mismo';
  if (d < 3600) return `Hace ${Math.floor(d / 60)} min`;
  if (d < 86400) return `Hace ${Math.floor(d / 3600)} h`;
  const days = Math.floor(d / 86400);
  if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;
  return new Date(raw).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function instagramId(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// ── Campus palette ─────────────────────────────────────────────────────────────

const CAMPUS_COLORS: Record<string, string> = {
  'santiago': '#6366F1', 'puente alto': '#0EA5E9', 'concepción': '#10B981',
  'punta arenas': '#F59E0B', 'la plata': '#EF4444', 'montevideo': '#8B5CF6',
  'katy': '#EC4899', 'maracaibo': '#F97316',
};
function campusColor(name: string): string {
  const n = name?.toLowerCase() ?? '';
  for (const [k, v] of Object.entries(CAMPUS_COLORS)) if (n.includes(k)) return v;
  return '#6B7280';
}

// ── Componentes UI ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'draft' | 'published' }) {
  return status === 'published' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Publicada
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Borrador
    </span>
  );
}

// ── MediaPreview ───────────────────────────────────────────────────────────────

function MediaPreview({ url, type }: { url: string; type: string }) {
  if (!url) return null;
  if (type === 'youtube' || youtubeId(url)) {
    const id = youtubeId(url);
    if (!id) return null;
    return (
      <div className="rounded-xl overflow-hidden aspect-video bg-black">
        <iframe src={`https://www.youtube.com/embed/${id}`}
          className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
      </div>
    );
  }
  if (type === 'instagram' || instagramId(url)) {
    const id = instagramId(url);
    if (!id) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 hover:border-pink-300 transition-colors group">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-700 group-hover:text-pink-600 transition-colors truncate">Ver en Instagram</p>
          <p className="text-[10px] text-gray-400 truncate">{url}</p>
        </div>
        <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    );
  }
  if (type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="w-full rounded-xl object-cover max-h-48" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    );
  }
  return null;
}

// ── NoticiaCard ────────────────────────────────────────────────────────────────

function NoticiaCard({
  noticia, campusName, onEdit, onDelete, onToggleStatus,
}: {
  noticia: Noticia;
  campusName?: string;
  onEdit: (n: Noticia) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (n: Noticia) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const cc = campusName ? campusColor(campusName) : '#6366F1';

  return (
    <div className="card p-0 overflow-hidden flex flex-col hover:shadow-md transition-all group">
      {/* Portada */}
      {noticia.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <div className="relative">
          <img src={noticia.imageUrl} alt={noticia.title}
            className="w-full h-36 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }} />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <StatusBadge status={noticia.status} />
          </div>
        </div>
      ) : (
        /* Sin portada: banda de color */
        <div className="h-1.5 w-full" style={{ background: noticia.campusId ? cc : '#6366F1' }} />
      )}

      <div className="p-4 flex-1 flex flex-col gap-2">
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {!noticia.imageUrl && <StatusBadge status={noticia.status} />}
          {noticia.pinned && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
              </svg>
              Destacado
            </span>
          )}
          {noticia.campusId ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${cc}15`, color: cc, border: `1px solid ${cc}30` }}>
              {campusName ?? `Campus ${noticia.campusId}`}
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
              🌐 Global
            </span>
          )}
        </div>

        {/* Título y excerpt */}
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug">{noticia.title}</h3>
          {noticia.excerpt && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{noticia.excerpt}</p>
          )}
        </div>

        {/* Media badges */}
        {(noticia.videoUrl || noticia.instagramUrl || (noticia.mediaItems?.length ?? 0) > 0) && (
          <div className="flex gap-1.5 flex-wrap">
            {noticia.videoUrl && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 flex items-center gap-0.5">
                ▶ Video
              </span>
            )}
            {noticia.instagramUrl && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-0.5"
                style={{ background: '#fdf2f8', color: '#be185d', borderColor: '#fbcfe8' }}>
                📸 Instagram
              </span>
            )}
            {(noticia.mediaItems?.length ?? 0) > 0 && (
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">
                +{noticia.mediaItems!.length} media
              </span>
            )}
          </div>
        )}

        {/* Fecha */}
        <p className="text-[10px] text-gray-400">{timeAgo(noticia.createdAt)}</p>
      </div>

      {/* Acciones */}
      {confirming ? (
        <div className="px-4 pb-4 flex flex-col gap-2">
          <p className="text-xs text-red-600 font-medium">¿Eliminar esta noticia?</p>
          <div className="flex gap-2">
            <button onClick={() => onDelete(noticia.id)}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
              Sí, eliminar
            </button>
            <button onClick={() => setConfirming(false)}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onToggleStatus(noticia)}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
              noticia.status === 'published'
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}>
            {noticia.status === 'published' ? 'Despublicar' : 'Publicar'}
          </button>
          <button onClick={() => onEdit(noticia)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
            Editar
          </button>
          <button onClick={() => setConfirming(true)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-gray-200">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ── FormField ──────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-[10px] text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

// ── SlideOver panel de creación/edición ────────────────────────────────────────

function NoticiaPanel({
  noticia, campuses, onClose, onSaved,
}: {
  noticia: Noticia | null;
  campuses: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!noticia;

  const [form, setForm] = useState<NoticiaForm>(
    noticia
      ? {
          title: noticia.title, body: noticia.body, excerpt: noticia.excerpt ?? '',
          type: noticia.type, status: noticia.status, campusId: noticia.campusId ?? null,
          imageUrl: noticia.imageUrl ?? '', videoUrl: noticia.videoUrl ?? '',
          instagramUrl: noticia.instagramUrl ?? '',
          mediaItems: noticia.mediaItems ?? [], pinned: noticia.pinned ?? false,
        }
      : { ...EMPTY_FORM },
  );

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [activeMedia, setActiveMedia] = useState<'none' | 'video' | 'instagram' | 'extra'>('none');

  const set = (k: keyof NoticiaForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSave(publishNow?: boolean) {
    if (!form.title.trim()) { setError('El título es requerido'); return; }
    if (!form.body.trim())  { setError('El cuerpo es requerido');  return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        type: 'news',
        campusId: form.campusId || null,
        status: publishNow ? 'published' : form.status,
        imageUrl:     form.imageUrl     || undefined,
        videoUrl:     form.videoUrl     || undefined,
        instagramUrl: form.instagramUrl || undefined,
      };
      if (isEdit) {
        await api.patch(`/content/${noticia!.id}`, payload);
      } else {
        await api.post('/content', payload);
      }
      qc.invalidateQueries({ queryKey: ['noticias-admin'] });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-xl z-50 flex flex-col bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F3F4F6' }}>
          <div>
            <h2 className="text-sm font-bold text-gray-900">{isEdit ? 'Editar noticia' : 'Nueva noticia'}</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Completa los campos y publica cuando esté lista</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Título */}
          <Field label="Título *">
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="Título de la noticia…"
              className="input text-sm" />
          </Field>

          {/* Resumen */}
          <Field label="Resumen" hint="Aparece en las tarjetas del dashboard (máx. 160 caracteres)">
            <textarea value={form.excerpt ?? ''} onChange={(e) => set('excerpt', e.target.value)}
              rows={2} maxLength={160} placeholder="Breve descripción…"
              className="input text-sm resize-none" />
          </Field>

          {/* Cuerpo */}
          <Field label="Contenido *">
            <textarea value={form.body} onChange={(e) => set('body', e.target.value)}
              rows={5} placeholder="Escribe el contenido completo de la noticia…"
              className="input text-sm resize-none" />
          </Field>

          {/* Imagen de portada */}
          <Field label="Imagen de portada" hint="URL de imagen (JPG, PNG, WebP)">
            <input value={form.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value)}
              placeholder="https://…"
              className="input text-sm" />
            {form.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="mt-2 w-full h-32 object-cover rounded-xl"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
          </Field>

          {/* Audiencia + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audiencia">
              <select value={form.campusId ?? ''} onChange={(e) => set('campusId', e.target.value || null)}
                className="input text-sm">
                <option value="">🌐 Global</option>
                {campuses.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Estado">
              <select value={form.status} onChange={(e) => set('status', e.target.value as any)}
                className="input text-sm">
                <option value="draft">Borrador</option>
                <option value="published">Publicada</option>
              </select>
            </Field>
          </div>

          {/* Destacado */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => set('pinned', !form.pinned)}
              className={`w-10 h-5 rounded-full transition-colors flex items-center ${form.pinned ? 'bg-amber-400' : 'bg-gray-200'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${form.pinned ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-xs font-medium text-gray-700">Marcar como destacado</span>
          </label>

          {/* Media adicional */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Contenido multimedia</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {[
                { key: 'video',     label: '▶ Video',      color: '#EF4444' },
                { key: 'instagram', label: '📸 Instagram',  color: '#be185d' },
                { key: 'extra',     label: '🖼 Más fotos',  color: '#6366F1' },
              ].map(({ key, label, color }) => (
                <button key={key}
                  onClick={() => setActiveMedia(activeMedia === key as any ? 'none' : key as any)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-all"
                  style={activeMedia === key
                    ? { background: `${color}12`, color, borderColor: `${color}40` }
                    : { background: '#F9FAFB', color: '#6B7280', borderColor: '#E5E7EB' }
                  }>
                  {label}
                </button>
              ))}
            </div>

            {activeMedia === 'video' && (
              <Field label="URL de video" hint="YouTube o Vimeo">
                <input value={form.videoUrl ?? ''} onChange={(e) => set('videoUrl', e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="input text-sm" />
                {form.videoUrl && <div className="mt-2"><MediaPreview url={form.videoUrl} type="youtube" /></div>}
              </Field>
            )}

            {activeMedia === 'instagram' && (
              <Field label="Post de Instagram" hint="URL de publicación o reel">
                <input value={form.instagramUrl ?? ''} onChange={(e) => set('instagramUrl', e.target.value)}
                  placeholder="https://www.instagram.com/p/…"
                  className="input text-sm" />
                {form.instagramUrl && <div className="mt-2"><MediaPreview url={form.instagramUrl} type="instagram" /></div>}
              </Field>
            )}

            {activeMedia === 'extra' && (
              <div className="space-y-2">
                {(form.mediaItems ?? []).map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={item.url} onChange={(e) => {
                      const items = [...(form.mediaItems ?? [])];
                      items[i] = { ...items[i], url: e.target.value };
                      set('mediaItems', items);
                    }} placeholder="URL de imagen…" className="input text-sm flex-1" />
                    <button onClick={() => set('mediaItems', (form.mediaItems ?? []).filter((_, j) => j !== i))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all border border-gray-200 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                <button onClick={() => set('mediaItems', [...(form.mediaItems ?? []), { type: 'image', url: '' }])}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                  + Agregar imagen
                </button>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer acciones */}
        <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid #F3F4F6' }}>
          <button onClick={() => handleSave()} disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 bg-gray-900 text-white hover:bg-black">
            {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar borrador'}
          </button>
          {(!isEdit || noticia?.status === 'draft') && (
            <button onClick={() => handleSave(true)} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-700">
              {saving ? '…' : '🚀 Publicar'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function NoticiasAdminClient() {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const { data: campuses = [] } = useActiveCampuses();

  const [panel,        setPanel]       = useState<Noticia | null | 'new'>(null);
  const [campusFilter, setCampusFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search,       setSearch]       = useState('');

  const qc = useQueryClient();

  const { data: noticias = [], isLoading, error } = useQuery<Noticia[]>({
    queryKey: ['noticias-admin'],
    queryFn:  () => api.get('/content/news').then((r) => r.data),
    staleTime: 30_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/content/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['noticias-admin'] }),
  });

  const toggleMut = useMutation({
    mutationFn: (n: Noticia) => api.patch(`/content/${n.id}`, {
      status: n.status === 'published' ? 'draft' : 'published',
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['noticias-admin'] }),
  });

  // Campus map id → nombre
  const campusMap = useMemo(() => {
    const m: Record<string, string> = {};
    campuses.forEach((c) => { m[String(c.id)] = c.name; });
    return m;
  }, [campuses]);

  const filtered = useMemo(() => {
    let list = noticias;
    if (campusFilter === 'global') list = list.filter((n) => !n.campusId);
    else if (campusFilter !== 'all') list = list.filter((n) => n.campusId === campusFilter);
    if (statusFilter !== 'all') list = list.filter((n) => n.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q) || (n.excerpt ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [noticias, campusFilter, statusFilter, search]);

  const stats = useMemo(() => ({
    total:     noticias.length,
    published: noticias.filter((n) => n.status === 'published').length,
    draft:     noticias.filter((n) => n.status === 'draft').length,
    global:    noticias.filter((n) => !n.campusId).length,
  }), [noticias]);

  if (!isAdmin) {
    return (
      <div className="card p-16 text-center">
        <p className="text-sm text-gray-500 font-medium">Solo administradores pueden acceder al publicador</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z"/>
                <polyline points="17 20 17 13 7 13 7 20"/>
                <polyline points="7 4 7 8 15 8"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Publicador de Noticias</h1>
          </div>
          <p className="text-gray-500 text-sm">Gestiona y publica noticias globales y por campus</p>
        </div>
        <button
          onClick={() => setPanel('new')}
          className="btn-primary flex items-center gap-2 text-sm flex-shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nueva noticia
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',      value: stats.total,     color: '#111827', bg: '#F9FAFB', border: '#E5E7EB' },
          { label: 'Publicadas', value: stats.published, color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
          { label: 'Borradores', value: stats.draft,     color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
          { label: 'Globales',   value: stats.global,    color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            <span className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</span>
            <span className="text-xs font-medium" style={{ color: s.color, opacity: 0.6 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" placeholder="Buscar noticia…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-9" />
        </div>

        {/* Campus filter */}
        <select value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} className="input text-sm flex-shrink-0 sm:w-44">
          <option value="all">Todos los campus</option>
          <option value="global">🌐 Global</option>
          {campuses.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>

        {/* Status filter */}
        <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg flex-shrink-0">
          {[['all', 'Todos'], ['published', 'Publicadas'], ['draft', 'Borradores']].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                statusFilter === v ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de noticias */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="card h-56 animate-pulse bg-gray-50" />)}
        </div>
      ) : error ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-gray-500">Error al cargar noticias</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700">
            {search || campusFilter !== 'all' || statusFilter !== 'all' ? 'Sin resultados' : 'No hay noticias aún'}
          </p>
          <p className="text-xs text-gray-400">
            {search || campusFilter !== 'all' || statusFilter !== 'all'
              ? 'Prueba con otros filtros'
              : 'Crea la primera noticia con el botón de arriba'}
          </p>
          {!search && campusFilter === 'all' && statusFilter === 'all' && (
            <button onClick={() => setPanel('new')} className="btn-primary text-sm mt-2">
              Crear primera noticia
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            {filtered.length} noticia{filtered.length !== 1 ? 's' : ''}
            {(search || campusFilter !== 'all' || statusFilter !== 'all') && ` · filtradas de ${noticias.length}`}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((n) => (
              <NoticiaCard
                key={n.id} noticia={n}
                campusName={n.campusId ? campusMap[n.campusId] : undefined}
                onEdit={(n) => setPanel(n)}
                onDelete={(id) => deleteMut.mutate(id)}
                onToggleStatus={(n) => toggleMut.mutate(n)}
              />
            ))}
          </div>
        </>
      )}

      {/* Panel lateral */}
      {panel !== null && (
        <NoticiaPanel
          noticia={panel === 'new' ? null : panel}
          campuses={campuses}
          onClose={() => setPanel(null)}
          onSaved={() => setPanel(null)}
        />
      )}
    </div>
  );
}
