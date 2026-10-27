'use client';

// Registro de encuentros y eventos desde la intranet: asistencia por categoría,
// voluntarios por área y decisiones. Reemplaza el reporte por tareas de Asana.
// Los nombres siguen el formato del historial («Encuentro Domingo 09:00 hrs»)
// para que el panel de Estadísticas compare encuentros nuevos y antiguos.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';
import { useAllCampuses, type Campus } from '@/hooks/useCampus';
import { useActiveArmCatalogos } from '@/hooks/useArmCatalogos';
import {
  useEliminarRegistro, useGuardarRegistro, usePendientesReporte, useRegistrosRecientes, useRevision,
  type EncuentroPendiente, type RegistroEncuentro, type RegistroInput,
} from '@/hooks/useRegistrosEncuentros';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MODALIDADES = ['Presencial', 'Presencial+Online', 'Online'] as const;
const OTRO = '__otro__';

const inputCls = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-emerald-500';
const labelCls = 'grid gap-1.5 text-xs font-semibold text-slate-600';

function todayInSantiago() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
}
function weekday(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : DAYS[d.getDay()];
}
function mondayOf(fecha: string) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function hhmm(hora: string) {
  const m = /(\d{1,2})[:.](\d{2})/.exec(hora ?? '');
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : hora;
}
function shortDate(fecha: string) {
  const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}
const toNum = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.round(Number(v))));
const sum = (r: Record<string, string>) => Object.values(r).reduce((n, v) => n + (toNum(v) ?? 0), 0);

/** Encuentros del campus para ese día, según sus horarios, con el nombre del historial. */
function encuentrosDelDia(campus: Campus | undefined, fecha: string) {
  const dia = weekday(fecha);
  return (campus?.schedules ?? [])
    .filter((s) => s.dia === dia)
    .sort((a, b) => hhmm(a.hora).localeCompare(hhmm(b.hora)))
    .map((s) => ({
      hora: hhmm(s.hora),
      label: s.fichaType === 'oracion' ? `Encuentro Oración ${dia} ${hhmm(s.hora)} hrs` : `Encuentro ${dia} ${hhmm(s.hora)} hrs`,
    }));
}

interface FormState {
  id?: string;
  key: string;
  tipo: 'encuentro' | 'evento';
  fecha: string;
  encuentroSel: string;
  encuentroOtro: string;
  modalidad: string;
  predicador: string;
  mensaje: string;
  eventoNombre: string;
  eventoHora: string;
  eventoDesc: string;
  aceptoPresencial: string;
  aceptoOnline: string;
  espectadores: string;
  asistencia: Record<string, string>;
  voluntarios: Record<string, string>;
}

const emptyForm = (fecha = todayInSantiago()): FormState => ({
  key: newKey(), tipo: 'encuentro', fecha, encuentroSel: '', encuentroOtro: '', modalidad: 'Presencial',
  predicador: '', mensaje: '', eventoNombre: '', eventoHora: '', eventoDesc: '',
  aceptoPresencial: '', aceptoOnline: '', espectadores: '', asistencia: {}, voluntarios: {},
});

const asText = (r?: Record<string, number>) => Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, String(v ?? '')]));

/** Predicador según la ficha técnica publicada de ese encuentro, si existe. */
function usePredicadorDeFicha(campusId: number | undefined, fecha: string, hora: string | undefined) {
  const week = useQuery<any[]>({
    queryKey: ['fichas', 'public-week', mondayOf(fecha)],
    queryFn: () => api.get('/fichas/public/week', { params: { start: mondayOf(fecha) } }).then((r) => r.data),
    enabled: !!campusId && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !!hora,
    staleTime: 5 * 60 * 1000,
  });
  const match = (week.data ?? []).find((f) =>
    String(f.campusId) === String(campusId)
    && new Date(f.date).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }) === fecha
    && (f.encuentros ?? []).some((e: any) => hhmm(e.time) === hora));
  const ficha = useQuery<any>({
    queryKey: ['fichas', 'public', match?.fichaId ?? match?.document_id],
    queryFn: () => api.get(`/fichas/public/${match.fichaId ?? match.document_id}`).then((r) => r.data),
    enabled: !!match,
    staleTime: 5 * 60 * 1000,
  });
  if (!ficha.data) return null;
  const enc = (ficha.data.encuentros ?? []).find((e: any) => hhmm(e.time) === hora);
  const row = (ficha.data.sections?.pastoral?.rows ?? []).find((r: any) => /predicaci/i.test(r.label ?? ''));
  const value = row ? String((row.shared ? row.values?.shared : row.values?.[enc?.id]) ?? '').trim() : '';
  return value ? { predicador: value, ficha: ficha.data.title as string } : null;
}

