'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  EncounterSlot, DisponibilidadDoc, MatrixResult, BulkSubmitPayload,
} from '@/types/disponibilidad';

const KEYS = {
  encounters: (campusId: number, week: string) =>
    ['disponibilidad', 'encounters', campusId, week] as const,
  mine: (campusId: number, week: string) =>
    ['disponibilidad', 'mine', campusId, week] as const,
  matrix: (campusId: number, week: string) =>
    ['disponibilidad', 'matrix', campusId, week] as const,
  weeks: (campusId: number) =>
    ['disponibilidad', 'weeks', campusId] as const,
};

export function useEncounters(campusId: number | null, weekLabel: string) {
  return useQuery<EncounterSlot[]>({
    queryKey: KEYS.encounters(campusId ?? 0, weekLabel),
    queryFn:  async () => {
      const res = await api.get('/disponibilidad/encounters', {
        params: { campusId, week: weekLabel },
      });
      return res.data;
    },
    enabled:   !!campusId && !!weekLabel,
    staleTime: 60_000,
  });
}

export function useMyDisponibilidad(campusId: number | null, weekLabel: string) {
  return useQuery<DisponibilidadDoc[]>({
    queryKey: KEYS.mine(campusId ?? 0, weekLabel),
    queryFn:  async () => {
      const res = await api.get('/disponibilidad/mine', {
        params: { campusId, week: weekLabel },
      });
      return res.data;
    },
    enabled:   !!campusId && !!weekLabel,
    staleTime: 30_000,
  });
}

export function useBulkSubmit() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, BulkSubmitPayload>({
    mutationFn: (payload) => api.post('/disponibilidad/bulk-submit', payload).then((r) => r.data),
    onSuccess:  (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ['disponibilidad', 'mine', variables.campusId, variables.weekLabel],
      });
      qc.invalidateQueries({
        queryKey: ['disponibilidad', 'matrix', variables.campusId, variables.weekLabel],
      });
    },
  });
}

export function useDisponibilidadMatrix(campusId: number | null, weekLabel: string) {
  return useQuery<MatrixResult>({
    queryKey: KEYS.matrix(campusId ?? 0, weekLabel),
    queryFn:  async () => {
      const res = await api.get('/disponibilidad/matrix', {
        params: { campusId, week: weekLabel },
      });
      return res.data;
    },
    enabled:   !!campusId && !!weekLabel,
    staleTime: 30_000,
  });
}

export function useMyCommitments(campusId: number | null) {
  return useQuery<DisponibilidadDoc[]>({
    queryKey: ['disponibilidad', 'my-commitments', campusId ?? 0],
    queryFn:  async () => {
      const res = await api.get('/disponibilidad/my-commitments', { params: { campusId } });
      return res.data;
    },
    enabled:   !!campusId,
    staleTime: 60_000,
  });
}

export function useDisponibilidadWeeks(campusId: number | null) {
  return useQuery<string[]>({
    queryKey: KEYS.weeks(campusId ?? 0),
    queryFn:  async () => {
      const res = await api.get('/disponibilidad/weeks', { params: { campusId } });
      return res.data;
    },
    enabled:   !!campusId,
    staleTime: 60_000,
  });
}
