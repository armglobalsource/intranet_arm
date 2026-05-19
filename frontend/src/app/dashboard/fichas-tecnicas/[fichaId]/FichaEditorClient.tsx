'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useFichaRealtime, useUpdateSection, useCompleteSection } from '@/hooks/useFichas';
import { usePermissions } from '@/hooks/usePermissions';
import { FichaDocumentView } from './FichaDocumentView';
import type { Row, SectionName, Section } from '@/types/ficha';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── FichaEditorClient ─────────────────────────────────────────────────────────

export function FichaEditorClient({ fichaId }: { fichaId: string }) {
  const { can, isAdmin } = usePermissions();
  const { ficha, loading, error } = useFichaRealtime(fichaId);
  const [saveState, setSaveState]       = useState<SaveState>('idle');
  const [localSections, setLocalSections] =
    useState<Partial<Record<SectionName, Row[]>>>({});

  // Un debounce ref por sección
  const debounceRefs =
    useRef<Partial<Record<SectionName, ReturnType<typeof setTimeout>>>>({});

  const { mutate: updateSection } = useUpdateSection();
  const { mutate: completeSection } = useCompleteSection();

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

  const canEdit = isAdmin || can('fichas:edit') || can('fichas:admin');
  // En modo editor la ficha es siempre editable si tiene permisos
  // Si está completa, el usuario puede editar igual (para correcciones)
  const editable = canEdit;

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
              onSuccess: () => { setSaveState('saved'); setTimeout(() => setSaveState('idle'), 2000); },
              onError:   () => { setSaveState('error');  setTimeout(() => setSaveState('idle'), 3000); },
            },
          );
        }
      }
    }
    if (!hasPending) {
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
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

  return (
    <div className="space-y-4">
      {/* Breadcrumb + botón guardar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
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

        {editable && (
          <button
            onClick={handleSaveAll}
            disabled={saveState === 'saving'}
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-60"
            style={{
              background: saveState === 'saved' ? '#1D9E75' : '#1a1a18',
              color: '#fff',
            }}
          >
            {saveState === 'saving' ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Guardando…
              </>
            ) : saveState === 'saved' ? (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Guardado
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Guardar cambios
              </>
            )}
          </button>
        )}
      </div>

      {/* Vista documento (editable o read-only) */}
      <FichaDocumentView
        ficha={ficha}
        editable={editable}
        localSections={localSections}
        onCellChange={handleCellChange}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        onSectionComplete={handleSectionComplete}
        sectionStatus={sectionStatus}
        saveState={saveState}
      />
    </div>
  );
}
