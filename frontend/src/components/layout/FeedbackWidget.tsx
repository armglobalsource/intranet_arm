'use client';

import { useState, useRef } from 'react';
import { useSubmitFeedback } from '@/hooks/useFeedback';

type FeedbackType = 'bug' | 'suggestion';

export function FeedbackWidget() {
  const [open,        setOpen]        = useState(false);
  const [type,        setType]        = useState<FeedbackType>('bug');
  const [message,     setMessage]     = useState('');
  const [screenshot,  setScreenshot]  = useState<File | null>(null);
  const [preview,     setPreview]     = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutate: submit, isPending } = useSubmitFeedback();

  function handleFile(file: File | null) {
    if (!file) return;
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!message.trim()) return;
    const form = new FormData();
    form.append('type', type);
    form.append('message', message.trim());
    if (screenshot) form.append('screenshot', screenshot);

    submit(form, {
      onSuccess: () => {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          setSuccess(false);
          setMessage('');
          setScreenshot(null);
          setPreview(null);
          setType('bug');
        }, 2000);
      },
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  }

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-20 right-5 w-[360px] rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
          style={{ background: '#fff', border: '1px solid #e5e7eb', maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <div>
              <p className="text-sm font-bold text-gray-900">Ayuda y sugerencias</p>
              <p className="text-xs text-gray-400 mt-0.5">Tu opinión nos ayuda a mejorar</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {success ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-emerald-600" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-bold text-gray-900">¡Recibido!</p>
              <p className="text-xs text-gray-500 mt-1">Gracias por tu reporte. Lo revisaremos pronto.</p>
            </div>
          ) : (
            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
              {/* Tipo */}
              <div className="flex gap-2">
                {([
                  { value: 'bug',        label: 'Problema',   icon: '🐛' },
                  { value: 'suggestion', label: 'Sugerencia', icon: '💡' },
                ] as const).map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      type === t.value
                        ? t.value === 'bug'
                          ? 'bg-red-50 border-red-300 text-red-700'
                          : 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <span>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  {type === 'bug' ? 'Describe el problema' : 'Describe tu sugerencia'}
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    type === 'bug'
                      ? 'Ej: Al hacer clic en guardar la página se queda cargando...'
                      : 'Ej: Sería útil poder filtrar las fichas por fecha...'
                  }
                  maxLength={2000}
                  className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:bg-white resize-none transition-all"
                />
                <p className="text-right text-[10px] text-gray-400 mt-0.5">{message.length}/2000</p>
              </div>

              {/* Screenshot */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Captura de pantalla <span className="font-normal text-gray-400">(opcional)</span>
                </label>

                {preview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="preview" className="w-full rounded-xl border border-gray-200 object-cover max-h-36" />
                    <button
                      onClick={() => { setScreenshot(null); setPreview(null); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-900/70 flex items-center justify-center text-white hover:bg-gray-900 transition-all"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all"
                  >
                    <svg className="w-5 h-5 text-gray-300 mx-auto mb-1" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p className="text-xs text-gray-400">Arrastra o <span className="text-gray-600 font-medium">selecciona</span> una imagen</p>
                  </div>
                )}
                <input
                  ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || isPending}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 text-white"
                style={{ background: type === 'bug' ? '#dc2626' : '#2563eb' }}
              >
                {isPending ? 'Enviando...' : type === 'bug' ? 'Reportar problema' : 'Enviar sugerencia'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Reportar problema o sugerencia"
        className="fixed bottom-5 right-5 w-12 h-12 rounded-full shadow-lg flex items-center justify-center z-50 transition-all hover:scale-110 active:scale-95"
        style={{ background: open ? '#1f2937' : '#111827' }}
      >
        {open ? (
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  );
}
