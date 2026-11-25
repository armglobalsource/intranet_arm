'use client';
// Lector de QR con la cámara del teléfono (puerta y mesa de equipaje), con campo para escribir el código a mano.
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Camera, QrCode } from 'lucide-react';
import { ticketCodeIn } from './attendance';
import a from './event-attendance.module.css';

/** Tono corto y vibración: agudo si salió bien, grave si no. */
export function feedback(ok: boolean) {
  try { navigator.vibrate?.(ok ? 80 : [120, 80, 120]); } catch { /* sin vibración */ }
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220; gain.gain.value = 0.08;
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
    osc.onended = () => void ctx.close();
  } catch { /* sin sonido */ }
}

type Detector = (source: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>;
/** Usa el lector nativo del navegador si existe (Chrome/Android) y, si no, jsQR (iPhone). */
async function makeDetector(): Promise<Detector> {
  const Native = (window as any).BarcodeDetector;
  if (Native) {
    try {
      if ((await Native.getSupportedFormats?.())?.includes('qr_code')) {
        const detector = new Native({ formats: ['qr_code'] });
        return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
      }
    } catch { /* se usa jsQR */ }
  }
  const jsQR = (await import('jsqr')).default;
  return async (video, canvas) => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 720 / Math.max(w, h));
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

export function QrScanner({ paused, overlay, idleText, readyText, busyText, busy, manualLabel, manualPlaceholder, onCode }: {
  paused: boolean; overlay?: ReactNode; idleText: string; readyText: string; busyText: string; busy: boolean;
  manualLabel: string; manualPlaceholder: string; onCode: (code: string) => Promise<void> | void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const pausedRef = useRef(false);
  const [state, setState] = useState<'idle' | 'starting' | 'on' | 'error'>('idle');
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  pausedRef.current = paused;
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  async function start() {
    setError(''); setState('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.current = media;
      const el = video.current!;
      el.srcObject = media; await el.play();
      setState('on');
      try { await (navigator as any).wakeLock?.request('screen'); } catch { /* la pantalla puede apagarse */ }
      const detect = await makeDetector();
      canvas.current ??= document.createElement('canvas');
      const loop = async () => {
        if (!stream.current) return;
        if (!pausedRef.current && el.readyState >= 2) {
          try {
            const text = await detect(el, canvas.current!);
            if (text) {
              // El mismo código frente a la cámara no se envía dos veces seguidas.
              const key = ticketCodeIn(text) ?? text;
              const now = Date.now();
              if (key !== last.current.code || now - last.current.at > 8000) {
                last.current = { code: key, at: now };
                await onCodeRef.current(key);
              }
            }
          } catch { /* cuadro ilegible: se intenta con el siguiente */ }
        }
        setTimeout(() => requestAnimationFrame(() => void loop()), 120);
      };
      void loop();
    } catch (err) {
      stop(); setState('error');
      const name = (err as any)?.name;
      setError(name === 'NotAllowedError' ? 'No tenemos permiso para usar la cámara. Actívalo en el candado de la barra de direcciones o escribe el código.'
        : name === 'NotFoundError' ? 'Este dispositivo no tiene cámara disponible. Escribe el código o busca por nombre.'
          : 'No pudimos abrir la cámara. Escribe el código o busca por nombre.');
    }
  }

  return (
    <>
      <div className={a.camera}>
        <video ref={video} playsInline muted aria-label="Vista de la cámara" />
        {state === 'on' && <div className={a.frame} aria-hidden="true" />}
        {state !== 'on' && (
          <div className={a.cameraIdle}>
            {state === 'error' ? <Camera size={40} aria-hidden="true" /> : <QrCode size={44} aria-hidden="true" />}
            <p>{state === 'error' ? error : idleText}</p>
            <button type="button" className={a.btnPrimary} onClick={() => void start()} disabled={state === 'starting'}><Camera size={18} aria-hidden="true" />{state === 'starting' ? 'Abriendo cámara…' : state === 'error' ? 'Intentar de nuevo' : 'Activar cámara'}</button>
          </div>
        )}
        {overlay}
      </div>
      <p className={a.scanHint}>{state === 'on' ? (busy ? busyText : readyText) : ''}</p>
      <form className={a.searchBox} style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { void onCode(manual.trim()); setManual(''); } }}>
        <label className="sr-only" htmlFor="scanner-code">{manualLabel}</label>
        <QrCode size={17} aria-hidden="true" />
        <input id="scanner-code" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={manualPlaceholder} autoComplete="off" />
      </form>
    </>
  );
}
