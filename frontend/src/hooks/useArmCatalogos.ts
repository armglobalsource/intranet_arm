import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type ArmCatalogoTipo = 'asistencia' | 'voluntarios' | 'moneda';

export interface ArmCatalogo {
  id:         number;
  tipo:       ArmCatalogoTipo;
  key:        string;
  label:      string;
  sortOrder:  number;
  isActive:   boolean;
  createdAt:  string;
  updatedAt:  string;
}

export interface ArmCatalogoActive {
  key:   string;
  label: string;
}

export interface CreateArmCatalogoPayload {
  tipo:       ArmCatalogoTipo;
  key:        string;
  label:      string;
  sortOrder?: number;
}

export interface UpdateArmCatalogoPayload {
  label?:     string;
  isActive?:  boolean;
  sortOrder?: number;
}

const armCatalogoKeys = {
  all:    (tipo: ArmCatalogoTipo) => ['arm-catalogos', tipo] as const,
  active: (tipo: ArmCatalogoTipo) => ['arm-catalogos', tipo, 'active'] as const,
};

export function useArmCatalogos(tipo: ArmCatalogoTipo) {
  return useQuery<ArmCatalogo[]>({
    queryKey: armCatalogoKeys.all(tipo),
    queryFn:  () => api.get('/arm-catalogos', { params: { tipo } }).then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useActiveArmCatalogos(tipo: ArmCatalogoTipo) {
  return useQuery<ArmCatalogoActive[]>({
    queryKey: armCatalogoKeys.active(tipo),
    queryFn:  () => api.get('/arm-catalogos/active', { params: { tipo } }).then((r) => r.data),
    staleTime: 60_000,
  });
}

function invalidateTipo(qc: ReturnType<typeof useQueryClient>, tipo: ArmCatalogoTipo) {
  qc.invalidateQueries({ queryKey: armCatalogoKeys.all(tipo) });
  qc.invalidateQueries({ queryKey: armCatalogoKeys.active(tipo) });
}

export function useCreateArmCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateArmCatalogoPayload) =>
      api.post('/arm-catalogos', data).then((r) => r.data),
    onSuccess: (_data, variables) => invalidateTipo(qc, variables.tipo),
  });
}

export function useUpdateArmCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tipo, data }: { id: number; tipo: ArmCatalogoTipo; data: UpdateArmCatalogoPayload }) =>
      api.patch(`/arm-catalogos/${id}`, data).then((r) => r.data),
    onSuccess: (_data, variables) => invalidateTipo(qc, variables.tipo),
  });
}

export function useDeleteArmCatalogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number; tipo: ArmCatalogoTipo }) =>
      api.delete(`/arm-catalogos/${id}`).then((r) => r.data),
    onSuccess: (_data, variables) => invalidateTipo(qc, variables.tipo),
  });
}
