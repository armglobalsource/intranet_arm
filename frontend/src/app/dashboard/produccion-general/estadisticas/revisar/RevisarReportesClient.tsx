'use client';

// Revisión del administrador de campus: los líderes de voluntarios envían el
// reporte de cada encuentro y aquí se revisa y se marca como subido (desde ese
// momento cuenta en Estadísticas) o se devuelve con un comentario.

import { useState } from 'react';
import Link from 'next/link';
import { apiErrorMessage } from '@/lib/api';
import { useAllCampuses } from '@/hooks/useCampus';
import { useActiveArmCatalogos } from '@/hooks/useArmCatalogos';
import { useRevisarRegistro, useRevision, type RegistroEncuentro } from '@/hooks/useRegistrosEncuentros';

function longDate(fecha: string) {
  const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? fecha : d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function Breakdown({ title, values, labels, total }: { title: string; values?: Record<string, number>; labels: Map<string, string>; total?: number }) {
  const entries = Object.entries(values ?? {}).filter(([, v]) => Number(v) > 0);
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{title} · {total ?? 0}</p>
      {entries.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {entries.map(([k, v]) => <li key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{labels.get(k) ?? k}: <strong>{v}</strong></li>)}
        </ul>
      ) : <p className="text-xs text-slate-400">Sin datos</p>}
    </div>
  );
}

function ReporteCard({ r, campusName, labels }: { r: RegistroEncuentro; campusName: string; labels: { asistencia: Map<string, string>; voluntarios: Map<string, string> } }) {
  const revisar = useRevisarRegistro();
  const [devolviendo, setDevolviendo] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const aceptaron = (r.presencial?.acepto ?? 0) + (r.online?.acepto ?? 0);

  async function accion(tipo: 'subir' | 'observar') {
    setError(null);
    try {
      await revisar.mutateAsync({ id: r.id, accion: tipo, observacion: tipo === 'observar' ? observacion : undefined });
    } catch (err) {
      setError(apiErrorMessage(err, tipo === 'subir' ? 'No se pudo subir el reporte' : 'No se pudo devolver el reporte'));
    }
  }

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold capitalize text-slate-500">{longDate(r.fecha)} · {campusName}</p>
          <h2 className="text-base font-bold text-slate-900">
            {r.encuentro}
            {r.tipo === 'evento' && <span className="ml-2 rounded-full bg-amber-50 px-2 text-[10px] font-bold uppercase text-amber-700">Evento</span>}
          </h2>
          <p className="text-xs text-slate-500">
            {[r.modalidad, r.predicador && `Predicó ${r.predicador}`, r.mensaje && `«${r.mensaje}»`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${r.estado === 'observado' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
          {r.estado === 'observado' ? 'Observado' : 'Por revisar'}
        </span>
      </div>

      {r.estado === 'observado' && r.observacion && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800"><strong>Observación enviada:</strong> {r.observacion}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Breakdown title="Asistencia" values={r.asistencia} labels={labels.asistencia} total={r.totalAsistencia} />
        <Breakdown title="Voluntarios" values={r.voluntarios} labels={labels.voluntarios} total={r.totalVoluntarios} />
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Decisiones · {aceptaron}</p>
          <p className="text-xs text-slate-700">
            Presencial: <strong>{r.presencial?.acepto ?? 0}</strong>
            {(r.online?.acepto || r.online?.espectadores) ? <> · Online: <strong>{r.online?.acepto ?? 0}</strong> · Espectadores: <strong>{r.online?.espectadores ?? 0}</strong></> : null}
          </p>
        </div>
      </div>

      {r.registradoPor?.email && <p className="text-[11px] text-slate-400">Enviado por {r.registradoPor.email}</p>}

      {devolviendo && (
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
          ¿Qué hay que corregir?
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} rows={2} maxLength={500}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-violet-500"
            placeholder="Ej: falta la asistencia de Kids" />
        </label>
      )}
      {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={`/dashboard/produccion-general/estadisticas/registrar?editar=${encodeURIComponent(r.id)}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Editar</Link>
        {devolviendo ? (
          <>
            <button type="button" onClick={() => setDevolviendo(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500">Cancelar</button>
            <button type="button" disabled={!observacion.trim() || revisar.isPending} onClick={() => void accion('observar')}
              className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Devolver al líder</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setDevolviendo(true)} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Devolver</button>
            <button type="button" disabled={revisar.isPending} onClick={() => void accion('subir')}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{revisar.isPending ? 'Guardando…' : 'Subir'}</button>
          </>
        )}
      </div>
    </article>
  );
}

export function RevisarReportesClient() {
  const { data, isLoading, isError, refetch } = useRevision();
  const { data: campuses = [] } = useAllCampuses();
  const { data: asistenciaCat = [] } = useActiveArmCatalogos('asistencia');
  const { data: voluntariosCat = [] } = useActiveArmCatalogos('voluntarios');
  const [filtro, setFiltro] = useState<'enviado' | 'observado'>('enviado');
  const labels = {
    asistencia: new Map(asistenciaCat.map((c) => [c.key, c.label])),
    voluntarios: new Map(voluntariosCat.map((c) => [c.key, c.label])),
  };
  const campusName = (id?: number) => campuses.find((c) => c.id === id)?.name ?? '';
  const items = data?.items ?? [];
  const visibles = items.filter((r) => (filtro === 'observado' ? r.estado === 'observado' : r.estado !== 'observado'));
  const porRevisar = items.filter((r) => r.estado !== 'observado').length;
  const observados = items.length - porRevisar;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-10">
      <header className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-violet-50 p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Estadísticas · Administración de campus</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Revisar reportes</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">Los líderes de voluntarios envían el reporte de cada encuentro. Revísalo y súbelo para que cuente en Estadísticas, o devuélvelo con un comentario.</p>
          </div>
          <Link href="/dashboard/produccion-general/estadisticas" className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700">Ver estadísticas</Link>
        </div>
      </header>

      {isLoading ? <p role="status" className="text-sm text-slate-500">Cargando reportes…</p>
        : isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudieron cargar los reportes. <button className="font-semibold underline" onClick={() => void refetch()}>Reintentar</button></div>
        : !data?.campusIds.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            No administras ningún campus. Para revisar reportes necesitas el permiso «Revisar y subir los reportes de su campus» o estar en la lista de Administradores de tu campus (Directorio › Campus).
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado de los reportes">
              {([['enviado', `Por revisar (${porRevisar})`], ['observado', `Observados (${observados})`]] as const).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${filtro === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>
              ))}
            </div>
            {visibles.length === 0 ? (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
                {filtro === 'enviado' ? 'No hay reportes por revisar. ¡Todo al día!' : 'No hay reportes devueltos esperando corrección.'}
              </p>
            ) : (
              <div className="space-y-3">
                {visibles.map((r) => <ReporteCard key={r.id} r={r} campusName={campusName(r.campusId)} labels={labels} />)}
              </div>
            )}
          </>
        )}
    </div>
  );
}
