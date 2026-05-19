'use client';

import Link from 'next/link';
import { useFichaRealtime } from '@/hooks/useFichas';
import { SECTION_LABELS, statusColor, statusLabel } from '@/types/ficha';
import type { Ficha, Section, Row, SectionName, Encuentro } from '@/types/ficha';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(raw: any): string {
  if (!raw) return '—';
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  else if (raw instanceof Date) d = raw;
  else d = new Date(raw.seconds * 1000);
  return d.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatTime(raw: any): string {
  if (!raw) return '';
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else d = new Date(raw.seconds * 1000);
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

// ── SectionTable ──────────────────────────────────────────────────────────────

function SectionTable({
  sectionName,
  section,
  encuentros,
}: {
  sectionName: SectionName;
  section: Section;
  encuentros: Encuentro[];
}) {
  const rows = [...(section.rows ?? [])].sort((a, b) => a.order - b.order);
  if (rows.length === 0) return null;

  // Columnas: para filas compartidas es 1 columna, para no compartidas es una por encuentro
  const hasMultiCol = rows.some((r) => !r.shared);
  const cols = hasMultiCol ? encuentros : [];

  return (
    <div className="section-block">
      {/* Header de sección */}
      <div className="section-header">
        <span className="section-title">{SECTION_LABELS[sectionName]}</span>
        {section.isCompleted && (
          <span className="section-complete-badge">✓ Completada</span>
        )}
      </div>

      {/* Tabla */}
      <table className="section-table">
        {hasMultiCol && cols.length > 0 && (
          <thead>
            <tr>
              <th className="col-label" />
              {cols.map((e) => (
                <th key={e.id} className="col-encuentro" style={{ color: e.color }}>
                  {e.label}
                  <span className="encuentro-time">{e.time}</span>
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row) => {
            if (row.shared) {
              const val = row.values?.['shared'] ?? row.values?.[encuentros[0]?.id] ?? '—';
              return (
                <tr key={row.id}>
                  <td className="row-label">{row.label}</td>
                  <td className="row-value-shared" colSpan={cols.length || 1}>
                    {val || <span className="empty-val">—</span>}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={row.id}>
                <td className="row-label">{row.label}</td>
                {encuentros.map((e) => (
                  <td key={e.id} className="row-value">
                    {row.values?.[e.id] || <span className="empty-val">—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Orden de secciones ────────────────────────────────────────────────────────

const SECTION_ORDER: SectionName[] = [
  'pastoral', 'escena', 'produccion', 'streaming', 'setList', 'horarios', 'anuncios', 'voluntarios',
];

// ── Main ──────────────────────────────────────────────────────────────────────

export function FichaViewClient({ fichaId }: { fichaId: string }) {
  const { ficha, loading, error } = useFichaRealtime(fichaId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <svg className="w-6 h-6 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-500 text-sm mb-4">{error ?? 'Ficha no encontrada'}</p>
        <Link href="/dashboard/fichas-tecnicas" className="btn-secondary text-sm">
          ← Volver al hub
        </Link>
      </div>
    );
  }

  const { bg, text } = statusColor(ficha.status);

  return (
    <>
      {/* ── Estilos de la vista/impresión ─────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-container { padding: 0 !important; margin: 0 !important; }
          .section-block { break-inside: avoid; }
        }

        .section-block {
          margin-bottom: 1.25rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1rem;
          background: #111827;
          color: white;
        }
        .section-title {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .section-complete-badge {
          font-size: 0.6rem;
          font-weight: 600;
          color: #6ee7b7;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .section-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.78rem;
        }
        .section-table thead th {
          padding: 0.35rem 0.75rem;
          background: #f9fafb;
          font-weight: 600;
          font-size: 0.68rem;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        .col-label { width: 30%; }
        .col-encuentro {
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 0.65rem !important;
        }
        .encuentro-time {
          display: block;
          font-weight: 400;
          color: #6b7280;
          font-size: 0.6rem;
          margin-top: 1px;
        }
        .section-table tbody tr {
          border-bottom: 1px solid #f3f4f6;
        }
        .section-table tbody tr:last-child { border-bottom: none; }
        .section-table tbody tr:nth-child(even) { background: #fafafa; }
        .row-label {
          padding: 0.45rem 0.75rem;
          color: #374151;
          font-weight: 500;
          width: 30%;
          vertical-align: top;
        }
        .row-value, .row-value-shared {
          padding: 0.45rem 0.75rem;
          color: #111827;
          vertical-align: top;
        }
        .empty-val { color: #d1d5db; font-style: italic; }
      `}</style>

      <div className="print-container max-w-4xl mx-auto space-y-5">

        {/* ── Barra superior (no imprime) ────────────────────────────────── */}
        <div className="no-print flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/fichas-tecnicas/${fichaId}`}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>
            <span className="text-sm text-gray-500">Vista de ficha</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/fichas-tecnicas/${fichaId}`}
              className="btn-secondary text-xs py-1.5 px-3">
              Editar
            </Link>
            <button
              onClick={() => window.print()}
              className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Imprimir / PDF
            </button>
          </div>
        </div>

        {/* ── Encabezado de la ficha ─────────────────────────────────────── */}
        <div className="card px-6 py-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{ficha.title}</h1>
              <p className="text-sm text-gray-500 mt-0.5 capitalize">{formatDate(ficha.date)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{ficha.campusName}</p>
            </div>
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex-shrink-0"
              style={{ background: bg, color: text }}
            >
              {statusLabel(ficha.status)}
            </span>
          </div>

          {/* Encuentros */}
          {ficha.encuentros?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
              {ficha.encuentros.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium"
                  style={{ borderColor: e.color + '40', color: e.color, background: e.color + '10' }}
                >
                  <span className="font-semibold">{e.label}</span>
                  <span className="opacity-60 font-normal">{e.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Secciones ─────────────────────────────────────────────────── */}
        {SECTION_ORDER.map((name) => {
          const section = ficha.sections?.[name];
          if (!section) return null;
          return (
            <SectionTable
              key={name}
              sectionName={name}
              section={section}
              encuentros={ficha.encuentros ?? []}
            />
          );
        })}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="text-center py-4">
          <p className="text-[11px] text-gray-300">
            Creada por <span className="text-gray-400">{ficha.createdByName}</span>
            {ficha.lastModifiedAt && (
              <> · Última modificación: <span className="text-gray-400">{formatDate(ficha.lastModifiedAt)}</span></>
            )}
          </p>
        </div>

      </div>
    </>
  );
}
