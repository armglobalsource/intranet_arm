'use client';

import { useEffect, useMemo, useState } from 'react';
import { SECTION_LABELS, statusLabel, type Encuentro, type Ficha, type Row, type SectionName } from '@/types/ficha';
import { parseFichaDate } from '@/lib/ficha-date';
import {
  describeChange, isRecent, nowAndNext, relativeTime, sameLocalDay, timingFor, type FichaChange,
} from '@/lib/ficha-summary';

/** Accesos de "¿Qué debo revisar yo?": cada uno lleva a su bloque de la ficha. */
const AREAS: { slot: string; label: string; sections: SectionName[] }[] = [
  { slot: 'horarios',    label: 'Timing',          sections: ['horarios'] },
  { slot: 'pastoral',    label: 'Pastoral',        sections: ['pastoral'] },
  { slot: 'produccion',  label: 'Producción',      sections: ['produccion'] },
  { slot: 'streaming',   label: 'Técnicos',        sections: ['streaming'] },
  { slot: 'worship',     label: 'Worship',         sections: ['escena', 'setList', 'outfit'] },
  { slot: 'media',       label: 'Media',           sections: ['media'] },
  { slot: 'voluntarios', label: 'Voluntarios',     sections: ['voluntarios'] },
  { slot: 'anuncios',    label: 'Noticias',        sections: ['anuncios'] },
];

function shortDate(raw: any) {
  if (!raw) return '';
  return parseFichaDate(raw).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' })
    .replace(/^\w/, (c) => c.toUpperCase());
}

function blockLabel(e: Encuentro | null): string | null {
  if (!e) return null;
  const fromLabel = /\b(AM|PM)\b/.exec(e.label ?? '')?.[1];
  if (fromLabel) return fromLabel;
  const h = Number(/^(\d{1,2})/.exec(e.time ?? '')?.[1]);
  return Number.isFinite(h) ? (h < 13 ? 'AM' : 'PM') : null;
}

const box = 'rounded-xl border border-[#DEE3EB] bg-white p-3.5';
const kicker = 'mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#69768B]';

