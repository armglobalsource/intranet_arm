'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFichas, useCreateFicha, useDeleteFicha } from '@/hooks/useFichas';
import { CloneModal } from '@/components/fichas/CloneModal';
import { usePermissions } from '@/hooks/usePermissions';
import { statusColor, statusLabel, completionPercent } from '@/types/ficha';
import type { FichaListItem, FichaType, Encuentro } from '@/types/ficha';
import { useAllCampuses } from '@/hooks/useCampus';
import type { Campus } from '@/hooks/useCampus';

// ── Campus helpers ────────────────────────────────────────────────────────────

interface EncuentrosDia {
  dia:       string;
  tipo:      'unico' | 'multi';
  fichaType?: FichaType;
  encuentros: Encuentro[];
}

const ENCOUNTER_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

/** Convierte los horarios del mantenedor en config de días para el form de fichas */
function buildEncuentrosConfig(campus: Campus): EncuentrosDia[] {
  const schedules = campus.schedules ?? [];
  if (schedules.length === 0) return [];

  // Agrupar por (día + bloque), cada combinación es su propio tipo de evento
  // (su propia ficha técnica) aunque compartan el mismo día:
  //   - "oración" siempre es su propio grupo, sin importar bloque
  //     (ej. Miércoles Oración 06:00 vs Miércoles Global 20:00).
  //   - un bloque (AM/PM) agrupa sus propios horarios en un evento multi
  //     (ej. Domingo Bloque AM vs Domingo Bloque PM).
  //   - un horario suelto (sin bloque, sin oración) usa su descripción como
  //     nombre del evento si la tiene (ej. "Miércoles Global").
  const byGroup: Record<string, { dia: string; slots: typeof schedules }> = {};
  schedules.forEach((s) => {
    const isOracion = s.fichaType === 'oracion';
    const key = isOracion
      ? `${s.dia}:oracion`
      : s.bloque
      ? `${s.dia}:${s.bloque}`
      : `${s.dia}:${s.descripcion ?? s.hora}`;
    const label = isOracion
      ? `${s.dia} Oración`
      : s.bloque
      ? `${s.dia} Bloque ${s.bloque}`
      : (s.descripcion || s.dia);
    byGroup[key] = byGroup[key] ?? { dia: label, slots: [] };
    byGroup[key].slots.push(s);
  });

  const ORDER = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return Object.values(byGroup)
    .sort((a, b) => ORDER.indexOf(a.slots[0].dia) - ORDER.indexOf(b.slots[0].dia))
    .map(({ dia, slots }) => {
      const isMulti    = slots.length > 1;
      const fichaType  = (slots[0].fichaType as FichaType | undefined) ?? (isMulti ? 'multi' : 'unico');
      const encuentros: Encuentro[] = slots.map((s, i) => ({
        id:     isMulti ? `e${i + 1}` : 'unico',
        label:  s.descripcion || (isMulti ? `Encuentro ${i + 1}` : dia),
        time:   s.hora,
        isLive: false,
        color:  ENCOUNTER_COLORS[i % ENCOUNTER_COLORS.length],
      }));
      return { dia, tipo: isMulti ? 'multi' : 'unico', fichaType, encuentros };
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(raw: any): string {
  if (!raw) return '—';
  let d: Date;
  if (typeof raw?.toDate === 'function') d = raw.toDate();
  else if (typeof raw === 'string' || typeof raw === 'number') d = new Date(raw);
  else if (raw instanceof Date) d = raw;
  else d = new Date(raw.seconds * 1000);
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Colores para encuentros personalizados ────────────────────────────────────

interface CustomEncuentro { label: string; time: string; }

// ── CreateFichaForm ───────────────────────────────────────────────────────────

function CreateFichaForm({ onCreated }: { onCreated: (fichaId: string) => void }) {
  const { data: rawCampuses = [], isLoading: loadingCampus } = useAllCampuses();
  const { mutate: createFicha, isPending, isError, error } = useCreateFicha();

  // Solo campus activos
  const campuses = rawCampuses.filter((c) => c.isActive);

  const [campusId, setCampusId] = useState('');
  const [diaIdx,   setDiaIdx]   = useState<number>(0);
  const [type,     setType]     = useState<FichaType>('multi');
  const [title,    setTitle]    = useState('');
  const [date,     setDate]     = useState('');

  // Estado para evento especial
  const [customName,       setCustomName]       = useState('');
  const [customEncuentros, setCustomEncuentros] = useState<CustomEncuentro[]>([{ label: '', time: '08:00' }]);
  const [customMulti,      setCustomMulti]      = useState(false);
  const [descripcion,      setDescripcion]      = useState('');
  const [ubicacion,        setUbicacion]        = useState('');

  const isCustom = diaIdx === -1;

  // Campus seleccionado y su config derivada del mantenedor
  const selectedCampus   = campuses.find((c) => String(c.id) === campusId);
  const diasDisponibles  = useMemo(
    () => selectedCampus ? buildEncuentrosConfig(selectedCampus) : [],
    [selectedCampus],
  );
  const diaSeleccionado: EncuentrosDia | undefined = isCustom ? undefined : diasDisponibles[diaIdx];

  // Encuentros resultantes
  const encuentros: Encuentro[] = isCustom
    ? customEncuentros
        .filter((e) => e.time)
        .map((e, i) => ({
          id:     customMulti ? `e${i + 1}` : 'unico',
          label:  e.label || `${customName || 'Evento'} · ${e.time}`,
          time:   e.time,
          isLive: false,
          color:  ENCOUNTER_COLORS[i % ENCOUNTER_COLORS.length],
        }))
    : diaSeleccionado?.encuentros ?? [];

  // ── Campus change ────────────────────────────────────────────────────────
  function handleCampusChange(id: string) {
    setCampusId(id);
    setDiaIdx(0);
    const campus = campuses.find((c) => String(c.id) === id);
    if (campus) {
      const config = buildEncuentrosConfig(campus);
      const primer = config[0];
      setType(primer?.fichaType ?? (primer?.tipo === 'unico' ? 'unico' : 'multi'));
    } else {
      setType('multi');
    }
  }

  function handleDiaChange(idx: number) {
    setDiaIdx(idx);
    if (idx === -1) { setType('unico'); return; }
    const dia = diasDisponibles[idx];
    if (dia) setType(dia.fichaType ?? (dia.tipo === 'unico' ? 'unico' : 'multi'));
  }

  // ── Custom encuentros ────────────────────────────────────────────────────
  function addCustomEncuentro() {
    setCustomEncuentros((prev) => [...prev, { label: '', time: '08:00' }]);
  }
  function removeCustomEncuentro(i: number) {
    setCustomEncuentros((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateCustomEncuentro(i: number, field: keyof CustomEncuentro, val: string) {
    setCustomEncuentros((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campusId || !title || !date) return;
    if (isCustom && encuentros.length === 0) return;
    const campus = campuses.find((c) => String(c.id) === campusId);
    if (!campus) return;

    const finalType: FichaType = isCustom
      ? (customMulti && encuentros.length > 1 ? 'multi' : 'unico')
      : type;

    const payload: import('@/types/ficha').CreateFichaPayload = {
      campusId:   String(campus.id),
      campusName: campus.name,
      type:       finalType,
      title,
      date,
      encuentros,
      ...(isCustom && descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      ...(isCustom && ubicacion.trim()   ? { ubicacion:   ubicacion.trim() }   : {}),
    };

    createFicha(payload, {
      onSuccess: (data) => onCreated(data.fichaId ?? data.id ?? ''),
    });
  }

  const canSubmit = campusId && title && date && (!isCustom || encuentros.length > 0);

  // Validation hint shown above the submit button
  const validationHint = !campusId
    ? 'Selecciona un campus'
    : !title
    ? 'Agrega un título'
    : !date
    ? 'Elige la fecha del evento'
    : isCustom && encuentros.length === 0
    ? 'El evento necesita al menos un horario'
    : null;

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      <h2 className="text-base font-bold text-gray-800">Nueva ficha técnica</h2>

      {/* Campus */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Campus *</label>
        <select
          value={campusId}
          onChange={(e) => handleCampusChange(e.target.value)}
          required
          className="input text-sm"
          disabled={loadingCampus}
        >
          <option value="">Selecciona un campus…</option>
          {campuses?.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Día de servicio */}
      {campusId && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de evento</label>
          <div className="flex gap-2 flex-wrap">
            {diasDisponibles.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleDiaChange(i)}
                className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                  diaIdx === i && !isCustom
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {d.dia}
              </button>
            ))}
            {/* Botón evento especial */}
            <button
              type="button"
              onClick={() => handleDiaChange(-1)}
              className={`py-2 px-3 rounded-lg border text-sm font-medium transition-all flex items-center gap-1.5 ${
                isCustom
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-dashed border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Evento especial
            </button>
          </div>
        </div>
      )}

      {/* ── Configuración de evento especial ─────────────────────────────── */}
      {isCustom && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
          <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
            Configurar evento especial
          </p>

          {/* Nombre del evento */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nombre del evento *
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="ej: Conferencia, Actividad Jóvenes, Retiro…"
              className="input text-sm"
              required={isCustom}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Descripción <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Breve descripción del evento…"
              rows={2}
              className="input text-sm resize-none"
            />
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Ubicación <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="ej: Auditorio Principal, Online, Sala B…"
              className="input text-sm"
            />
          </div>

          {/* Tipo: único o multi */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              ¿Cuántos encuentros tiene?
            </label>
            <div className="flex gap-2">
              {[false, true].map((isMulti) => (
                <button
                  key={String(isMulti)}
                  type="button"
                  onClick={() => {
                    setCustomMulti(isMulti);
                    if (!isMulti) setCustomEncuentros(prev => [prev[0] ?? { label: '', time: '08:00' }]);
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                    customMulti === isMulti
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                  }`}
                >
                  {isMulti ? 'Múltiples encuentros' : 'Un solo encuentro'}
                </button>
              ))}
            </div>
          </div>

          {/* Encuentros */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              {customMulti ? 'Encuentros' : 'Horario'}
            </label>
            {customEncuentros.map((enc, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: ENCOUNTER_COLORS[i % ENCOUNTER_COLORS.length] }} />
                {customMulti && (
                  <input
                    type="text"
                    value={enc.label}
                    onChange={(e) => updateCustomEncuentro(i, 'label', e.target.value)}
                    placeholder={`ej: Encuentro ${i + 1}`}
                    className="input text-xs py-1.5 flex-1"
                  />
                )}
                <input
                  type="time"
                  value={enc.time}
                  onChange={(e) => updateCustomEncuentro(i, 'time', e.target.value)}
                  className="input text-xs py-1.5 w-28"
                  required={isCustom}
                />
                {customMulti && customEncuentros.length > 1 && (
                  <button type="button" onClick={() => removeCustomEncuentro(i)}
                    className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {customMulti && customEncuentros.length < 5 && (
              <button type="button" onClick={addCustomEncuentro}
                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors mt-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar encuentro
              </button>
            )}
          </div>
        </div>
      )}

      {/* Título */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Título *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder={
            isCustom && customName
              ? `ej: ${customName} ${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
              : diaSeleccionado
              ? `ej: ${diaSeleccionado.dia} ${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
              : 'ej: Encuentro Domingo 18 Mayo'
          }
          className="input text-sm"
        />
      </div>

      {/* Fecha */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Fecha del evento *</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="input text-sm"
        />
      </div>

      {/* Preview encuentros */}
      {encuentros.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Encuentros ({encuentros.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {encuentros.map((e) => (
              <span
                key={e.id}
                className="text-[11px] px-2.5 py-1 rounded-full border font-medium"
                style={{ borderColor: e.color + '40', color: e.color, background: e.color + '14' }}
              >
                {e.label} · {e.time}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Validation hint */}
      {validationHint && (
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {validationHint}
        </p>
      )}

      {/* API error */}
      {isError && (
        <p className="text-xs text-red-600 flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-lg">
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {(error as any)?.response?.data?.message ?? 'Error al crear la ficha. Intenta de nuevo.'}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !canSubmit}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Creando…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {isCustom ? `Crear evento especial` : 'Crear ficha'}
          </>
        )}
      </button>
    </form>
  );
}

// ── FichaRow (tabla) ──────────────────────────────────────────────────────────

function FichaRow({
  ficha,
  onClone,
  onDelete,
}: {
  ficha: FichaListItem;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { bg, text } = statusColor(ficha.status);
  const pct = completionPercent(ficha.completionStatus);

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <Link href={`/dashboard/fichas-tecnicas/${ficha.fichaId}`}
          className="text-sm font-medium text-gray-800 hover:text-gray-900 hover:underline">
          {ficha.title}
        </Link>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{ficha.campusName}</td>
      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(ficha.date)}</td>
      <td className="px-4 py-3">
        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full"
          style={{ background: bg, color: text }}>
          {statusLabel(ficha.status)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct === 100 ? '#1D9E75' : '#7F77DD' }} />
          </div>
          <span className="text-[11px] text-gray-400">{pct}%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/dashboard/fichas-tecnicas/${ficha.fichaId}`}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Abrir"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </Link>
          <button
            onClick={() => onClone(ficha.fichaId)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Clonar"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(ficha.fichaId)}
                className="text-[10px] px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              title="Eliminar"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function FichasAdminClient() {
  const router = useRouter();
  const { isAdmin, can } = usePermissions();
  const { data: fichas, isLoading } = useFichas();
  const { mutate: deleteFicha } = useDeleteFicha();

  const [cloneTarget, setCloneTarget] = useState<import('@/types/ficha').FichaListItem | null>(null);

  const canAccess = isAdmin || can('fichas:admin') || can('fichas:create');

  function handleDelete(fichaId: string) {
    deleteFicha(fichaId);
  }

  if (!canAccess) {
    return (
      <div className="card p-12 text-center">
        <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="text-gray-500 text-sm">No tienes permisos para acceder a este panel</p>
        <Link href="/dashboard/fichas-tecnicas" className="btn-secondary text-sm mt-4 inline-block">
          Volver al hub
        </Link>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/fichas-tecnicas" className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Admin Fichas</h1>
          </div>
          <p className="text-gray-500 text-sm">Crear, clonar y gestionar fichas técnicas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario crear */}
        <div className="lg:col-span-1">
          <CreateFichaForm onCreated={(id) => router.push(`/dashboard/fichas-tecnicas/${id}`)} />
        </div>

        {/* Tabla de fichas */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-700">Todas las fichas</h2>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : !fichas?.length ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-400">No hay fichas creadas aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Título', 'Campus', 'Fecha', 'Estado', 'Progreso', 'Acciones'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fichas.map((f) => (
                    <FichaRow
                      key={f.fichaId}
                      ficha={f}
                      onClone={(id) => setCloneTarget(fichas?.find((f) => f.fichaId === id) ?? null)}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Modal de clonación */}
    {cloneTarget && (
      <CloneModal ficha={cloneTarget} onClose={() => setCloneTarget(null)} />
    )}
    </>
  );
}
