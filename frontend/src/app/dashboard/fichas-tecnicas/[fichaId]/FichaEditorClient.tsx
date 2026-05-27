'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

  const [isEditing, setIsEditing] = useState(true);

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

  // ── Guardar todo de inmediato ──────────────────────────────────────────────
  const handleSaveAll = useCallback(() => {
    let hasPending = false;
    for (const [sectionName, timeout] of Object.entries(debounceRefs.current)) {
      if (timeout) {
        clearTimeout(timeout);
        debounceRefs.current[sectionName as SectionName] = undefined;
        const rows = localSections[sectionName as SectionName];
        if (rows) {
          hasPending = true;
          setSaveState('saving');
          updateSection(
            { fichaId, sectionName: sectionName as SectionName, rows },
            {
              onSuccess: () => { setSaveState('saved'); setTimeout(() => { setSaveState('idle'); setIsEditing(false); }, 800); },
              onError:   () => { setSaveState('error');  setTimeout(() => setSaveState('idle'), 3000); },
            },
          );
        }
      }
    }
    if (!hasPending) {
      setSaveState('saved');
      setTimeout(() => { setSaveState('idle'); setIsEditing(false); }, 800);
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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <div className="rounded-2xl animate-pulse" style={{ height: 420, background: 'rgba(255,255,255,0.06)' }} />
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

  const canViewDisponibilidad = isAdmin || can('disponibilidad:view');
  const showSidePanel = editable && canViewDisponibilidad;

  return (
    <div className="space-y-4">
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
            onEdit={canEdit ? () => setIsEditing(true) : undefined}
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
            onSectionComplete={handleSectionComplete}
            sectionStatus={sectionStatus}
            saveState={saveState}
            hiddenSections={ficha.hiddenSections ?? []}
            onToggleModule={canEdit ? handleToggleModule : undefined}
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
