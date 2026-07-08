// Next.js App Router loading UI — se muestra automáticamente durante la navegación
// antes de que FichaEditorClient hidrate y conecte el listener de Firestore.
// Usa el mismo FichaSkeleton que muestra el client component internamente.

const SK  = 'rgba(255,255,255,0.07)';
const SK2 = 'rgba(255,255,255,0.04)';

function Pulse({ w, h, r = 6, style }: { w?: string | number; h: number; r?: number; style?: React.CSSProperties }) {
  return (
    <div
      className="animate-pulse"
      style={{ width: w ?? '100%', height: h, borderRadius: r, background: SK, flexShrink: 0, ...style }}
    />
  );
}

function CardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ background: SK2, borderRadius: 14, padding: '18px 20px', border: '0.5px solid rgba(255,255,255,0.06)' }}>
      <Pulse w="45%" h={10} r={4} style={{ marginBottom: 18 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingBottom: 10,
              borderBottom: i < rows - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <Pulse w={`${30 + (i % 3) * 12}%`} h={9} r={4} />
            <Pulse w="28%" h={9} r={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

import React from 'react';

export default function FichaLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Breadcrumb */}
      <Pulse w={120} h={12} r={4} />

      {/* Card principal */}
      <div style={{ background: SK2, borderRadius: 16, border: '0.5px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <Pulse w={140} h={28} r={6} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <Pulse w={180} h={14} r={4} />
              <Pulse w={60} h={10} r={4} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pulse w="35%" h={20} r={5} />
            <div style={{ display: 'flex', gap: 8 }}>
              {[90, 80, 80, 90, 80].map((w, i) => (
                <Pulse key={i} w={w} h={32} r={8} />
              ))}
            </div>
          </div>
        </div>

        {/* Tabs de encuentros */}
        <div style={{ padding: '12px 28px', borderBottom: '0.5px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
          {[60, 110, 60].map((w, i) => (
            <Pulse key={i} w={w} h={28} r={20} />
          ))}
        </div>

        {/* Body — grid 2 columnas */}
        <div style={{ padding: '20px 28px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Columna izquierda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CardSkeleton rows={3} />
            <CardSkeleton rows={8} />
            <CardSkeleton rows={5} />
          </div>

          {/* Columna derecha */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* AR Worship card */}
            <div style={{ background: SK2, borderRadius: 14, padding: '18px 20px', border: '0.5px solid rgba(255,255,255,0.06)' }}>
              <Pulse w="50%" h={10} r={4} style={{ marginBottom: 18 }} />
              {/* Tiles posición */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, background: SK, borderRadius: 8, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                    <Pulse w="60%" h={8} r={3} />
                    <Pulse w="80%" h={11} r={4} />
                  </div>
                ))}
              </div>
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                  <Pulse w={`${25 + (i % 4) * 8}%`} h={9} r={4} />
                  <Pulse w="30%" h={9} r={4} />
                </div>
              ))}
              <div style={{ margin: '16px 0 12px', height: '0.5px', background: 'rgba(255,255,255,0.07)' }} />
              <Pulse w="30%" h={8} r={3} style={{ marginBottom: 12 }} />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: i < 3 ? '0.5px solid rgba(255,255,255,0.05)' : 'none', alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: SK, flexShrink: 0 }} />
                  <Pulse w={`${45 + (i % 3) * 15}%`} h={9} r={4} />
                </div>
              ))}
            </div>
            <CardSkeleton rows={5} />
          </div>
        </div>
      </div>
    </div>
  );
}
