import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type CampusTurnoTipo = 'administradores' | 'lideres_voluntarios';

// Rotación paralela opcional dentro del mismo tipo — hoy usada por lideres_voluntarios
// para separar Miércoles + Domingo AM (modalidad 'AM') de Domingo PM (modalidad 'PM').
// `administradores` no la usa (queda undefined en equipos/turnos existentes).
export type Modalidad = 'AM' | 'PM';

export interface Administrador {
  id:        number;
  campusId:  number;
  tipo:      CampusTurnoTipo;
  nombre:    string;
  isActive:  boolean;
}

export interface Equipo {
  id:               number;
  campusId:         number;
  tipo:             CampusTurnoTipo;
  nombre:           string;
  administradorIds: number[];
  modalidad?:       Modalidad | null;
  isActive:         boolean;
}

export interface Turno {
  id:                   number;
  campusId:             number;
  tipo:                 CampusTurnoTipo;
  fecha:                string; // 'YYYY-MM-DD', lunes
  equipoId:             number;
  modalidad?:           Modalidad | null;
  equipoNombreSnapshot: string;
  isManualOverride:     boolean;
}

const keys = {
  administradores: (campusId: number, tipo: CampusTurnoTipo) => ['campus-turnos', 'administradores', campusId, tipo] as const,
  equipos:         (campusId: number, tipo: CampusTurnoTipo) => ['campus-turnos', 'equipos', campusId, tipo] as const,
  turnos:          (campusId: number, tipo: CampusTurnoTipo) => ['campus-turnos', 'turnos', campusId, tipo] as const,
};

// ── Administradores ─────────────────────────────────────────────────────────

export function useAdministradores(campusId: number, tipo: CampusTurnoTipo) {
  return useQuery<Administrador[]>({
    queryKey: keys.administradores(campusId, tipo),
    queryFn:  () => api.get('/campus-turnos/administradores', { params: { campusId, tipo } }).then((r) => r.data),
    enabled:  Number.isFinite(campusId),
    staleTime: 60 * 1000,
  });
}

export function useCreateAdministrador(campusId: number, tipo: CampusTurnoTipo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nombre: string) =>
      api.post('/campus-turnos/administradores', { campusId, tipo, nombre }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.administradores(campusId, tipo) }),
  });
}

export function useUpdateAdministrador(campusId: number, tipo: CampusTurnoTipo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { nombre?: string; isActive?: boolean } }) =>
      api.patch(`/campus-turnos/administradores/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.administradores(campusId, tipo) }),
  });
}

// ── Equipos ──────────────────────────────────────────────────────────────────

export function useEquipos(campusId: number, tipo: CampusTurnoTipo) {
  return useQuery<Equipo[]>({
    queryKey: keys.equipos(campusId, tipo),
    queryFn:  () => api.get('/campus-turnos/equipos', { params: { campusId, tipo } }).then((r) => r.data),
    enabled:  Number.isFinite(campusId),
    staleTime: 60 * 1000,
  });
}

export function useCreateEquipo(campusId: number, tipo: CampusTurnoTipo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; administradorIds: number[]; modalidad?: Modalidad }) =>
      api.post('/campus-turnos/equipos', { campusId, tipo, ...data }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.equipos(campusId, tipo) }),
  });
}

export function useUpdateEquipo(campusId: number, tipo: CampusTurnoTipo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { nombre?: string; administradorIds?: number[]; isActive?: boolean; modalidad?: Modalidad } }) =>
      api.patch(`/campus-turnos/equipos/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.equipos(campusId, tipo) }),
  });
}

// ── Turnos (calendario) ────────────────────────────────────────────────────────

export function useTurnos(campusId: number, tipo: CampusTurnoTipo) {
  return useQuery<Turno[]>({
    queryKey: keys.turnos(campusId, tipo),
    queryFn:  () => api.get('/campus-turnos/turnos', { params: { campusId, tipo } }).then((r) => r.data),
    enabled:  Number.isFinite(campusId),
    staleTime: 60 * 1000,
  });
}

export function useGenerarCalendario(campusId: number, tipo: CampusTurnoTipo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { equipoIds: number[]; fechaInicio: string; semanas: number; modalidad?: Modalidad }) =>
      api.post('/campus-turnos/turnos/generar', { campusId, tipo, ...data }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.turnos(campusId, tipo) }),
  });
}

export function useUpdateTurno(campusId: number, tipo: CampusTurnoTipo) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, equipoId }: { id: number; equipoId: number }) =>
      api.patch(`/campus-turnos/turnos/${id}`, { equipoId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.turnos(campusId, tipo) }),
  });
}
