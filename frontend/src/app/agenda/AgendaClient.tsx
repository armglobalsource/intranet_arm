'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { parseFichaDate } from '@/lib/ficha-date';
import { isRecent, relativeTime, sameLocalDay } from '@/lib/ficha-summary';
import { statusLabel, type FichaStatus } from '@/types/ficha';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.origin.includes('localhost')
    ? 'http://localhost:3001/api/v1'
    : '/api/v1');

const D = {
  bg:           '#0d0d0d',
  cardBg:       '#151515',
  cardBorder:   'rgba(255,255,255,0.09)',
  divider:      'rgba(255,255,255,0.06)',
  textPrimary:  '#f0efec',
  textSecond:   '#c4c1bc',
  textMuted:    '#7a7773',
  accent:       '#7F77DD',
};

type Encuentro = {
  id: string;
  label: string;
  time: string;
  isLive?: boolean;
  color?: string | null;
};

type FichaLite = {
  fichaId: string;
  campusId: string;
  campusName: string | null;
  type: 'unico' | 'multi' | 'oracion';
  title: string;
  date: any;
  encuentros: Encuentro[];
  status?: FichaStatus;
  publishedAt?: any;
  lastModifiedAt?: any;
};

const CAMPUS_KEY = 'agenda:campus';

function computeWeekRange(offset = 0): { start: Date; end: Date } {
  const now = new Date();
  const dow = now.getDay(); // 0=Dom, 1=Lun...6=Sáb
  const daysFromMonday = (dow + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysFromMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function formatWeekLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const startFmt = start.toLocaleDateString('es-CL', {
    day: 'numeric', month: sameMonth ? undefined : 'short',
  });
  const endFmt = end.toLocaleDateString('es-CL', {
    day: 'numeric', month: 'short',
  });
  return `Semana del ${startFmt} al ${endFmt}`;
}

function formatCardDate(raw: any): string {
  const d = parseFichaDate(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function typeBadge(type: FichaLite['type']): { label: string; bg: string; color: string } | null {
  if (type === 'oracion') return { label: 'Oración', bg: 'rgba(127,119,221,0.15)', color: '#B7B0F0' };
  return null;
}

// ── FichaCard ────────────────────────────────────────────────────────────────

function FichaCard({ ficha }: { ficha: FichaLite }) {
  const badge = typeBadge(ficha.type);
  const today = sameLocalDay(parseFichaDate(ficha.date), new Date());
  // Editada después de publicarse, en las últimas 48 h: quien ya la leyó debe revisarla.
  const changedAfterPublish = !!ficha.lastModifiedAt && !!ficha.publishedAt
    && new Date(ficha.lastModifiedAt).getTime() - new Date(ficha.publishedAt).getTime() > 60_000
    && isRecent(ficha.lastModifiedAt, 48);
  return (
    <Link
      href={`/ficha/${ficha.fichaId}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        background: D.cardBg,
        border: `0.5px solid ${today ? D.accent : D.cardBorder}`,
        borderRadius: 12,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'rgba(255,255,255,0.18)';
        el.style.background = '#1a1a1a';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = today ? D.accent : D.cardBorder;
        el.style.background = D.cardBg;
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 11, color: D.textSecond, textTransform: 'capitalize' }}>
          {today ? 'Hoy · ' : ''}{formatCardDate(ficha.date)}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              padding: '2px 8px', borderRadius: 999,
              background: badge.bg, color: badge.color, textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              {badge.label}
            </span>
          )}
          {ficha.status && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 999,
              background: ficha.status === 'complete' ? 'rgba(29,158,117,0.15)' : 'rgba(255,255,255,0.08)',
              color: ficha.status === 'complete' ? '#5DCAA5' : D.textSecond, textTransform: 'uppercase', flexShrink: 0,
            }}>
              {statusLabel(ficha.status)}
            </span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 16, fontWeight: 600, color: D.textPrimary, lineHeight: 1.25 }}>
        {ficha.title || 'Sin título'}
      </div>

      {ficha.encuentros.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
          {ficha.encuentros.map((enc) => (
            <div key={enc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                background: enc.color || D.accent, flexShrink: 0,
              }} />
              <span style={{ color: D.textPrimary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {enc.time}
              </span>
              <span style={{ color: D.textSecond }}>{enc.label}</span>
            </div>
          ))}
        </div>
      )}

      {ficha.lastModifiedAt && (
        <div style={{ fontSize: 11, color: changedAfterPublish ? '#F5C26B' : D.textMuted }}>
          {changedAfterPublish ? '● Cambios recientes · ' : ''}Actualizada {relativeTime(ficha.lastModifiedAt)}
        </div>
      )}

      <div style={{
        marginTop: 6, fontSize: 11, color: D.accent, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        Ver ficha
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}

// ── CampusSection ────────────────────────────────────────────────────────────

function CampusSection({ campusName, fichas }: { campusName: string; fichas: FichaLite[] }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16,
        paddingBottom: 8, borderBottom: `0.5px solid ${D.divider}`,
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: D.textPrimary, letterSpacing: '-0.01em', margin: 0 }}>
          {campusName}
        </h2>
        <span style={{ fontSize: 12, color: D.textMuted }}>
          {fichas.length} {fichas.length === 1 ? 'ficha' : 'fichas'}
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 12,
      }}>
        {fichas.map((f) => <FichaCard key={f.fichaId} ficha={f} />)}
      </div>
    </section>
  );
}

// ── AgendaClient ─────────────────────────────────────────────────────────────

export function AgendaClient() {
  const [fichas, setFichas]   = useState<FichaLite[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [offset, setOffset]   = useState(0);
  const [campus, setCampus]   = useState('');

  useEffect(() => {
    try { setCampus(localStorage.getItem(CAMPUS_KEY) ?? ''); } catch { /* sin almacenamiento */ }
  }, []);
  function chooseCampus(value: string) {
    setCampus(value);
    try { localStorage.setItem(CAMPUS_KEY, value); } catch { /* sin almacenamiento */ }
  }

  const week = useMemo(() => computeWeekRange(offset), [offset]);
  const weekLabel = useMemo(() => formatWeekLabel(week.start, week.end), [week]);
  const startParam = `${week.start.getFullYear()}-${String(week.start.getMonth() + 1).padStart(2, '0')}-${String(week.start.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`${API_BASE}/fichas/public/week?start=${startParam}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`);
        return r.json();
      })
      .then((data: FichaLite[]) => { setFichas(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [startParam]);

  const campusOptions = useMemo(
    () => Array.from(new Set((fichas ?? []).map((f) => f.campusName || 'Sin campus'))).sort((a, b) => a.localeCompare(b, 'es')),
    [fichas],
  );

  const byCampus = useMemo<Array<[string, FichaLite[]]>>(() => {
    if (!fichas) return [];
    const map = new Map<string, FichaLite[]>();
    for (const f of fichas.filter((x) => !campus || (x.campusName || 'Sin campus') === campus)) {
      const key = f.campusName || 'Sin campus';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    const entries = Array.from(map.entries());
    for (const [, arr] of entries) {
      arr.sort((a, b) => {
        const ad = parseFichaDate(a.date).getTime();
        const bd = parseFichaDate(b.date).getTime();
        return ad - bd;
      });
    }
    return entries.sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [fichas, campus]);

  const navBtn: React.CSSProperties = {
    minHeight: 36, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: 'rgba(255,255,255,0.06)', color: D.textPrimary, border: `0.5px solid ${D.cardBorder}`,
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: D.bg,
      color: D.textPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        html, body { background: ${D.bg}; }
        @keyframes agenda-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <header style={{
        maxWidth: 960, margin: '0 auto',
        padding: '32px 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <img
          src="/logo2.png"
          alt="ARM Global"
          style={{ height: 34, width: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 12 }}>
          <div style={{
            fontSize: 11, color: D.textMuted, textTransform: 'uppercase',
            letterSpacing: '0.14em', fontWeight: 600,
          }}>
            Agenda semanal
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: D.textPrimary,
            letterSpacing: '-0.02em', margin: 0, textTransform: 'capitalize',
          }}>
            {weekLabel}
          </h1>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button type="button" style={navBtn} onClick={() => setOffset((o) => o - 1)} aria-label="Semana anterior">← Anterior</button>
          <button type="button" style={{ ...navBtn, opacity: offset === 0 ? 0.5 : 1 }} disabled={offset === 0} onClick={() => setOffset(0)}>Esta semana</button>
          <button type="button" style={navBtn} onClick={() => setOffset((o) => o + 1)} aria-label="Semana siguiente">Siguiente →</button>
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: D.textSecond }}>
            Campus
            <select
              value={campus}
              onChange={(e) => chooseCampus(e.target.value)}
              style={{ ...navBtn, cursor: 'pointer', colorScheme: 'dark' }}
            >
              <option value="">Todos</option>
              {(campus && !campusOptions.includes(campus) ? [campus, ...campusOptions] : campusOptions).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '16px 20px 60px' }}>
        {loading && (
          <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}>
            <svg style={{ animation: 'agenda-spin 1s linear infinite', color: D.textMuted }}
              width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
        )}

        {!loading && error && (
          <div style={{
            padding: 20, borderRadius: 12,
            background: 'rgba(239,68,68,0.08)',
            border: '0.5px solid rgba(239,68,68,0.25)',
            color: '#FCA5A5', fontSize: 13,
          }}>
            No pudimos cargar la agenda. Intenta de nuevo en unos segundos.
          </div>
        )}

        {!loading && !error && byCampus.length === 0 && (
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            background: D.cardBg,
            border: `0.5px dashed ${D.cardBorder}`,
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: D.textPrimary, marginBottom: 6 }}>
              No hay fichas publicadas {campus ? `de ${campus} ` : ''}para esta semana
            </div>
            <div style={{ fontSize: 12, color: D.textSecond }}>
              Vuelve más tarde o consulta con el equipo de producción de tu campus.
            </div>
          </div>
        )}

        {!loading && !error && byCampus.length > 0 && (
          <>
            {byCampus.map(([campusName, list]) => (
              <CampusSection key={campusName} campusName={campusName} fichas={list} />
            ))}
          </>
        )}
      </main>

      <footer style={{
        maxWidth: 960, margin: '0 auto',
        padding: '20px', borderTop: `0.5px solid ${D.divider}`,
        fontSize: 11, color: D.textMuted, textAlign: 'center',
      }}>
        ARM Global · Agenda pública
      </footer>
    </div>
  );
}
