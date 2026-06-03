'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useFichaRealtime, useUpdateSection, useCompleteSection, useArchiveFicha, useUnarchiveFicha, useUpdateFicha, usePublishFicha, useUnpublishFicha } from '@/hooks/useFichas';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/lib/store/auth.store';
import { FichaDocumentView } from './FichaDocumentView';
import { DisponibilidadSideCard } from '@/components/fichas/DisponibilidadSideCard';
import type { Row, SectionName, Section } from '@/types/ficha';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Skeleton de carga ─────────────────────────────────────────────────────────

const SK = 'rgba(255,255,255,0.07)';
const SK2 = 'rgba(255,255,255,0.04)';

function Pulse({ w, h, r = 6, style }: { w?: string | number; h: number; r?: number; style?: React.CSSProperties }) {
  return (
    <div className="animate-pulse" style={{ width: w ?? '100%', height: h, borderRadius: r, background: SK, flexShrink: 0, ...style }} />
  );
}

function CardSkeleton({ rows = 5, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div style={{ background: SK2, borderRadius: 14, padding: '18px 20px', border: '0.5px solid rgba(255,255,255,0.06)' }}>
      {title && <Pulse w="45%" h={10} r={4} style={{ marginBottom: 18 }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: i < rows - 1 ? '0.5px solid rgba(255,255,255,0.05)' : 'none' }}>
            <Pulse w={`${30 + (i % 3) * 12}%`} h={9} r={4} />
            <Pulse w="28%" h={9} r={4} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FichaSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Breadcrumb */}
      <Pulse w={120} h={12} r={4} />

      {/* Card principal */}
      <div style={{ background: SK2, borderRadius: 16, border: '0.5px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            {/* Logo */}
            <Pulse w={140} h={28} r={6} />
            {/* Fecha */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <Pulse w={180} h={14} r={4} />
              <Pulse w={60} h={10} r={4} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pulse w="35%" h={20} r={5} />
            {/* Botones */}
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
            {/* AR Worship card — más alto */}
            <div style={{ background: SK2, borderRadius: 14, padding: '18px 20px', border: '0.5px solid rgba(255,255,255,0.06)' }}>
              <Pulse w="50%" h={10} r={4} style={{ marginBottom: 18 }} />
              {/* Tiles de posición */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, background: SK, borderRadius: 8, padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                    <Pulse w="60%" h={8} r={3} />
                    <Pulse w="80%" h={11} r={4} />
                  </div>
                ))}
              </div>
              {/* Músicos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
                    <Pulse w={`${25 + (i % 4) * 8}%`} h={9} r={4} />
                    <Pulse w="30%" h={9} r={4} />
                  </div>
                ))}
              </div>
              {/* Set List divider */}
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

// ── FichaEditorClient ─────────────────────────────────────────────────────────

export function FichaEditorClient({ fichaId }: { fichaId: string }) {
  const { can, isAdmin } = usePermissions();
  const { user } = useAuthStore();
  const { ficha, loading, error } = useFichaRealtime(fichaId);
  const [saveState, setSaveState]       = useState<SaveState>('idle');
  const [localSections, setLocalSections] =
    useState<Partial<Record<SectionName, Row[]>>>({});

  // Un debounce ref por sección
  const debounceRefs =
    useRef<Partial<Record<SectionName, ReturnType<typeof setTimeout>>>>({});

  const [isEditing, setIsEditing]             = useState(true);
  const [transitioningToEdit, setTransitioningToEdit] = useState(false);

  const { mutate: updateSection } = useUpdateSection();
  const { mutate: completeSection } = useCompleteSection();
  const { mutate: archiveFicha } = useArchiveFicha();
  const { mutate: unarchiveFicha } = useUnarchiveFicha();
  const { mutate: updateFicha } = useUpdateFicha();
  const { mutate: publishFicha,   isPending: isPublishing  } = usePublishFicha();
  const { mutate: unpublishFicha, isPending: isUnpublishing } = useUnpublishFicha();

  function handleToggleModule(name: SectionName) {
    if (!ficha) return;
    const current = ficha.hiddenSections ?? [];
    const next = current.includes(name)
      ? current.filter((s) => s !== name)
      : [...current, name];
    updateFicha({ fichaId: ficha.fichaId, hiddenSections: next });
  }

  function handleUpdateLayout(layout: { left: string[]; right: string[] }) {
    if (!ficha) return;
    updateFicha({ fichaId: ficha.fichaId, sectionLayout: layout });
  }

  // ── Sincronizar filas desde Firestore ──────────────────────────────────────
  // Solo sincronizamos secciones que NO tienen una edición pendiente
  useEffect(() => {
    if (!ficha?.sections) return;
    setLocalSections((prev) => {
      const next = { ...prev };
      for (const [k, sec] of Object.entries(ficha.sections!)) {
        if (!debounceRefs.current[k as SectionName]) {
          next[k as SectionName] = (sec as Section).rows ?? [];
        }
      }
      return next;
    });
  }, [ficha?.sections]);

  const canEdit    = isAdmin || can('fichas:edit') || can('fichas:admin');
  const canPublish = ficha ? (isAdmin || can('fichas:admin') || ficha.createdBy === user?.id) : false;
  const editable = canEdit && isEditing;

  // ── Status de secciones ────────────────────────────────────────────────────
  const sectionStatus = Object.fromEntries(
    Object.entries(ficha?.sections ?? {}).map(([k, sec]) => [k, (sec as Section).isCompleted ?? false]),
  ) as Partial<Record<SectionName, boolean>>;

  // ── Guardar sección con debounce ───────────────────────────────────────────
  const scheduleSave = useCallback(
    (sectionName: SectionName, rows: Row[], immediate = false) => {
      if (debounceRefs.current[sectionName]) {
        clearTimeout(debounceRefs.current[sectionName]!);
      }
      setSaveState('saving');
      debounceRefs.current[sectionName] = setTimeout(() => {
        updateSection(
          { fichaId, sectionName, rows },
          {
            onSuccess: () => {
              debounceRefs.current[sectionName] = undefined;
              setSaveState('saved');
              setTimeout(() => setSaveState('idle'), 2000);
            },
            onError: () => {
              debounceRefs.current[sectionName] = undefined;
              setSaveState('error');
              setTimeout(() => setSaveState('idle'), 3000);
            },
          },
        );
      }, immediate ? 0 : 800);
    },
    [fichaId, updateSection],
  );

  // ── Cambio de celda ────────────────────────────────────────────────────────
  const handleCellChange = useCallback(
    (sectionName: SectionName, rowId: string, colId: string, value: string) => {
      setLocalSections((prev) => {
        const rows = prev[sectionName] ?? [];
        const updated = rows.map((r) =>
          r.id === rowId ? { ...r, values: { ...r.values, [colId]: value } } : r,
        );
        // Capturamos `updated` en el closure del debounce
        scheduleSave(sectionName, updated);
        return { ...prev, [sectionName]: updated };
      });
    },
    [scheduleSave],
  );

  // ── Agregar fila ───────────────────────────────────────────────────────────
  const handleAddRow = useCallback(
    (sectionName: SectionName, label: string, type: Row['type'], shared: boolean) => {
      setLocalSections((prev) => {
        const rows = prev[sectionName] ?? [];
        const newRow: Row = {
          id:       `custom_${uid()}`,
          label,
          type,
          shared,
          values:   {},
          order:    rows.length,
          required: false,
        };
        const updated = [...rows, newRow];
        scheduleSave(sectionName, updated, true);
        return { ...prev, [sectionName]: updated };
      });
    },
    [scheduleSave],
  );

  // ── Eliminar fila ──────────────────────────────────────────────────────────
  const handleDeleteRow = useCallback(
    (sectionName: SectionName, rowId: string) => {
      setLocalSections((prev) => {
        const rows = prev[sectionName] ?? [];
        const updated = rows.filter((r) => r.id !== rowId);
        scheduleSave(sectionName, updated, true);
        return { ...prev, [sectionName]: updated };
      });
    },
    [scheduleSave],
  );

  // ── Reordenar fila (drag & drop) ───────────────────────────────────────────
  const handleReorderRow = useCallback(
    (sectionName: SectionName, fromIndex: number, toIndex: number) => {
      setLocalSections((prev) => {
        const sorted = [...(prev[sectionName] ?? [])].sort((a, b) => a.order - b.order);
        const [moved] = sorted.splice(fromIndex, 1);
        sorted.splice(toIndex, 0, moved);
        // Reasignar campo order para reflejar el nuevo orden
        const updated = sorted.map((r, i) => ({ ...r, order: i }));
        scheduleSave(sectionName, updated, true);
        return { ...prev, [sectionName]: updated };
      });
    },
    [scheduleSave],
  );

  // ── Guardar todo de inmediato ──────────────────────────────────────────────
  const handleSaveAll = useCallback(() => {
    // Recopilar todas las secciones con guardado pendiente
    const pending: { sectionName: SectionName; rows: Row[] }[] = [];
    for (const [sectionName, timeout] of Object.entries(debounceRefs.current)) {
      if (timeout) {
        clearTimeout(timeout);
        debounceRefs.current[sectionName as SectionName] = undefined;
        const rows = localSections[sectionName as SectionName];
        if (rows) pending.push({ sectionName: sectionName as SectionName, rows });
      }
    }

    if (!pending.length) {
      // Sin cambios pendientes: salir del modo edición directamente
      setSaveState('saved');
      setTimeout(() => { setSaveState('idle'); setIsEditing(false); }, 800);
      return;
    }

    // Guardar todas las secciones en paralelo y esperar a que TODAS terminen
    setSaveState('saving');
    let done = 0;
    let hasError = false;

    for (const { sectionName, rows } of pending) {
      updateSection(
        { fichaId, sectionName, rows },
        {
          onSuccess: () => {
            done++;
            if (done === pending.length) {
              setSaveState(hasError ? 'error' : 'saved');
              setTimeout(() => {
                setSaveState('idle');
                if (!hasError) setIsEditing(false);
              }, 800);
            }
          },
          onError: () => {
            done++;
            hasError = true;
            if (done === pending.length) {
              setSaveState('error');
              setTimeout(() => setSaveState('idle'), 3000);
            }
          },
        },
      );
    }
  }, [fichaId, localSections, updateSection]);

  // ── Marcar sección como completada ─────────────────────────────────────────
  const handleSectionComplete = useCallback(
    (sectionName: SectionName) => {
      completeSection(
        { fichaId, sectionName },
        {
          onSuccess: () => {
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);
          },
        },
      );
    },
    [fichaId, completeSection],
  );

  // ── Loading inicial (Firestore) ────────────────────────────────────────────
  if (loading) {
    return <FichaSkeleton />;
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

  const canViewDisponibilidad = isAdmin || can('disponibilidad:view');
  const showSidePanel = editable && canViewDisponibilidad;

  return (
    <div className="space-y-4" style={{ position: 'relative' }}>

      {/* Overlay "Cargando editor…" al hacer clic en Editar */}
      {transitioningToEdit && (
        <div style={{
          position:        'fixed',
          inset:           0,
          zIndex:          999,
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             12,
          background:      'rgba(10,10,12,0.65)',
          backdropFilter:  'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}>
          <svg
            className="animate-spin"
            style={{ width: 28, height: 28, color: 'rgba(255,255,255,0.7)' }}
            viewBox="0 0 24 24" fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.01em' }}>
            Cargando editor…
          </span>
        </div>
      )}
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/fichas-tecnicas"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Fichas Técnicas
        </Link>
      </div>

      {/* Layout: ficha + panel lateral cuando está en edición */}
      <div className={showSidePanel ? 'flex gap-5 items-start' : ''}>
        <div className={showSidePanel ? 'flex-1 min-w-0' : ''}>
          <FichaDocumentView
            ficha={ficha}
            editable={editable}
            forceShowAll={canEdit}
            onEdit={canEdit ? () => {
                // flushSync pinta el overlay en pantalla antes de que React
                // empiece el render pesado del modo edición
                flushSync(() => setTransitioningToEdit(true));
                requestAnimationFrame(() => {
                  setIsEditing(true);
                  setTransitioningToEdit(false);
                });
              } : undefined}
            onSave={handleSaveAll}
            onArchive={canEdit ? () => archiveFicha(fichaId) : undefined}
            onUnarchive={canEdit ? () => unarchiveFicha(fichaId) : undefined}
            canArchive={canEdit}
            onPublish={canPublish ? () => publishFicha(fichaId) : undefined}
            onUnpublish={canPublish ? () => unpublishFicha(fichaId) : undefined}
            canPublish={canPublish}
            isPublishing={isPublishing || isUnpublishing}
            localSections={localSections}
            onCellChange={handleCellChange}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
            onReorderRow={handleReorderRow}
            onSectionComplete={handleSectionComplete}
            sectionStatus={sectionStatus}
            saveState={saveState}
            hiddenSections={ficha.hiddenSections ?? []}
            onToggleModule={canEdit ? handleToggleModule : undefined}
            sectionLayout={ficha.sectionLayout}
            onUpdateLayout={canEdit ? handleUpdateLayout : undefined}
          />
        </div>

        {showSidePanel && (
          <div className="w-56 flex-shrink-0 sticky top-4">
            <DisponibilidadSideCard fichaDate={ficha.date} />
          </div>
        )}
      </div>
    </div>
  );
}
