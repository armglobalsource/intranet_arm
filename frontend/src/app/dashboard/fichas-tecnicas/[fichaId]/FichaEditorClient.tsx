'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useFichaRealtime, useUpdateSection, useCompleteSection, useReopenSection, useArchiveFicha, useUnarchiveFicha, useUpdateFicha, useUpdateLayoutVisual, usePublishFicha, useUnpublishFicha, useSplitPrayerGlobal } from '@/hooks/useFichas';
import { usePermissions } from '@/hooks/usePermissions';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiErrorMessage } from '@/lib/api';
import { useUsers } from '@/hooks/useUsers';
import { displayName } from '@/types/user';
import { FichaDocumentView, ModulesEditPanel } from './FichaDocumentView';
import { EquipoRosterSideCard } from '@/components/fichas/EquipoRosterSideCard';
import { RosterStatusContext } from '@/components/fichas/RosterStatusContext';
import { useEquipoRoster } from '@/hooks/useEquipoRoster';
import { toWeekLabel } from '@/types/disponibilidad';
import { parseFichaDate } from '@/lib/ficha-date';
import { SECTION_LABELS } from '@/types/ficha';
import type { Ficha, Row, SectionName, Section, LayoutVisualSlot } from '@/types/ficha';

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

function SectionAssignments({
  ficha,
  onAssign,
}: {
  ficha: Ficha;
  onAssign: (sectionName: SectionName, userId: number | null, userName: string | null) => void;
}) {
  const { data: users = [], isLoading } = useUsers();
  const campusId = Number(ficha.campusId);
  const availableUsers = users
    .filter((candidate) => candidate.status === 'active')
    .filter((candidate) => !Number.isFinite(campusId) || candidate.campusId == null || candidate.campusId === campusId)
    .sort((a, b) => displayName(a).localeCompare(displayName(b), 'es'));
  const sectionNames = Object.keys(ficha.sections ?? {}) as SectionName[];

  return (
    <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold text-slate-800">
        Responsables de sección
        <span className="ml-2 text-xs font-normal text-slate-400">
          Define quién recibirá esta ficha en “Mis Fichas”
        </span>
      </summary>
      <div className="grid grid-cols-1 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {sectionNames.map((sectionName) => {
          const section = ficha.sections[sectionName];
          return (
            <label key={sectionName} className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {SECTION_LABELS[sectionName]}
              </span>
              <select
                className="input w-full text-xs"
                value={section?.assignedTo ?? ''}
                disabled={isLoading}
                onChange={(event) => {
                  const id = event.target.value ? Number(event.target.value) : null;
                  const selected = id == null ? null : availableUsers.find((candidate) => candidate.id === id);
                  onAssign(sectionName, id, selected ? displayName(selected) : null);
                }}
              >
                <option value="">Sin responsable</option>
                {availableUsers.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {displayName(candidate)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </details>
  );
}

// ── FichaEditorClient ─────────────────────────────────────────────────────────

export function FichaEditorClient({ fichaId }: { fichaId: string }) {
  const allowed = useRequirePermission('fichas:view');
  const { can, isAdmin } = usePermissions();
  const { user } = useAuthStore();
  const { ficha, loading, error } = useFichaRealtime(fichaId);

  // Roster de equipo (worship / técnico / ningún equipo) con estado de
  // disponibilidad para la semana de la ficha — alimenta el sidebar y los
  // puntos de color del autocomplete de personas.
  const rosterCampusId = ficha && Number.isFinite(Number(ficha.campusId)) ? Number(ficha.campusId) : null;
  const rosterWeekLabel = ficha ? toWeekLabel(parseFichaDate(ficha.date)) : '';
  const { data: roster, isLoading: rosterLoading } = useEquipoRoster(rosterCampusId, rosterWeekLabel);
  const rosterStatusByUserId = useMemo(() => {
    const map: Record<number, 'disponible' | 'no_disponible' | 'sin_responder'> = {};
    if (roster) {
      for (const cat of ['worship', 'tecnico', 'ninguno'] as const) {
        for (const p of roster[cat]) map[p.userId] = p.status;
      }
    }
    return map;
  }, [roster]);

  // Setear document.title con el nombre de la ficha para que, cuando el
  // usuario descargue como PDF (window.print → Guardar como PDF), Chrome
  // sugiera un nombre útil en lugar de "document.pdf". Restauramos al
  // desmontar para no pegar ese título en otras vistas.
  useEffect(() => {
    if (!ficha?.title) return;
    const prev = document.title;
    const clean = ficha.title.replace(/[/\\:*?"<>|]/g, ' ').trim();
    document.title = clean || prev;
    return () => { document.title = prev; };
  }, [ficha?.title]);

  const [saveState, setSaveState]       = useState<SaveState>('idle');
  const [actionError, setActionError]   = useState<string | null>(null);
  const [splitGlobalFichaId, setSplitGlobalFichaId] = useState<string | null>(null);
  const [localSections, setLocalSections] =
    useState<Partial<Record<SectionName, Row[]>>>({});

  // Un debounce ref por sección
  const debounceRefs =
    useRef<Partial<Record<SectionName, ReturnType<typeof setTimeout>>>>({});
  const saveQueuesRef =
    useRef<Partial<Record<SectionName, Promise<unknown>>>>({});
  const sectionRevisionRefs =
    useRef<Partial<Record<SectionName, number>>>({});

  // La ficha abre en modo Vista por default. El usuario hace click en
  // "Editar" para entrar en edición, y "Guardar" para volver a Vista.
  // Excepción: si el link viene con ?edit=1 (ej. desde el botón "Abrir
  // editor" del listado) arranca directamente en modo edición para
  // ahorrar un click.
  const searchParams = useSearchParams();
  const startInEditMode = searchParams?.get('edit') === '1';
  const [isEditing, setIsEditing]             = useState(startInEditMode);
  const [transitioningToEdit, setTransitioningToEdit] = useState(false);

  // Panel de edición de módulos: mientras está abierto, reemplaza la lista
  // de Equipo en el side panel. Se cierra al salir del modo edición.
  const [modulesOpen, setModulesOpen] = useState(false);
  useEffect(() => { if (!isEditing) setModulesOpen(false); }, [isEditing]);

  const [localHidden, setLocalHidden] = useState<SectionName[]>([]);
  // Contador de mutaciones en vuelo. Usamos contador (no booleano) para
  // soportar clicks rápidos encadenados: cada uno dispara su propia mutación
  // y solo cuando TODAS terminan sincronizamos con el snapshot de Firestore.
  const hiddenInflight = useRef(0);

  useEffect(() => {
    if (hiddenInflight.current !== 0) return;
    const serverHidden = ficha?.hiddenSections ?? [];
    // Comparación por contenido (no por referencia). Firestore snapshots
    // devuelven arrays con nueva referencia aunque el contenido sea el
    // mismo — si no comparamos por contenido, setLocalHidden dispara un
    // re-render innecesario en cada snapshot, y eso puede causar flicker
    // visible del checkbox y (peor) pisar el estado optimista si otro
    // click justo cae en la misma micro-ventana.
    if (
      serverHidden.length !== localHidden.length ||
      serverHidden.some((s, i) => s !== localHidden[i])
    ) {
      setLocalHidden(serverHidden);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha?.hiddenSections]);

  const [localLayout, setLocalLayout] = useState<{ left: string[]; right: string[]; leftRatio?: number } | undefined>(undefined);
  // Mismo patrón de contador en vuelo que localHidden, para que clicks
  // encadenados de ▲/▼ no se pisen entre sí ni con el snapshot del servidor.
  const layoutInflight = useRef(0);

  useEffect(() => {
    if (layoutInflight.current !== 0) return;
    setLocalLayout(ficha?.sectionLayout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha?.sectionLayout]);

  const { mutateAsync: updateSectionAsync } = useUpdateSection();
  const { mutateAsync: completeSection } = useCompleteSection();
  const { mutateAsync: reopenSection } = useReopenSection();
  const { mutate: archiveFicha } = useArchiveFicha();
  const { mutate: unarchiveFicha } = useUnarchiveFicha();
  const { mutate: updateFicha } = useUpdateFicha();
  const { mutate: updateLayoutVisual } = useUpdateLayoutVisual();
  const { mutate: publishFicha,   isPending: isPublishing  } = usePublishFicha();
  const { mutate: unpublishFicha, isPending: isUnpublishing } = useUnpublishFicha();
  const { mutateAsync: splitPrayerGlobal, isPending: isSplitting } = useSplitPrayerGlobal();

  function handleToggleModule(name: SectionName | SectionName[]) {
    if (!ficha) return;
    // Acepta uno o varios nombres a la vez (el slot 'worship' agrupa 3
    // secciones que togglean juntas, como una sola fila en la lista) —
    // siempre en UNA sola pasada para no perder toggles por condición de
    // carrera entre clicks encadenados.
    const names = Array.isArray(name) ? name : [name];
    // Toggle contra localHidden (estado optimista), no contra ficha.hiddenSections
    // — así clicks encadenados componen bien sin esperar el roundtrip.
    const allHidden = names.every((n) => localHidden.includes(n));
    const next = allHidden
      ? localHidden.filter((s) => !names.includes(s))
      : Array.from(new Set([...localHidden, ...names]));
    setLocalHidden(next);
    hiddenInflight.current += 1;
    setSaveState('saving');
    updateFicha(
      { fichaId: ficha.fichaId, hiddenSections: next },
      {
        onSuccess: () => {
          hiddenInflight.current = Math.max(0, hiddenInflight.current - 1);
          if (hiddenInflight.current === 0) {
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 800);
          }
        },
        onError: () => {
          hiddenInflight.current = Math.max(0, hiddenInflight.current - 1);
          // En error, revertimos al estado del servidor solo si ya no hay
          // otros toggles en vuelo (para no pisar clicks posteriores válidos).
          if (hiddenInflight.current === 0) {
            setLocalHidden(ficha.hiddenSections ?? []);
            setSaveState('error');
            setTimeout(() => setSaveState('idle'), 3000);
          }
        },
      },
    );
  }

  function handleUpdateLayout(layout: { left: string[]; right: string[]; leftRatio?: number }) {
    if (!ficha) return;
    setLocalLayout(layout);
    layoutInflight.current += 1;
    setSaveState('saving');
    updateFicha(
      { fichaId: ficha.fichaId, sectionLayout: layout },
      {
        onSuccess: () => {
          layoutInflight.current = Math.max(0, layoutInflight.current - 1);
          if (layoutInflight.current === 0) {
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 800);
          }
        },
        onError: (err) => {
          layoutInflight.current = Math.max(0, layoutInflight.current - 1);
          if (layoutInflight.current === 0) {
            setLocalLayout(ficha.sectionLayout);
            setSaveState('error');
            setActionError(apiErrorMessage(err, 'No se pudo guardar el orden de las secciones'));
            setTimeout(() => setSaveState('idle'), 3000);
          }
        },
      },
    );
  }

  function handleUpdateLayoutVisual(patch: { slots: LayoutVisualSlot[] }) {
    if (!ficha) return;
    updateLayoutVisual({
      fichaId: ficha.fichaId,
      slots:   patch.slots,
    });
  }

  // ── Sincronizar filas desde la versión más reciente de la API ─────────────
  // Solo sincronizamos secciones que NO tienen una edición pendiente
  useEffect(() => {
    if (!ficha?.sections) return;
    setLocalSections((prev) => {
      const next = { ...prev };
      for (const [k, sec] of Object.entries(ficha.sections!)) {
        const sectionName = k as SectionName;
        if (!debounceRefs.current[sectionName] && !saveQueuesRef.current[sectionName]) {
          next[k as SectionName] = (sec as Section).rows ?? [];
          sectionRevisionRefs.current[sectionName] = Number((sec as Section).revision ?? 0);
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

  const enqueueSectionUpdate = useCallback(
    (sectionName: SectionName, patch: Record<string, unknown>) => {
      const previous = saveQueuesRef.current[sectionName] ?? Promise.resolve();
      const task = previous
        .catch(() => undefined)
        .then(async () => {
          const data = await updateSectionAsync({
            fichaId,
            sectionName,
            expectedRevision: sectionRevisionRefs.current[sectionName] ?? 0,
            ...patch,
          });
          sectionRevisionRefs.current[sectionName] =
            Number(data?.sections?.[sectionName]?.revision ?? sectionRevisionRefs.current[sectionName] ?? 0);
          return data;
        });
      saveQueuesRef.current[sectionName] = task;
      task.finally(() => {
        if (saveQueuesRef.current[sectionName] === task) {
          saveQueuesRef.current[sectionName] = undefined;
        }
      }).catch(() => undefined);
      return task;
    },
    [fichaId, updateSectionAsync],
  );

  // ── Guardar sección con debounce ───────────────────────────────────────────
  const scheduleSave = useCallback(
    (sectionName: SectionName, rows: Row[], immediate = false) => {
      if (debounceRefs.current[sectionName]) {
        clearTimeout(debounceRefs.current[sectionName]!);
      }
      setSaveState('saving');
      debounceRefs.current[sectionName] = setTimeout(() => {
        debounceRefs.current[sectionName] = undefined;
        enqueueSectionUpdate(sectionName, { rows })
          .then(() => {
            setSaveState('saved');
            setTimeout(() => setSaveState('idle'), 2000);
          })
          .catch((err) => {
            setSaveState('error');
            setActionError(apiErrorMessage(err, 'No se pudieron guardar los cambios'));
            setTimeout(() => setSaveState('idle'), 3000);
          });
      }, immediate ? 0 : 800);
    },
    [enqueueSectionUpdate],
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

  // ── Renombrar label de una fila ─────────────────────────────────────────────
  const handleLabelChange = useCallback(
    (sectionName: SectionName, rowId: string, newLabel: string) => {
      setLocalSections((prev) => {
        const rows = prev[sectionName] ?? [];
        const updated = rows.map((r) =>
          r.id === rowId ? { ...r, label: newLabel } : r,
        );
        scheduleSave(sectionName, updated);
        return { ...prev, [sectionName]: updated };
      });
    },
    [scheduleSave],
  );

  // handleReorderRow eliminado: el drag&drop de filas se retiró junto con
  // el resto del sistema de reordenamiento manual.

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

    // Guardar todas las secciones respetando la cola individual de cada una.
    setSaveState('saving');
    Promise.all(pending.map(({ sectionName, rows }) => enqueueSectionUpdate(sectionName, { rows })))
      .then(() => {
        setSaveState('saved');
        setTimeout(() => {
          setSaveState('idle');
          setIsEditing(false);
        }, 800);
      })
      .catch((err) => {
        setSaveState('error');
        setActionError(apiErrorMessage(err, 'No se pudieron guardar todos los cambios'));
        setTimeout(() => setSaveState('idle'), 3000);
      });
  }, [localSections, enqueueSectionUpdate]);

  // ── Marcar sección como completada ─────────────────────────────────────────
  const handleSectionComplete = useCallback(
    async (sectionName: SectionName) => {
      setActionError(null);
      setSaveState('saving');
      try {
        const pendingTimeout = debounceRefs.current[sectionName];
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          debounceRefs.current[sectionName] = undefined;
          await enqueueSectionUpdate(sectionName, { rows: localSections[sectionName] ?? [] });
        } else if (saveQueuesRef.current[sectionName]) {
          await saveQueuesRef.current[sectionName];
        }
        const mutation = sectionStatus[sectionName] ? reopenSection : completeSection;
        await mutation({ fichaId, sectionName });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 2000);
      } catch (err) {
        setSaveState('error');
        setActionError(apiErrorMessage(err, 'No se pudo actualizar el estado de la sección'));
        setTimeout(() => setSaveState('idle'), 3000);
      }
    },
    [fichaId, completeSection, reopenSection, sectionStatus, enqueueSectionUpdate, localSections],
  );

  // ── Carga inicial ─────────────────────────────────────────────────────────
  if (!allowed) return null;

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

  // El roster de equipo se muestra a cualquiera con acceso de edición a la
  // ficha (fichas:view ya se validó vía `allowed` arriba) — antes dependía de
  // permisos separados (disponibilidad:view / tecnicos:view) que la mayoría
  // de los roles productores no tenían, dejando el panel siempre oculto.
  const showSidePanel = editable;
  const fichaCampusId = rosterCampusId;

  function handleAssignSection(sectionName: SectionName, userId: number | null, userName: string | null) {
    setActionError(null);
    setSaveState('saving');
    enqueueSectionUpdate(sectionName, { assignedTo: userId, assignedName: userName })
      .then(() => {
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 1200);
      })
      .catch((err) => {
        setSaveState('error');
        setActionError(apiErrorMessage(err, 'No se pudo asignar el responsable'));
      });
  }

  async function handleSplitPrayerGlobal() {
    const confirmed = window.confirm(
      'Se crearán dos fichas independientes. La ficha de Oración conservará su contenido y Miércoles Global recibirá una ficha propia. Ambas quedarán en borrador para revisión.',
    );
    if (!confirmed) return;

    setActionError(null);
    try {
      const result = await splitPrayerGlobal(fichaId);
      setSplitGlobalFichaId(result.globalFicha.fichaId);
    } catch (err) {
      setActionError(apiErrorMessage(err, 'No se pudieron separar los encuentros'));
    }
  }

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

      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="font-bold text-red-400 hover:text-red-700"
            aria-label="Cerrar mensaje"
          >
            ×
          </button>
        </div>
      )}

      {ficha.type === 'oracion' && (ficha.encuentros?.length ?? 0) > 1 && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Esta ficha contiene dos encuentros de carácter diferente</p>
            <p className="mt-1 text-xs text-amber-700">
              Encuentro de Oración y Miércoles Global deben administrarse, completarse y publicarse por separado.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSplitPrayerGlobal}
            disabled={isSplitting || !(isAdmin || (can('fichas:edit') && can('fichas:create')))}
            className="shrink-0 rounded-lg bg-amber-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSplitting ? 'Separando…' : 'Separar en dos fichas'}
          </button>
        </div>
      )}

      {splitGlobalFichaId && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold">Las fichas quedaron separadas correctamente</p>
            <p className="mt-1 text-xs text-emerald-700">
              Revisa Miércoles Global antes de publicarlo.
            </p>
          </div>
          <Link
            href={`/dashboard/fichas-tecnicas/${splitGlobalFichaId}`}
            className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-center text-xs font-bold text-white transition hover:bg-emerald-800"
          >
            Abrir Miércoles Global
          </Link>
        </div>
      )}

      {editable && (
        <SectionAssignments ficha={ficha} onAssign={handleAssignSection} />
      )}

      {/* Layout: ficha + panel lateral cuando está en edición. El panel va al
          lado solo en pantallas anchas; antes queda arriba a ancho completo para
          que la ficha no se aplaste y "Módulos" siga visible al abrirse. */}
      <RosterStatusContext.Provider value={rosterStatusByUserId}>
      <div className={showSidePanel ? 'flex flex-col gap-5 xl:flex-row xl:items-start' : ''}>
        <div className={showSidePanel ? 'order-2 min-w-0 xl:order-1 xl:flex-1' : ''}>
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
            onLabelChange={handleLabelChange}
            onSectionComplete={handleSectionComplete}
            sectionStatus={sectionStatus}
            saveState={saveState}
            hiddenSections={localHidden}
            modulesPanelOpen={modulesOpen}
            onToggleModulesPanel={canEdit ? () => setModulesOpen((o) => !o) : undefined}
            sectionLayout={localLayout}
            onUpdateLayoutVisual={canEdit ? handleUpdateLayoutVisual : undefined}
          />
        </div>

        {showSidePanel && (
          <div className="order-1 flex w-full flex-col gap-3 xl:order-2 xl:sticky xl:top-4 xl:w-72 xl:flex-shrink-0">
            {modulesOpen ? (
              <ModulesEditPanel
                fichaType={ficha.type}
                hiddenSections={localHidden}
                onToggleModule={handleToggleModule}
                sectionLayout={localLayout}
                onUpdateLayout={handleUpdateLayout}
                onClose={() => setModulesOpen(false)}
              />
            ) : (
              <EquipoRosterSideCard
                roster={roster}
                isLoading={rosterLoading}
                weekLabel={rosterWeekLabel}
                campusId={fichaCampusId}
              />
            )}
          </div>
        )}
      </div>
      </RosterStatusContext.Provider>
    </div>
  );
}