export function RegistrarEncuentroClient() {
  const { isAdmin, can } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  // Entran los líderes que registran y los administradores de campus que revisan.
  const canCreate = isAdmin || can('encuentros:create');
  const revision = useRevision();
  const reviewCampuses = revision.data?.campusIds ?? [];
  const allowed = canCreate || reviewCampuses.length > 0;
  useEffect(() => {
    if (!canCreate && revision.isSuccess && !reviewCampuses.length) router.replace('/dashboard');
  }, [canCreate, revision.isSuccess, reviewCampuses.length, router]);
  const allCampus = isAdmin || can('estadisticas:viewAll');
  const canEdit = isAdmin || can('encuentros:edit');
  const canDelete = isAdmin || can('encuentros:delete');
  const isReviewer = (r: RegistroEncuentro) => r.campusId != null && reviewCampuses.includes(Number(r.campusId));
  const isOwn = (r: RegistroEncuentro) => r.registradoPor?.uid != null && String(r.registradoPor.uid) === String(user?.id);
  /** Lo subido solo lo toca el administrador; antes, quien edita en el campus o quien lo envió. */
  const puedeEditar = (r: RegistroEncuentro) => isReviewer(r) || (r.estado !== 'subido' && (canEdit || isOwn(r)));
  const puedeEliminar = (r: RegistroEncuentro) => isReviewer(r) || (r.estado !== 'subido' && canDelete);

  const { data: campuses = [] } = useAllCampuses();
  const activeCampuses = campuses.filter((c) => c.isActive);
  const [campusId, setCampusId] = useState<number | undefined>(undefined);
  useEffect(() => { if (campusId == null && user?.campusId) setCampusId(Number(user.campusId)); }, [user?.campusId, campusId]);
  const campus = campuses.find((c) => c.id === campusId);

  const { data: asistenciaCat = [] } = useActiveArmCatalogos('asistencia');
  const { data: voluntariosCat = [] } = useActiveArmCatalogos('voluntarios');
  const asistenciaKeys = asistenciaCat.filter((c) => !campus?.asistenciaCategoriaKeys?.length || campus.asistenciaCategoriaKeys.includes(c.key));
  const voluntariosKeys = voluntariosCat.filter((c) => !campus?.voluntarioCategoriaKeys?.length || campus.voluntarioCategoriaKeys.includes(c.key));

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (notice) {
      noticeRef.current?.scrollIntoView({ block: 'center' });
      noticeRef.current?.focus({ preventScroll: true });
    }
  }, [notice]);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const opciones = useMemo(() => encuentrosDelDia(campus, form.fecha), [campus, form.fecha]);
  const horaSel = opciones.find((o) => o.label === form.encuentroSel)?.hora;
  const sugerido = usePredicadorDeFicha(form.tipo === 'encuentro' ? campus?.id : undefined, form.fecha, horaSel);
  useEffect(() => {
    if (sugerido && !form.predicador) set({ predicador: sugerido.predicador });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugerido?.predicador]);

  const registros = useRegistrosRecientes(allCampus ? campus?.name : undefined);
  const pendientesQ = usePendientesReporte(canCreate);
  const pendientes = (pendientesQ.data?.pendientes ?? []).filter((p) => !allCampus || !campus || p.campusId === campus.id);
  const revisar = (pendientesQ.data?.revisar ?? []).filter((r) => !allCampus || !campus || r.campusId === campus.id);

  /** Abre el formulario con un encuentro pendiente ya elegido. */
  function reportar(p: Pick<EncuentroPendiente, 'campusId' | 'fecha' | 'encuentro'>) {
    const target = allCampus ? campuses.find((c) => c.id === p.campusId) ?? campus : campus;
    if (allCampus && target) setCampusId(target.id);
    // Si el nombre no está entre los horarios de ese día, queda escrito en «Otro».
    const known = encuentrosDelDia(target, p.fecha).some((o) => o.label === p.encuentro);
    setForm({ ...emptyForm(p.fecha), encuentroSel: known ? p.encuentro : OTRO, encuentroOtro: known ? '' : p.encuentro });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Enlaces desde el Inicio: ?fecha=AAAA-MM-DD&encuentro=…&campus=ID
  const params = useSearchParams();
  const appliedParams = useRef(false);
  useEffect(() => {
    if (appliedParams.current || !campuses.length) return;
    const fecha = params?.get('fecha'), encuentro = params?.get('encuentro'), campusParam = Number(params?.get('campus'));
    const editarId = params?.get('editar');
    if (editarId) void editarPorId(editarId);
    else if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && encuentro) {
      reportar({ fecha, encuentro, campusId: Number.isFinite(campusParam) && campusParam > 0 ? campusParam : Number(user?.campusId) });
    }
    appliedParams.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campuses.length]);

  async function editarPorId(id?: string) {
    if (!id) return;
    try {
      const record = (registros.data ?? []).find((r) => r.id === id) ?? (await api.get(`/encuentros/${id}`)).data;
      editar(record);
    } catch (err) {
      setNotice({ ok: false, text: apiErrorMessage(err, 'No se pudo abrir el registro') });
    }
  }
  const guardar = useGuardarRegistro();
  const eliminar = useEliminarRegistro();

  const online = /online|virtual/i.test(form.modalidad);
  const encuentroLabel = form.encuentroSel === OTRO ? form.encuentroOtro.trim() : form.encuentroSel;
  const eventoLabel = form.eventoNombre.trim() ? `${form.eventoNombre.trim()}${form.eventoHora ? ` ${form.eventoHora} hrs` : ''}` : '';
  const yaRegistrado = form.tipo === 'encuentro' && !form.id && (registros.data ?? []).some((r) =>
    r.tipo !== 'evento' && String(r.fecha).slice(0, 10) === form.fecha && r.encuentro.trim().toLowerCase() === encuentroLabel.toLowerCase());

  function editar(r: RegistroEncuentro) {
    if (r.fechaPrecision === 'mes') {
      setNotice({ ok: false, text: 'Este reporte histórico solo tiene mes conocido. No se edita como un encuentro con día exacto.' });
      return;
    }
    const recordCampus = campuses.find((c) => c.id === Number(r.campusId));
    if (recordCampus) setCampusId(recordCampus.id);
    const fecha = String(r.fecha).slice(0, 10);
    const known = encuentrosDelDia(recordCampus ?? campus, fecha).some((o) => o.label === r.encuentro);
    const horaEvento = /(\d{2}:\d{2}) hrs$/.exec(r.eventoNombre ?? '')?.[1] ?? '';
    setForm({
      ...emptyForm(fecha), id: r.id, tipo: r.tipo, fecha,
      encuentroSel: r.tipo === 'encuentro' ? (known ? r.encuentro : OTRO) : '',
      encuentroOtro: r.tipo === 'encuentro' && !known ? r.encuentro : '',
      modalidad: r.modalidad || 'Presencial', predicador: r.predicador ?? '', mensaje: r.mensaje ?? '',
      eventoNombre: (r.eventoNombre ?? '').replace(/\s*\d{2}:\d{2} hrs$/, ''), eventoHora: horaEvento, eventoDesc: r.eventoDesc ?? '',
      aceptoPresencial: String(r.presencial?.acepto ?? ''), aceptoOnline: String(r.online?.acepto ?? ''), espectadores: String(r.online?.espectadores ?? ''),
      asistencia: asText(r.asistencia), voluntarios: asText(r.voluntarios),
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function borrar(r: RegistroEncuentro) {
    if (!window.confirm(`¿Eliminar el registro «${r.encuentro}» del ${shortDate(r.fecha)}? No se puede deshacer.`)) return;
    try {
      await eliminar.mutateAsync(r.id);
      setNotice({ ok: true, text: 'Registro eliminado.' });
      if (form.id === r.id) setForm(emptyForm(form.fecha));
    } catch (err) {
      setNotice({ ok: false, text: apiErrorMessage(err, 'No se pudo eliminar el registro') });
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!campus) return setNotice({ ok: false, text: 'Elige el campus.' });
    if (form.tipo === 'encuentro' && !encuentroLabel) return setNotice({ ok: false, text: 'Elige el encuentro.' });
    if (form.tipo === 'evento' && (!form.eventoNombre.trim() || !form.eventoHora)) return setNotice({ ok: false, text: 'Escribe el nombre y la hora del evento.' });
    const nums = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, toNum(v)]).filter(([, v]) => v !== undefined)) as Record<string, number>;
    const payload: RegistroInput = {
      tipo: form.tipo, campus: campus.name, fecha: form.fecha,
      modalidad: form.modalidad, predicador: form.predicador.trim(), mensaje: form.mensaje.trim(),
      ...(form.tipo === 'encuentro'
        ? { encuentro: encuentroLabel }
        : { encuentro: eventoLabel, eventoNombre: eventoLabel, eventoHorario: eventoLabel, eventoDesc: form.eventoDesc.trim() }),
      presencial: { acepto: toNum(form.aceptoPresencial) ?? 0 },
      online: online ? { acepto: toNum(form.aceptoOnline) ?? 0, espectadores: toNum(form.espectadores) ?? 0 } : { acepto: 0, espectadores: 0 },
      asistencia: nums(form.asistencia),
      voluntarios: nums(form.voluntarios),
      idempotencyKey: form.key,
    };
    try {
      await guardar.mutateAsync({ ...payload, id: form.id });
      const nombre = `${form.tipo === 'encuentro' ? encuentroLabel : eventoLabel} · ${shortDate(form.fecha)}`;
      setNotice({ ok: true, text: form.id ? `Cambios guardados: ${nombre}.` : `Reporte enviado: ${nombre}. Queda por revisar hasta que el administrador del campus lo suba.` });
      setForm(emptyForm(form.fecha));
    } catch (err) {
      setNotice({ ok: false, text: apiErrorMessage(err, 'No se pudo guardar el registro') });
    }
  }

  if (!allowed) return revision.isError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">No se pudieron verificar los permisos. <button onClick={() => void revision.refetch()} className="underline">Reintentar</button></p> : null;

  const numberInput = (value: string, onChange: (v: string) => void, label: string) => (
    <label key={label} className={`${labelCls} stats-number-field`}>
      <span>{label}</span>
      <input type="number" inputMode="numeric" min={0} step={1} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Sin dato" className={inputCls} />
    </label>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Estadísticas · {campus?.name ?? 'Tu campus'}</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{form.id ? 'Editar registro' : 'Registrar encuentro'}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Ingresa la asistencia, los voluntarios y las decisiones. El administrador revisa el reporte y lo sube para incorporarlo a Estadísticas.</p>
          </div>
          <Link href="/dashboard/produccion-general/estadisticas" className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700">Ver estadísticas</Link>
        </div>
      </header>

      {(pendientes.length > 0 || revisar.length > 0) && !form.id && (
        <section aria-label="Pendientes de reportar" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
          {pendientes.length > 0 && <>
            <h2 className="font-bold text-slate-900">Pendientes de reportar</h2>
            <p className="mb-3 text-xs text-slate-600">Según los horarios del campus, estos encuentros de las últimas dos semanas aún no tienen registro.</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {pendientes.slice(0, 8).map((p) => (
                <li key={`${p.campusId}-${p.fecha}-${p.hora}`} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-3 py-2">
                  <span className="min-w-0 text-sm">
                    <span className="block font-semibold text-slate-800">{p.encuentro}</span>
                    <span className="block text-xs capitalize text-slate-500">{shortDate(p.fecha)}{allCampus ? ` · ${p.campus}` : ''}</span>
                  </span>
                  <button type="button" onClick={() => reportar(p)} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Registrar</button>
                </li>
              ))}
            </ul>
            {pendientes.length > 8 && <p className="mt-2 text-xs text-slate-500">Y {pendientes.length - 8} más.</p>}
          </>}
          {revisar.length > 0 && <div className={pendientes.length ? 'mt-4' : ''}>
            <h2 className="font-bold text-slate-900">Revisar la fecha</h2>
            <p className="mb-2 text-xs text-slate-600">El nombre de estos registros dice un día distinto al de su fecha.</p>
            <ul className="space-y-1">
              {revisar.slice(0, 6).map((r) => (
                <li key={r.id ?? `${r.campusId}-${r.fecha}-${r.encuentro}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700"><strong>{r.encuentro}</strong> con fecha {shortDate(r.fecha)} ({r.diaFecha.toLowerCase()}){allCampus ? ` · ${r.campus}` : ''}</span>
                  {canEdit && r.id && <button type="button" onClick={() => void editarPorId(r.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Corregir</button>}
                </li>
              ))}
            </ul>
          </div>}
        </section>
      )}

      {notice && (
        <div ref={noticeRef} tabIndex={-1} role={notice.ok ? 'status' : 'alert'} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {notice.text}
        </div>
      )}

      {!canCreate && !form.id ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Para registrar encuentros necesitas el permiso «Registrar nuevos encuentros». Revisa los reportes del campus en <Link href="/dashboard/produccion-general/estadisticas/revisar" className="font-semibold text-emerald-700 underline">Revisar reportes</Link>.</p>
      ) : (
      <form onSubmit={enviar} className="space-y-5">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="font-bold text-slate-900">Datos del encuentro</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de registro">
            {(['encuentro', 'evento'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={form.tipo === t} disabled={!!form.id}
                onClick={() => set({ tipo: t })}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${form.tipo === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'} disabled:opacity-60`}>
                {t === 'encuentro' ? 'Encuentro' : 'Evento'}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allCampus && (
              <label className={labelCls}>Campus
                <select className={inputCls} value={campusId ?? ''} disabled={!!form.id} onChange={(e) => { setCampusId(Number(e.target.value)); set({ encuentroSel: '' }); }}>
                  <option value="" disabled>Elige un campus</option>
                  {activeCampuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            <label className={labelCls}>Fecha
              <input type="date" required className={inputCls} value={form.fecha} max={todayInSantiago()}
                onChange={(e) => set({ fecha: e.target.value, encuentroSel: '' })} />
            </label>
            {form.tipo === 'encuentro' ? (
              <label className={labelCls}>Encuentro
                <select className={inputCls} value={form.encuentroSel} onChange={(e) => set({ encuentroSel: e.target.value })}>
                  <option value="">{opciones.length ? 'Elige el encuentro' : `Sin horarios el ${weekday(form.fecha).toLowerCase()}`}</option>
                  {opciones.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
                  <option value={OTRO}>Otro (escribir)</option>
                </select>
              </label>
            ) : (
              <>
                <label className={labelCls}>Nombre del evento
                  <input className={inputCls} value={form.eventoNombre} onChange={(e) => set({ eventoNombre: e.target.value })} placeholder="Ej: Fiestas Patrias" />
                </label>
                <label className={labelCls}>Hora
                  <input type="time" className={inputCls} value={form.eventoHora} onChange={(e) => set({ eventoHora: e.target.value })} />
                </label>
              </>
            )}
            {form.tipo === 'encuentro' && form.encuentroSel === OTRO && (
              <label className={labelCls}>Nombre del encuentro
                <input className={inputCls} value={form.encuentroOtro} onChange={(e) => set({ encuentroOtro: e.target.value })} placeholder={`Ej: Encuentro ${weekday(form.fecha)} 16:30 hrs`} />
              </label>
            )}
            <label className={labelCls}>Modalidad
              <select className={inputCls} value={form.modalidad} onChange={(e) => set({ modalidad: e.target.value })}>
                {MODALIDADES.map((m) => <option key={m} value={m}>{m === 'Presencial+Online' ? 'Presencial + Online' : m}</option>)}
              </select>
            </label>
            <label className={labelCls}>Predicador
              <input className={inputCls} value={form.predicador} onChange={(e) => set({ predicador: e.target.value })} />
              {sugerido && <span className="text-[11px] font-normal text-slate-500">Según la ficha «{sugerido.ficha}»</span>}
            </label>
            <label className={labelCls}>Mensaje
              <input className={inputCls} value={form.mensaje} onChange={(e) => set({ mensaje: e.target.value })} placeholder="Título del mensaje" />
            </label>
            {form.tipo === 'evento' && (
              <label className={`${labelCls} sm:col-span-2 lg:col-span-3`}>Descripción
                <input className={inputCls} value={form.eventoDesc} onChange={(e) => set({ eventoDesc: e.target.value })} />
              </label>
            )}
          </div>
          {form.id && (registros.data ?? []).find((r) => r.id === form.id)?.estado === 'observado' && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800"><strong>Observación:</strong> {(registros.data ?? []).find((r) => r.id === form.id)?.observacion}. Al guardar, el reporte vuelve a quedar por revisar.</p>
          )}
          {yaRegistrado && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Este encuentro ya está registrado. Edítalo en la lista de abajo en vez de crear otro.</p>
          )}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold text-slate-900">Asistencia</h2>
            <span className="text-sm font-semibold text-slate-600">Total: {sum(form.asistencia)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {asistenciaKeys.map((c) => numberInput(form.asistencia[c.key] ?? '', (v) => set({ asistencia: { ...form.asistencia, [c.key]: v } }), c.label))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="font-bold text-slate-900">Decisiones</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {numberInput(form.aceptoPresencial, (v) => set({ aceptoPresencial: v }), 'Aceptaron a Jesús (presencial)')}
            {online && numberInput(form.aceptoOnline, (v) => set({ aceptoOnline: v }), 'Aceptaron a Jesús (online)')}
            {online && numberInput(form.espectadores, (v) => set({ espectadores: v }), 'Espectadores online')}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold text-slate-900">Voluntarios</h2>
            <span className="text-sm font-semibold text-slate-600">Total: {sum(form.voluntarios)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {voluntariosKeys.map((c) => numberInput(form.voluntarios[c.key] ?? '', (v) => set({ voluntarios: { ...form.voluntarios, [c.key]: v } }), c.label))}
          </div>
        </section>

        <div className="stats-form-actions flex flex-wrap justify-end gap-2">
          <p>Revisa las cifras antes de guardar. El administrador del campus revisará el reporte para incorporarlo a Estadísticas.</p>
          {form.id && (
            <button type="button" onClick={() => setForm(emptyForm(form.fecha))} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600">Cancelar edición</button>
          )}
          <button type="submit" disabled={guardar.isPending} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {guardar.isPending ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Guardar registro'}
          </button>
        </div>
      </form>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Registros recientes">
        <h2 className="font-bold text-slate-900">Registros recientes{campus ? ` · ${campus.name}` : ''}</h2>
        <p className="mb-3 text-xs text-slate-500">Últimos tres meses.</p>
        {registros.isError ? <p role="alert" className="text-sm text-red-700">No se pudieron cargar los registros. <button onClick={() => void registros.refetch()} className="underline">Reintentar</button></p>
          : registros.isLoading ? <p className="text-sm text-slate-500">Cargando…</p>
          : !(registros.data ?? []).length ? <p className="text-sm text-slate-500">Todavía no hay registros en este período.</p>
          : (
            <ul className="divide-y divide-slate-100">
              {(registros.data ?? []).slice(0, 40).map((r) => (
                <li key={r.id} className="stats-recent-row flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
                  <span className="w-36 shrink-0 text-xs font-semibold capitalize text-slate-500">{shortDate(r.fecha)}</span>
                  <span className="min-w-0 flex-1 font-semibold text-slate-800">
                    {r.encuentro}
                    {r.tipo === 'evento' && <span className="ml-2 rounded-full bg-amber-50 px-2 text-[10px] font-bold uppercase text-amber-700">Evento</span>}
                  </span>
                  <span className="text-xs text-slate-600">{r.totalAsistencia ?? 0} asistentes · {r.totalVoluntarios ?? 0} voluntarios · {(r.presencial?.acepto ?? 0) + (r.online?.acepto ?? 0)} aceptaron</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.estado === 'subido' ? 'bg-emerald-50 text-emerald-700' : r.estado === 'observado' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                    {r.estado === 'subido' ? 'Subido' : r.estado === 'observado' ? 'Observado' : 'Por revisar'}
                  </span>
                  <span className="flex gap-1">
                    {puedeEditar(r) && <button type="button" onClick={() => editar(r)} className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">{r.estado === 'observado' && !isReviewer(r) ? 'Corregir' : 'Editar'}</button>}
                    {puedeEliminar(r) && <button type="button" onClick={() => borrar(r)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Eliminar</button>}
                  </span>
                  {r.estado === 'observado' && r.observacion && (
                    <p className="w-full rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-800"><strong>Observación del administrador:</strong> {r.observacion}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
