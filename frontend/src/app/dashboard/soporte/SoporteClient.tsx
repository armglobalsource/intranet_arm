'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFeedbackList, useUpdateFeedbackStatus, useDeleteFeedback, FeedbackItem } from '@/hooks/useFeedback';
import { usePermissions } from '@/hooks/usePermissions';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FeedbackItem['status'] }) {
  const map = {
    open:        { label: 'Abierto',      bg: '#fef9c3', color: '#854d0e' },
    in_progress: { label: 'En progreso',  bg: '#dbeafe', color: '#1d4ed8' },
    resolved:    { label: 'Resuelto',     bg: '#dcfce7', color: '#166534' },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: FeedbackItem['type'] }) {
  return type === 'bug' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700">
      🐛 Problema
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
      💡 Sugerencia
    </span>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  onClose,
}: {
  item: FeedbackItem;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<FeedbackItem['status']>(item.status);
  const [note,   setNote]   = useState(item.note ?? '');
  const { mutate: updateStatus, isPending } = useUpdateFeedbackStatus();
  const { mutate: deleteFeedback } = useDeleteFeedback();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    updateStatus({ id: item.id, status, note: note.trim() || undefined }, { onSuccess: onClose });
  }

  function handleDelete() {
    deleteFeedback(item.id, { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: '#fff', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4"
          style={{ borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <TypeBadge type={item.type} />
              <StatusBadge status={item.status} />
            </div>
            <p className="text-xs text-gray-400">
              {item.userName} · {item.userEmail} · {new Date(item.createdAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all flex-shrink-0 ml-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Mensaje */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Mensaje</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
              {item.message}
            </p>
          </div>

          {/* Screenshot */}
          {item.screenshotUrl && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">Captura de pantalla</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={item.screenshotUrl} target="_blank" rel="noopener noreferrer">
                <img src={item.screenshotUrl} alt="screenshot"
                  className="w-full rounded-xl border border-gray-200 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ maxHeight: 200 }} />
              </a>
              <p className="text-[10px] text-gray-400 mt-1">Clic para ver en tamaño completo</p>
            </div>
          )}

          {/* Cambiar estado */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Estado</p>
            <div className="flex gap-2">
              {(['open', 'in_progress', 'resolved'] as const).map((s) => (
                <button key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                    status === s
                      ? s === 'open'        ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                      : s === 'in_progress' ? 'bg-blue-50 border-blue-300 text-blue-700'
                      :                       'bg-green-50 border-green-300 text-green-700'
                      : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {s === 'open' ? 'Abierto' : s === 'in_progress' ? 'En progreso' : 'Resuelto'}
                </button>
              ))}
            </div>
          </div>

          {/* Respuesta visible para la persona */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Respuesta al usuario <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Explica el avance, la solución o cualquier información que deba recibir la persona..."
              maxLength={500}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:bg-white resize-none transition-all"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Esta respuesta será visible en la app y generará una notificación.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between gap-3"
          style={{ borderTop: '1px solid #f3f4f6' }}>
          {confirmDelete ? (
            <>
              <p className="text-xs text-red-600 font-medium flex-1">¿Eliminar permanentemente?</p>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-all">
                Cancelar
              </button>
              <button onClick={handleDelete}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-all">
                Sí, eliminar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-all">
                Eliminar
              </button>
              <div className="flex gap-2 ml-auto">
                <button onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-all">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={isPending}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40"
                  style={{ background: '#111827' }}>
                  {isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function FeedbackRow({ item, onClick }: { item: FeedbackItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-all border-b border-gray-100 last:border-b-0 flex items-start gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <TypeBadge type={item.type} />
          <StatusBadge status={item.status} />
          <span className="text-[11px] text-gray-400 ml-auto">
            {new Date(item.createdAt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <p className="text-sm text-gray-800 font-medium truncate">{item.message}</p>
        <p className="text-xs text-gray-400 mt-0.5">{item.userName} · {item.userEmail}</p>
        {item.note && (
          <p className="text-xs text-blue-600 mt-1 truncate">Respuesta: {item.note}</p>
        )}
      </div>
      {item.screenshotUrl && (
        <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.screenshotUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'open' | 'in_progress' | 'resolved' | 'bug' | 'suggestion';

export function SoporteClient() {
  const router = useRouter();
  const { isAdmin } = usePermissions();
  const { data: items = [], isLoading } = useFeedbackList();
  const [filter,   setFilter]   = useState<Filter>('all');
  const [selected, setSelected] = useState<FeedbackItem | null>(null);

  useEffect(() => {
    if (!isAdmin) router.replace('/dashboard');
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  const filtered = items.filter((item) => {
    if (filter === 'all')         return true;
    if (filter === 'bug')         return item.type === 'bug';
    if (filter === 'suggestion')  return item.type === 'suggestion';
    return item.status === filter;
  });

  const counts = {
    all:         items.length,
    open:        items.filter((i) => i.status === 'open').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    resolved:    items.filter((i) => i.status === 'resolved').length,
    bug:         items.filter((i) => i.type === 'bug').length,
    suggestion:  items.filter((i) => i.type === 'suggestion').length,
  };

  const filterOpts: { value: Filter; label: string }[] = [
    { value: 'all',         label: `Todo (${counts.all})`             },
    { value: 'open',        label: `Abiertos (${counts.open})`        },
    { value: 'in_progress', label: `En progreso (${counts.in_progress})` },
    { value: 'resolved',    label: `Resueltos (${counts.resolved})`   },
    { value: 'bug',         label: `🐛 Problemas (${counts.bug})`     },
    { value: 'suggestion',  label: `💡 Sugerencias (${counts.suggestion})` },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Soporte</h1>
        <p className="text-sm text-gray-500 mt-1">Reportes y sugerencias de los usuarios</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {filterOpts.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filter === f.value
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm font-medium text-gray-600">Sin reportes en esta categoría</p>
            <p className="text-xs text-gray-400 mt-1">Todo bajo control por ahora.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <FeedbackRow key={item.id} item={item} onClick={() => setSelected(item)} />
          ))
        )}
      </div>

      {/* Panel de detalle */}
      {selected && (
        <DetailPanel item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
