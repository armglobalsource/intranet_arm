import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Administrador {
  id:        number;
  campusId:  number;
  nombre:    string;
  isActive:  boolean;
}

export interface Equipo {
  id:               number;
  campusId:         number;
  nombre:           string;
  administradorIds: number[];
  isActive:         boolean;
}

export interface Turno {
  id:                   number;
  campusId:             number;
  fecha:                string; // 'YYYY-MM-DD', lunes
  equipoId:             number;
  equipoNombreSnapshot: string;
  isManualOverride:     boolean;
}

const keys = {
  administradores: (campusId: number) => ['campus-turnos', 'administradores', campusId] as const,
  equipos:         (campusId: number) => ['campus-turnos', 'equipos', campusId] as const,
  turnos:          (campusId: number) => ['campus-turnos', 'turnos', campusId] as const,
};

// ── Administradores ─────────────────────────────────────────────────────────

export function useAdministradores(campusId: number) {
  return useQuery<Administrador[]>({
    queryKey: keys.administradores(campusId),
    queryFn:  () => api.get('/campus-turnos/administradores', { params: { campusId } }).then((r) => r.data),
    enabled:  Number.isFinite(campusId),
    staleTime: 60 * 1000,
  });
}

export function useCreateAdministrador(campusId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nombre: string) =>
      api.post('/campus-turnos/administradores', { campusId, nombre }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.administradores(campusId) }),
  });
}

export function useUpdateAdministrador(campusId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { nombre?: string; isActive?: boolean } }) =>
      api.patch(`/campus-turnos/administradores/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.administradores(campusId) }),
  });
}

// ── Equipos ──────────────────────────────────────────────────────────────────

export function useEquipos(campusId: number) {
  return useQuery<Equipo[]>({
    queryKey: keys.equipos(campusId),
    queryFn:  () => api.get('/campus-turnos/equipos', { params: { campusId } }).then((r) => r.data),
    enabled:  Number.isFinite(campusId),
    staleTime: 60 * 1000,
  });
}

export function useCreateEquipo(campusId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; administradorIds: number[] }) =>
      api.post('/campus-turnos/equipos', { campusId, ...data }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.equipos(campusId) }),
  });
}

export function useUpdateEquipo(campusId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { nombre?: string; administradorIds?: number[]; isActive?: boolean } }) =>
      api.patch(`/campus-turnos/equipos/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.equipos(campusId) }),
  });
}

// ── Turnos (calendario) ────────────────────────────────────────────────────────

export function useTurnos(campusId: number) {
  return useQuery<Turno[]>({
    queryKey: keys.turnos(campusId),
    queryFn:  () => api.get('/campus-turnos/turnos', { params: { campusId } }).then((r) => r.data),
    enabled:  Number.isFinite(campusId),
    staleTime: 60 * 1000,
  });
}

export function useGenerarCalendario(campusId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { equipoIds: number[]; fechaInicio: string; semanas: number }) =>
      api.post('/campus-turnos/turnos/generar', { campusId, ...data }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.turnos(campusId) }),
  });
}

export function useUpdateTurno(campusId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, equipoId }: { id: number; equipoId: number }) =>
      api.patch(`/campus-turnos/turnos/${id}`, { equipoId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.turnos(campusId) }),
  });
}
