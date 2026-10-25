'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Registro de un encuentro o evento (asistencia, voluntarios y decisiones). */
export interface RegistroEncuentro {
  id: string;
  tipo: 'encuentro' | 'evento';
  campus: string;
  campusId?: number;
  fecha: string;
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
}

export type RegistroInput = Omit<RegistroEncuentro, 'id' | 'campusId' | 'totalAsistencia' | 'totalVoluntarios' | 'registradoPor'> & { idempotencyKey?: string };

const KEY = ['encuentros', 'registros'] as const;

/** Registros del último trimestre del campus (o de un campus elegido, para quien ve todos). La API filtra por nombre de campus. */
export function useRegistrosRecientes(campusName?: string) {
  return useQuery<RegistroEncuentro[]>({
    queryKey: [...KEY, campusName ?? 'mine'],
    queryFn: () => api.get('/encuentros', { params: { periodo: 'trim', ...(campusName ? { campusId: campusName } : {}) } }).then((r) => r.data),
    select: (rows) => [...rows].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(a.encuentro).localeCompare(String(b.encuentro))),
  });
}

export interface EncuentroPendiente { campusId: number; campus: string; fecha: string; hora: string; encuentro: string }
export interface RegistroDudoso { id?: string; campusId: number; campus: string; fecha: string; encuentro: string; diaFecha: string; diaNombre: string }

/** Encuentros de los últimos 14 días sin registro, según los horarios del campus, y registros con fecha dudosa. */
export function usePendientesReporte(enabled = true) {
  return useQuery<{ pendientes: EncuentroPendiente[]; revisar: RegistroDudoso[] }>({
    queryKey: [...KEY, 'pendientes'],
    queryFn: () => api.get('/encuentros/pendientes').then((r) => r.data),
    enabled,
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