export function FichaQuickView({
  ficha, rowsFor, colId, encuentro, hiddenSections, changes, onJump, onOpenLayout,
}: {
  ficha: Ficha;
  rowsFor: (section: SectionName) => Row[];
  colId: string;
  encuentro: Encuentro | null;
  hiddenSections: SectionName[];
  /** Historial (solo con sesión iniciada); la vista pública no lo recibe. */
  changes?: FichaChange[];
  onJump: (slot: string) => void;
  onOpenLayout: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  const hidden = (n: SectionName) => hiddenSections.includes(n);
  const moments = useMemo(() => timingFor(rowsFor('horarios'), colId), [rowsFor, colId]);
  const isToday = ficha.date ? sameLocalDay(parseFichaDate(ficha.date), now) : false;
  const { current, next } = nowAndNext(moments, now.getHours() * 60 + now.getMinutes());
  const highlights = (moments.some((m) => m.main) ? moments.filter((m) => m.main) : moments).slice(0, 5);

  const activeSections = (Object.keys(ficha.sections ?? {}) as SectionName[]).filter((n) => !hidden(n));
  const pending = activeSections.filter((n) => !(ficha.completionStatus?.[n] ?? ficha.sections?.[n]?.isCompleted));
  const lastChange = changes?.[0];
  const updatedBy = lastChange?.userName ?? ficha.lastModifiedByName;
  const recent = isRecent(ficha.lastModifiedAt, 48, now);
  const block = blockLabel(encuentro);

  return (
    <section aria-label="Lo esencial de la ficha" className="ficha-no-print ficha-quick-view mx-4 mt-4 sm:mx-8">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {/* 0-3 s: ¿Qué encuentro es? */}
        <div className={box}>
          <p className={kicker}>¿Qué encuentro es?</p>
          <p className="text-sm font-semibold text-[#243047]">{shortDate(ficha.date)}{encuentro?.time ? ` · ${encuentro.time}` : ''}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            {block && <span className="rounded-full bg-[#F1F3F8] px-2 py-0.5 text-[#526078]">{block}</span>}
            {encuentro?.label && <span className="rounded-full bg-[#F1F3F8] px-2 py-0.5 text-[#526078]">{encuentro.label}</span>}
            <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[#4338CA]">{statusLabel(ficha.status)}</span>
            <span className={`rounded-full px-2 py-0.5 ${ficha.published ? 'bg-[#E6F6EF] text-[#087F5B]' : 'bg-[#FFF4E5] text-[#9A5B00]'}`}>
              {ficha.published ? 'Publicada' : 'Sin publicar'}
            </span>
          </div>
          {(ficha.equipo?.encargadoTecnico || ficha.equipo?.responsableActualizacion) && (
            <dl className="mt-2 space-y-0.5 text-[11px] text-[#526078]">
              {ficha.equipo?.encargadoTecnico && (
                <div><dt className="inline font-semibold">Responde por la ficha:</dt> <dd className="inline">{ficha.equipo.encargadoTecnico.name}</dd></div>
              )}
              {ficha.equipo?.responsableActualizacion && (
                <div><dt className="inline font-semibold">Actualiza:</dt> <dd className="inline">{ficha.equipo.responsableActualizacion.name}</dd></div>
              )}
            </dl>
          )}
        </div>

        {/* 3-8 s: ¿Qué va a suceder? */}
        <div className={box}>
          <p className={kicker}>¿Qué va a suceder?</p>
          {isToday && (current || next) && (
            <p className="mb-2 rounded-lg bg-[#EEF2FF] px-2 py-1.5 text-xs text-[#243047]">
              {current && <><strong>Ahora:</strong> {current.label}</>}
              {current && next && ' · '}
              {next && <><strong>Próximo:</strong> {next.time} {next.label} (en {next.minutes - (now.getHours() * 60 + now.getMinutes())} min)</>}
            </p>
          )}
          {highlights.length ? (
            <ol className="space-y-1">
              {highlights.map((m) => (
                <li key={m.id} className="flex gap-2 text-xs text-[#243047]">
                  <span className="w-[74px] shrink-0 font-mono text-[#526078]">{m.time}</span>
                  <span className={m.main ? 'font-semibold' : ''}>{m.label}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-xs text-[#69768B]">El timing todavía no tiene horas.</p>}
          {!hidden('horarios') && (
            <button type="button" onClick={() => onJump('horarios')} className="mt-2 text-xs font-semibold text-[#4338CA] hover:underline">
              Ver timing completo{moments.length > highlights.length ? ` (${moments.length} momentos)` : ''} →
            </button>
          )}
        </div>

        {/* 8-12 s: ¿Qué cambió? */}
        <div className={box}>
          <p className={kicker}>¿Qué cambió?</p>
          {ficha.lastModifiedAt && (
            <p className="text-xs text-[#243047]">
              {recent && <span className="mr-1.5 rounded-full bg-[#FFF4E5] px-2 py-0.5 text-[10px] font-bold text-[#9A5B00]">Cambios recientes</span>}
              Actualizada {relativeTime(ficha.lastModifiedAt, now)}{updatedBy ? ` por ${updatedBy}` : ''}
            </p>
          )}
          {changes?.slice(0, 2).map((c) => (
            <p key={c.document_id} className="mt-1 truncate text-xs text-[#526078]" title={describeChange(c, SECTION_LABELS).details.join('\n')}>
              • {describeChange(c, SECTION_LABELS).title}
            </p>
          ))}
          <p className="mt-1.5 text-xs text-[#526078]">
            {pending.length ? <>Faltan por completar: <strong>{pending.map((n) => SECTION_LABELS[n]).join(', ')}</strong></> : 'Todas las secciones están completas.'}
          </p>
          {!!changes?.length && (
            <button type="button" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}
              className="mt-2 text-xs font-semibold text-[#4338CA] hover:underline">
              {showHistory ? 'Ocultar historial' : `Ver historial (${changes.length})`}
            </button>
          )}
        </div>

        {/* 12-15 s: ¿Qué debo revisar? */}
        <div className={box}>
          <p className={kicker}>¿Qué debo revisar?</p>
          <div className="flex flex-wrap gap-1.5">
            {AREAS.filter((a) => a.sections.some((s) => activeSections.includes(s))).map((a) => {
              const done = a.sections.filter((s) => activeSections.includes(s)).every((s) => ficha.completionStatus?.[s]);
              const owner = a.sections.map((s) => ficha.sections?.[s]?.assignedName).find(Boolean);
              return (
                <button key={a.slot} type="button" onClick={() => onJump(a.slot)}
                  title={owner ? `Responsable: ${owner}` : undefined}
                  className="min-h-[32px] rounded-lg border border-[#CCD4E1] bg-white px-2.5 text-xs font-semibold text-[#243047] hover:bg-[#F4F6F9]">
                  {done && <span className="mr-1 text-[#087F5B]" aria-label="completa">✓</span>}{a.label}
                  {owner && <span className="ml-1 font-normal text-[#69768B]">· {owner.split(' ')[0]}</span>}
                </button>
              );
            })}
            <button type="button" onClick={onOpenLayout}
              className="min-h-[32px] rounded-lg border border-[#CCD4E1] bg-white px-2.5 text-xs font-semibold text-[#243047] hover:bg-[#F4F6F9]">
              Layout Visual
            </button>
          </div>
        </div>
      </div>

      {showHistory && !!changes?.length && (
        <div className={`${box} mt-3`}>
          <p className={kicker}>Historial de cambios</p>
          <ol className="divide-y divide-[#EDF0F4]">
            {changes.map((c) => {
              const d = describeChange(c, SECTION_LABELS);
              return (
                <li key={c.document_id} className="py-2">
                  <p className="text-xs text-[#243047]"><strong>{c.userName ?? 'Alguien'}</strong> · {d.title}
                    <span className="ml-1 text-[#69768B]">· {relativeTime(c.timestamp, now)}</span></p>
                  {d.details.slice(0, 6).map((line, i) => <p key={i} className="ml-3 mt-0.5 text-xs text-[#526078]">{line}</p>)}
                  {d.details.length > 6 && <p className="ml-3 mt-0.5 text-xs text-[#69768B]">+{d.details.length - 6} cambios más</p>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
