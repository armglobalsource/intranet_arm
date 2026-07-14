'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  EncounterSlot, DisponibilidadDoc, BulkSubmitPayload,
} from '@/types/disponibilidad';

/** MatrixResult para técnicos — usa "tecnicos" en lugar de "volunteers" */
export interface TecnicosMatrixResult {
  encounters: EncounterSlot[];
  tecnicos:   {
    userId:   number;
    userName: string;
    slots:    Record<string, { available: boolean; nota: string | null }>;
  }[];
}

const KEYS = {
  encounters: (campusId: number, week: string) =>
    ['tecnicos', 'encounters', campusId, week] as const,
  mine: (campusId: number, week: string) =>
    ['tecnicos', 'mine', campusId, week] as const,
  matrix: (campusId: number, week: string) =>
    ['tecnicos', 'matrix', campusId, week] as const,
  weeks: (campusId: number) =>
    ['tecnicos', 'weeks', campusId] as const,
};

export function useTecnicosEncounters(campusId: number | null, weekLabel: string) {
  return useQuery<EncounterSlot[]>({
    queryKey: KEYS.encounters(campusId ?? 0, weekLabel),
    queryFn:  async () => {
      const res = await api.get('/tecnicos/encounters', {
        params: { campusId, week: weekLabel },
      });
      return res.data;
    },
    enabled:   !!campusId && !!weekLabel,
    staleTime: 60_000,
  });
}

export function useMyTecnicosDisponibilidad(campusId: number | null, weekLabel: string) {
  return useQuery<DisponibilidadDoc[]>({
    queryKey: KEYS.mine(campusId ?? 0, weekLabel),
    queryFn:  async () => {
      const res = await api.get('/tecnicos/mine', {
        params: { campusId, week: weekLabel },
      });
      return res.data;
    },
    enabled:   !!campusId && !!weekLabel,
    staleTime: 30_000,
  });
}

export function useTecnicosBulkSubmit() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, BulkSubmitPayload>({
    mutationFn: (payload) => api.post('/tecnicos/bulk-submit', payload).then((r) => r.data),
    onSuccess:  (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['tecnicos', 'mine', variables.campusId, variables.weekLabel],
      });
      qc.invalidateQueries({
        queryKey: ['tecnicos', 'matrix', variables.campusId, variables.weekLabel],
      });
    },
  });
}

export function useTecnicosMatrix(campusId: number | null, weekLabel: string) {
  return useQuery<TecnicosMatrixResult>({
    queryKey: KEYS.matrix(campusId ?? 0, weekLabel),
    queryFn:  async () => {
      const res = await api.get('/tecnicos/matrix', {
        params: { campusId, week: weekLabel },
      });
      return res.data;
    },
    enabled:   !!campusId && !!weekLabel,
    staleTime: 30_000,
  });
}

export function useTecnicosCommitments(campusId: number | null) {
  return useQuery<DisponibilidadDoc[]>({
    queryKey: ['tecnicos', 'my-commitments', campusId ?? 0],
    queryFn:  async () => {
      const res = await api.get('/tecnicos/my-commitments', { params: { campusId } });
      return res.data;
    },
    enabled:   !!campusId,
    staleTime: 60_000,
  });
}

export function useTecnicosWeeks(campusId: number | null) {
  return useQuery<string[]>({
    queryKey: KEYS.weeks(campusId ?? 0),
    queryFn:  async () => {
      const res = await api.get('/tecnicos/weeks', { params: { campusId } });
      return res.data;
    },
    enabled:   !!campusId,
    staleTime: 60_000,
  });
}
