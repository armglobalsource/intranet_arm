'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { clientDb } from '@/lib/firebase-client';
import { FichaDocumentView } from '@/app/dashboard/fichas-tecnicas/[fichaId]/FichaDocumentView';
import type { Ficha } from '@/types/ficha';

export function PublicFichaClient({ fichaId }: { fichaId: string }) {
  const [ficha, setFicha]   = useState<Ficha | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    const ref = doc(clientDb, 'fichas', fichaId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setError('Ficha no encontrada');
        } else {
          setFicha({ fichaId: snap.id, ...snap.data() } as unknown as Ficha);
        }
        setLoading(false);
      },
      () => {
        setError('No se pudo cargar la ficha');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [fichaId]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0d0d0d',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg style={{ animation: 'spin 1s linear infinite', color: '#555' }}
          width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !ficha) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0d0d0d',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8,
      }}>
        <p style={{ color: '#888', fontSize: 14 }}>{error ?? 'Ficha no encontrada'}</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', padding: '2rem 1rem' }}>
      {/* Header ARM Global */}
      <div style={{
        maxWidth: 900, margin: '0 auto 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(127,119,221,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#7F77DD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#888', letterSpacing: '0.05em' }}>
            ARM Global
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#444' }}>Vista de solo lectura</span>
      </div>

      {/* Ficha */}
      <FichaDocumentView ficha={ficha} />
    </div>
  );
}
