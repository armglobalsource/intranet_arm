'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import './ficha-paper.css';

const PAPER_WIDTH = 794;

/** Keep the sheet's columns intact at every screen size; only its scale changes. */
export function FichaPaperViewport({ enabled, children, actions }: {
  enabled: boolean; children: ReactNode; actions?: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(PAPER_WIDTH);
  const [height, setHeight] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const fit = Math.min(1, width / PAPER_WIDTH);
  const scale = zoom ?? fit;

  useEffect(() => {
    if (!enabled || !viewportRef.current || !paperRef.current) return;
    const viewport = viewportRef.current;
    const paper = paperRef.current;
    const measure = () => {
      setWidth(viewport.clientWidth);
      setHeight(paper.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [enabled]);

  if (!enabled) return <>{children}</>;

  return <div className="ficha-paper-viewer">
    <div className="ficha-paper-toolbar ficha-no-print" aria-label="Opciones de lectura">
      <div className="ficha-paper-zoom" role="group" aria-label="Tamaño de la ficha">
        <button type="button" aria-label="Reducir ficha" disabled={scale <= 0.25} onClick={() => setZoom(Math.max(0.25, scale - 0.2))}>−</button>
        <output aria-live="polite" aria-label="Escala de la ficha">{Math.round(scale * 100)}%</output>
        <button type="button" aria-label="Ampliar ficha" disabled={scale >= 2} onClick={() => setZoom(Math.min(2, scale + 0.2))}>＋</button>
        <button type="button" aria-pressed={zoom === null} onClick={() => {
          setZoom(null);
          viewportRef.current?.scrollTo({ left: 0 });
        }}>Ajustar al ancho</button>
      </div>
      <div className="ficha-paper-actions">{actions}<button type="button" onClick={() => window.print()}>Imprimir / PDF</button></div>
    </div>
    <p className="ficha-paper-hint ficha-no-print">Vista documento · Amplía para leer los detalles. Puedes desplazar la hoja cuando esté ampliada.</p>
    <div className="ficha-paper-viewport" ref={viewportRef} role="region" aria-label="Documento de la ficha técnica" tabIndex={0}>
      <div className="ficha-paper-canvas" style={{ width: PAPER_WIDTH * scale, height: height ? height * scale : undefined }}>
        <div className="ficha-paper-content" ref={paperRef} style={{ width: PAPER_WIDTH, transform: `scale(${scale})`, position: height ? 'absolute' : 'relative' }}>
          {children}
        </div>
      </div>
    </div>
  </div>;
}
