'use client';

// Ventana emergente de la captura de reportes: en el teléfono sube desde abajo,
// al alcance del pulgar; en pantallas grandes queda centrada.

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function ReporteDialog({ title, tone = 'warning', onClose, children, actions }: {
  title: string;
  tone?: 'warning' | 'danger';
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') onClose();
    if (event.key !== 'Tab' || !panel.current) return;
    // El foco no sale de la ventana mientras esté abierta.
    const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>('button, a[href]'));
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <div className="stats-dialog-backdrop" onKeyDown={onKeyDown}>
      <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="stats-dialog">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className={`stats-dialog-icon ${tone === 'danger' ? 'stats-dialog-icon-danger' : ''}`}>!</span>
          <h2 id={titleId} className="min-w-0 pt-1 text-lg font-bold leading-snug text-slate-900">{title}</h2>
        </div>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
        <div className="mt-5 grid gap-2">{actions}</div>
      </div>
    </div>
  );
}
