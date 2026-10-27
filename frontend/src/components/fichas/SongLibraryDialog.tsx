'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import type { Cancion } from '@/types/ficha';

/** La letra vive en el catálogo privado; no se copia a los enlaces públicos de ficha. */
export function SongLibraryDialog({ id, onClose, onUseKey }: { id: string; onClose: () => void; onUseKey?: (key: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const { can } = usePermissions();
  const client = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [version, setVersion] = useState<string | null>(null);
  const song = useQuery({ queryKey: ['canciones', 'detail', id], queryFn: ({ signal }) => api.get<Cancion>(`/canciones/${encodeURIComponent(id)}`, { signal }).then(r => r.data) });
  const save = useMutation({
    mutationFn: () => api.patch<Cancion>(`/canciones/${encodeURIComponent(id)}`, { tonalidad: key.trim(), letra: lyrics, expectedUpdatedAt: version }).then(r => r.data),
    onSuccess: data => { client.setQueryData(['canciones', 'detail', id], data); client.invalidateQueries({ queryKey: ['canciones'] }); setEditing(false); },
  });
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  function startEdit() { setKey(song.data?.tonalidad ?? ''); setLyrics(song.data?.letra ?? ''); setVersion(song.data?.revision ?? null); save.reset(); setEditing(true); }
  return createPortal(<dialog ref={dialog} aria-labelledby={title} onCancel={onClose} className="ficha-mobile-dialog w-[calc(100%-2rem)] max-w-xl rounded-2xl border-0 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-950/40" style={{ maxHeight: '90dvh' }}>
    <div className="ficha-dialog-body space-y-4 p-5">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Biblioteca de Worship</p><h2 id={title} className="mt-1 text-xl font-bold">{song.data?.titulo ?? 'Canción'}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar canción" className="rounded-lg px-3 py-1 hover:bg-slate-100">✕</button></div>
      {song.isPending ? <p role="status">Cargando canción…</p> : song.isError ? <div role="alert" className="text-sm text-red-700">{apiErrorMessage(song.error, 'No se pudo cargar la canción.')} <button type="button" className="underline" onClick={() => song.refetch()}>Reintentar</button></div> : editing ? <>
        <p className="text-sm text-slate-600">Los cambios se guardan en el catálogo compartido para futuras fichas. Las fichas existentes conservan su tono.</p>
        <label className="block text-sm font-semibold">Tono de referencia<input className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-normal" maxLength={20} value={key} onChange={e => setKey(e.target.value)} placeholder="Ej. G, Dm o Bb" /></label>
        <label className="block text-sm font-semibold">Letra<textarea className="mt-1 min-h-48 w-full rounded-lg border border-slate-300 p-3 font-normal" maxLength={30000} value={lyrics} onChange={e => setLyrics(e.target.value)} placeholder="Agrega la letra disponible para tu equipo…" /></label>
        {save.isError && <p role="alert" className="text-sm text-red-700">{apiErrorMessage(save.error, 'No se pudo guardar. Inténtalo de nuevo.')}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancelar</button><button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{save.isPending ? 'Guardando…' : 'Guardar en catálogo'}</button></div>
      </> : <>
        <p className="text-sm">Tono de referencia: <strong>{song.data.tonalidad || 'Sin registrar'}</strong></p>
        <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed">{song.data.letra || 'Esta canción aún no tiene letra registrada.'}</div>
        <div className="flex flex-wrap justify-end gap-2">{can('fichas:edit') && <button type="button" onClick={startEdit} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Editar catálogo</button>}{onUseKey && song.data.tonalidad && <button type="button" onClick={() => { onUseKey(song.data.tonalidad); onClose(); }} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Usar tono en esta ficha</button>}</div>
      </>}
    </div>
  </dialog>, document.body);
}
