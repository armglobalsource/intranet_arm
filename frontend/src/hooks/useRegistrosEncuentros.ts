'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';

/** Registro de un encuentro o evento (asistencia, voluntarios y decisiones). */
export interface RegistroEncuentro {
  id: string;
  tipo: 'encuentro' | 'evento';
  campus: string;
  campusId?: number;
  fecha: string;
  fechaPrecision?: 'dia' | 'mes';
  periodo?: string;
  encuentro: string;
  modalidad?: string;
  predicador?: string;
  mensaje?: string;
  eventoNombre?: string;
  eventoDesc?: string;
  eventoHorario?: string;
  presencial?: { acepto?: number; total?: number };
  online?: { acepto?: number; espectadores?: number };
  asistencia?: Record<string, number>;
  voluntarios?: Record<string, number>;
  totalAsistencia?: number;
  totalVoluntarios?: number;
  registradoPor?: { uid: string | number; email: string };
  /** enviado = por revisar · observado = devuelto al líder · subido = cuenta en Estadísticas */
  estado?: 'enviado' | 'observado' | 'subido';
  observacion?: string | null;
  revisadoPor?: { uid: string | number; email: string };
  fechaRevision?: string;
}

export type RegistroInput = Omit<RegistroEncuentro, 'id' | 'campusId' | 'totalAsistencia' | 'totalVoluntarios' | 'registradoPor' | 'estado' | 'observacion' | 'revisadoPor' | 'fechaRevision' | 'fechaPrecision' | 'periodo'> & { idempotencyKey?: string };

const KEY = ['encuentros', 'registros'] as const;

function useRecordScope() {
  const user = useAuthStore((s) => s.user);
  return user ? JSON.stringify([user.id, user.campusId, user.permissions]) : null;
}

/** Registros del último trimestre del campus (o de un campus elegido, para quien ve todos). La API filtra por nombre de campus. */
export function useRegistrosRecientes(campusName?: string) {
  const scope = useRecordScope();
  const { can } = usePermissions();
  const viewCampus = can('encuentros:view');
  const ownOnly = !viewCampus && can('encuentros:create');
  return useQuery<RegistroEncuentro[]>({
    queryKey: [...KEY, scope, campusName ?? 'mine', ownOnly],
    queryFn: () => api.get(ownOnly ? '/encuentros/mine' : '/encuentros', { params: { periodo: 'trim', ...(campusName ? { campusId: campusName } : {}) } }).then((r) => r.data),
    enabled: !!scope && (viewCampus || ownOnly),
    select: (rows) => [...rows].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(a.encuentro).localeCompare(String(b.encuentro))),
  });
}

export interface EncuentroPendiente { campusId: number; campus: string; fecha: string; hora: string; encuentro: string }
export interface RegistroDudoso { id?: string; campusId: number; campus: string; fecha: string; encuentro: string; diaFecha: string; diaNombre: string }

/** Encuentros de los últimos 14 días sin registro, según los horarios del campus, y registros con fecha dudosa. */
export function usePendientesReporte(enabled = true) {
  const scope = useRecordScope();
  return useQuery<{ pendientes: EncuentroPendiente[]; revisar: RegistroDudoso[] }>({
    queryKey: [...KEY, 'pendientes', scope],
    queryFn: () => api.get('/encuentros/pendientes').then((r) => r.data),
    enabled: enabled && !!scope,
    staleTime: 60_000,
  });
}

export function useGuardarRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...dto }: RegistroInput & { id?: string }) => {
      if (!id) return api.post('/encuentros', dto).then((r) => r.data as RegistroEncuentro);
      // La edición no cambia tipo, campus ni clave de reintento.
      const { tipo: _tipo, campus: _campus, idempotencyKey: _key, ...changes } = dto;
      return api.patch(`/encuentros/${id}`, changes).then((r) => r.data as RegistroEncuentro);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['estadisticas'] });
    },
  });
}

export function useEliminarRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/encuentros/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['estadisticas'] });
    },
  });
}

/** Reportes por revisar de los campus que administra el usuario (vacío si no revisa ninguno). */
export function useRevision() {
  const scope = useRecordScope();
  return useQuery<{ campusIds: number[]; items: RegistroEncuentro[] }>({
    queryKey: [...KEY, 'revision', scope],
    queryFn: () => api.get('/encuentros/revision').then((r) => r.data),
    staleTime: 60_000,
    enabled: !!scope,
  });
}

export function useRevisarRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accion, observacion }: { id: string; accion: 'subir' | 'observar'; observacion?: string }) =>
      api.patch(`/encuentros/${id}/${accion}`, accion === 'observar' ? { observacion } : {}).then((r) => r.data as RegistroEncuentro),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['estadisticas'] });
    },
  });
}
