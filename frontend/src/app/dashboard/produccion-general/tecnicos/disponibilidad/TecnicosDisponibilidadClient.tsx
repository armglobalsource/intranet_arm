'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useTecnicosEncounters,
  useMyTecnicosDisponibilidad,
  useTecnicosBulkSubmit,
  useTecnicosMatrix,
} from '@/hooks/useTecnicos';
import type { SlotSubmit } from '@/types/disponibilidad';
import {
  toWeekLabel,
  shiftWeek,
  formatWeekLabel,
} from '@/types/disponibilidad';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEncounterDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

// ── CampusSelector ────────────────────────────────────────────────────────────

function CampusSelector({ value, onChange }: { value: number | null; onChange: (id: number) => void }) {
  const { data: campuses = [], isLoading } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['campus', 'active'],
    queryFn:  async () => {
      const { api } = await import('@/lib/api');
      const res = await api.get('/campus/active');
      return res.data;
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="h-9 w-40 bg-slate-100 rounded-lg animate-pulse" />;

  return (
    <select value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} className="input text-sm w-44">
      <option value="">Campus...</option>
      {campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

// ── WeekSelector ─────────────────────────────────────────────────────────────

function WeekSelector({ weekLabel, onChange }: { weekLabel: string; onChange: (w: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => onChange(shiftWeek(weekLabel, -1))}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-slate-400">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <div className="flex flex-col items-center px-2">
        <span className="text-sm font-semibold text-slate-800">{formatWeekLabel(weekLabel)}</span>
        <span className="text-[10px] text-slate-500">{weekLabel}</span>
      </div>
      <button onClick={() => onChange(shiftWeek(weekLabel, 1))}
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-slate-400">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
      <button onClick={() => onChange(toWeekLabel(new Date()))}
        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1 transition-all">
        Hoy
      </button>
    </div>
  );
}

// ── TecnicoView (envío de disponibilidad) ─────────────────────────────────────

function TecnicoView({ campusId, weekLabel }: { campusId: number; weekLabel: string }) {
  const { data: encounters = [], isLoading: loadingEnc, isError: encError } = useTecnicosEncounters(campusId, weekLabel);
  const { data: saved = [] } = useMyTecnicosDisponibilidad(campusId, weekLabel);
  const bulkSubmit = useTecnicosBulkSubmit();
  const [slots, setSlots] = useState<Record<string, SlotSubmit>>({});

  const getSlot = (key: string) => {
    if (slots[key]) return slots[key];
    const s = saved.find((d) => d.scheduleKey === key);
    return s ? { scheduleKey: key, available: s.available, nota: s.nota ?? '' } : null;
  };

  function toggle(scheduleKey: string, available: boolean) {
    setSlots((prev) => ({ ...prev, [scheduleKey]: { ...prev[scheduleKey], scheduleKey, available } }));
  }

  function setNota(scheduleKey: string, nota: string) {
    setSlots((prev) => ({ ...prev, [scheduleKey]: { ...prev[scheduleKey], scheduleKey, nota } }));
  }

  async function handleSave() {
    const payload = encounters.map((e) => {
      const s = getSlot(e.scheduleKey);
      return { scheduleKey: e.scheduleKey, available: s?.available ?? false, nota: s?.nota?.trim() || undefined };
    });
    await bulkSubmit.mutateAsync({ campusId, weekLabel, slots: payload });
  }

  if (loadingEnc) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}
    </div>
  );

  if (encError) return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
      No se pudieron cargar los encuentros. Intenta recargar la página.
    </div>
  );

  if (!encounters.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-400">Sin encuentros configurados</p>
      <p className="text-xs text-slate-300 mt-1">Contacta al administrador para configurar los horarios.</p>
    </div>
  );

  const allResponded = encounters.every((e) => getSlot(e.scheduleKey) !== null);

  return (
    <div className="space-y-3">
      {encounters.map((enc) => {
        const slot    = getSlot(enc.scheduleKey);
        const isAvail = slot?.available ?? null;
        const nota    = slot?.nota ?? '';
        const isSaved = saved.some((d) => d.scheduleKey === enc.scheduleKey);

        return (
          <div key={enc.scheduleKey}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all"
            style={{ borderLeft: isAvail === true ? '3px solid #2563eb' : isAvail === false ? '3px solid #ef4444' : '3px solid #e2e8f0' }}>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {enc.bloque && (
                    <span className="flex-shrink-0 w-9 h-9 rounded-xl text-[11px] font-bold flex items-center justify-center bg-slate-100 text-slate-600">
                      {enc.bloque}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-800 capitalize leading-snug">{formatEncounterDate(enc.encounterDate)}</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">{enc.hora} hrs</p>
                  </div>
                </div>
                {isSaved && (
                  <span className="flex-shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200">Guardado</span>
                )}
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => toggle(enc.scheduleKey, true)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${isAvail === true ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50'}`}>
                  ✓ Disponible
                </button>
                <button onClick={() => toggle(enc.scheduleKey, false)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${isAvail === false ? 'bg-red-500 text-white border-red-500 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-600 hover:bg-red-50'}`}>
                  ✕ No disponible
                </button>
              </div>
              <textarea rows={1} placeholder="Nota opcional (ej: llego tarde, solo primer servicio...)"
                value={nota} onChange={(e) => setNota(enc.scheduleKey, e.target.value)} maxLength={300}
                className="w-full resize-none text-xs px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:bg-white transition-all" />
            </div>
          </div>
        );
      })}

      <div className="pt-1">
        <button onClick={handleSave} disabled={bulkSubmit.isPending}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {bulkSubmit.isPending ? 'Guardando...' : allResponded ? 'Actualizar disponibilidad' : 'Guardar disponibilidad'}
        </button>
        {bulkSubmit.isSuccess && <p className="text-center text-xs text-blue-600 font-medium mt-2.5">✓ Disponibilidad guardada correctamente</p>}
        {bulkSubmit.isError   && <p className="text-center text-xs text-red-500 mt-2.5">Error al guardar. Intenta nuevamente.</p>}
      </div>
    </div>
  );
}

// ── CoordinadorView (matriz técnicos) ─────────────────────────────────────────

function CoordinadorView({ campusId, weekLabel }: { campusId: number; weekLabel: string }) {
  const { data, isLoading } = useTecnicosMatrix(campusId, weekLabel);

  if (isLoading) return (
    <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}</div>
  );

  if (!data?.encounters.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium text-slate-400">Sin encuentros configurados para este campus.</p>
    </div>
  );

  const { encounters, tecnicos } = data;
  const summary: Record<string, { yes: number; total: number }> = {};
  encounters.forEach((e) => { summary[e.scheduleKey] = { yes: 0, total: tecnicos.length }; });
  tecnicos.forEach((t) => {
    encounters.forEach((e) => { if (t.slots[e.scheduleKey]?.available) summary[e.scheduleKey].yes++; });
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50/80 w-44">Técnico</th>
              {encounters.map((e) => (
                <th key={e.scheduleKey} className="px-4 py-3 text-center text-xs bg-slate-50/80 min-w-[130px]">
                  <div className="font-semibold text-slate-700 capitalize normal-case">{e.dia}</div>
                  {e.bloque && (
                    <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-px rounded-full bg-blue-50 text-blue-600 border border-blue-100 normal-case">{e.bloque}</span>
                  )}
                  <div className="text-slate-400 text-[10px] font-normal normal-case mt-0.5">
                    {new Date(e.encounterDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  </div>
                  <div className="text-slate-300 text-[10px] font-normal normal-case">{e.hora}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tecnicos.length === 0 ? (
              <tr>
                <td colSpan={encounters.length + 1} className="text-center py-12 text-slate-400 text-sm">
                  Ningún técnico ha enviado disponibilidad aún.
                </td>
              </tr>
            ) : tecnicos.map((t) => (
              <tr key={t.userId} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-5 py-3 text-sm font-medium text-slate-800">{t.userName}</td>
                {encounters.map((e) => {
                  const slot = t.slots[e.scheduleKey];
                  if (!slot) return <td key={e.scheduleKey} className="px-4 py-3 text-center"><span className="text-slate-200 text-base">—</span></td>;
                  return (
                    <td key={e.scheduleKey} className="px-4 py-3 text-center">
                      <span title={slot.nota ?? undefined}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold cursor-default ${slot.available ? 'bg-blue-100 text-blue-700' : 'bg-red-50 text-red-500'}`}>
                        {slot.available ? '✓' : '✕'}
                      </span>
                      {slot.nota && <p className="text-[10px] text-slate-400 mt-1 max-w-[110px] mx-auto truncate" title={slot.nota}>{slot.nota}</p>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50/80">
              <td className="px-5 py-2.5 text-xs text-slate-400 font-semibold">Disponibles</td>
              {encounters.map((e) => (
                <td key={e.scheduleKey} className="px-4 py-2.5 text-center">
                  <span className={`text-xs font-bold ${summary[e.scheduleKey].yes > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                    {summary[e.scheduleKey].yes} / {summary[e.scheduleKey].total}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── TecnicosDisponibilidadClient ──────────────────────────────────────────────

export function TecnicosDisponibilidadClient() {
  const user             = useAuthStore((s) => s.user);
  const { can, isAdmin } = usePermissions();

  const isCoordinador = isAdmin || can('tecnicos:view');
  const isTecnico     = isAdmin || can('tecnicos:submit');
  const isBoth        = isCoordinador && isTecnico;

  const [weekLabel,      setWeekLabel]      = useState(() => toWeekLabel(new Date()));
  const [coordCampus,    setCoordCampus]    = useState<number | null>(null);
  const [tecnicoCampus,  setTecnicoCampus]  = useState<number | null>(null);
  const [tab,            setTab]            = useState<'tecnico' | 'coordinador'>('tecnico');

  const tecnicoCampusId = user?.campusId ?? null;

  if (!isTecnico && !isCoordinador) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <p className="text-slate-400 text-sm">No tienes acceso a este módulo.</p>
      </div>
    );
  }

  const showingCoord        = isBoth ? tab === 'coordinador' : isCoordinador;
  const activeVoluntCampus  = isBoth ? tecnicoCampus : tecnicoCampusId;
  const activeCampusId      = showingCoord ? coordCampus : activeVoluntCampus;

  return (
    <div className={showingCoord ? 'max-w-5xl mx-auto' : 'max-w-xl mx-auto'}>

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-6">
        <div className="h-[3px] bg-blue-600" />
        <div className="px-6 pt-5 pb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" />
                  <path d="M2 20c0-4 4-7 10-7s10 3 10 7" />
                  <circle cx="19" cy="8" r="2" />
                  <path d="M19 6V4M19 10v2M17 8h-2M21 8h2" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Producción</p>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">Disponibilidad Técnicos</h1>
              </div>
            </div>
            {showingCoord && <CampusSelector value={coordCampus} onChange={setCoordCampus} />}
            {!showingCoord && isBoth && <CampusSelector value={tecnicoCampus} onChange={setTecnicoCampus} />}
          </div>

          <div className="border-t border-slate-100 my-4" />

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <WeekSelector weekLabel={weekLabel} onChange={setWeekLabel} />
            {isBoth && (
              <div className="flex gap-0.5 p-1 bg-slate-100 rounded-lg">
                <button onClick={() => setTab('tecnico')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === 'tecnico' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Mi disponibilidad
                </button>
                <button onClick={() => setTab('coordinador')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === 'coordinador' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Resumen equipo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Alerta sin campus ────────────────────────────────────────────── */}
      {!showingCoord && !isBoth && !tecnicoCampusId && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-4">
          <p className="text-sm text-amber-800 font-medium">Tu cuenta no tiene un campus asignado.</p>
          <p className="text-xs text-amber-600 mt-0.5">Contacta al administrador para configurarlo.</p>
        </div>
      )}

      {/* ── Contenido ────────────────────────────────────────────────────── */}
      {activeCampusId ? (
        showingCoord
          ? <CoordinadorView campusId={activeCampusId} weekLabel={weekLabel} />
          : <TecnicoView     campusId={activeCampusId} weekLabel={weekLabel} />
      ) : (showingCoord || isBoth) ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col items-center justify-center py-16">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
              <polyline points="9 21 9 13 15 13 15 21" />
            </svg>
          </div>
          <p className="text-sm text-slate-400 font-medium">Selecciona un campus para continuar</p>
        </div>
      ) : null}
    </div>
  );
}
