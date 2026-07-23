'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import type { Ficha, FichaListItem, CreateFichaPayload, SectionName } from '@/types/ficha';

const KEYS = {
  all:    ['fichas'] as const,
  list:   (campusId?: string) => ['fichas', 'list', campusId ?? 'all'] as const,
  detail: (fichaId: string)   => ['fichas', 'detail', fichaId] as const,
};

// ─── Lista de fichas (REST) ───────────────────────────────────────────────────

export function useFichas(campusId?: string) {
  return useQuery<FichaListItem[]>({
    queryKey: KEYS.list(campusId),
    queryFn:  async () => {
      const params = campusId ? `?campusId=${campusId}` : '';
      const res = await api.get(`/fichas${params}`);
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ─── Mis fichas (fichas donde el usuario fue asignado o es creador) ───────────

export function useMiFichas() {
  return useQuery<FichaListItem[]>({
    queryKey: ['fichas', 'mine'],
    queryFn:  async () => {
      const res = await api.get('/fichas/mine');
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ─── Ficha individual con actualización periódica vía API protegida ─────────

export function useFichaRealtime(fichaId: string) {
  const query = useQuery<Ficha>({
    queryKey: KEYS.detail(fichaId),
    queryFn: () => api.get(`/fichas/${fichaId}`).then((response) => response.data),
    enabled: !!fichaId,
    staleTime: 1_000,
    refetchInterval: 3_000,
    refetchIntervalInBackground: false,
  });

  return {
    ficha: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? apiErrorMessage(query.error, 'No se pudo cargar la ficha') : null,
  };
}

// ─── Mutations (escrituras via NestJS API) ────────────────────────────────────

export function useCreateFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFichaPayload) =>
      api.post('/fichas', payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fichaId, ...dto }: { fichaId: string; title?: string; date?: string; hiddenSections?: string[]; sectionLayout?: { left: string[]; right: string[] } }) =>
      api.patch(`/fichas/${fichaId}`, dto).then(r => r.data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.detail(v.fichaId) });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function useDeleteFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => api.delete(`/fichas/${fichaId}`).then(r => r.data),
    onSuccess: (_data, fichaId) => {
      qc.removeQueries({ queryKey: KEYS.detail(fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export interface CloneFichaOptions {
  fichaId:        string;
  date?:          string;   // ISO date string
  keepAssignees?: boolean;
  title?:         string;
}

export function useCloneFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fichaId, ...dto }: CloneFichaOptions) =>
      api.post(`/fichas/${fichaId}/clone`, dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function useArchiveFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => api.patch(`/fichas/${fichaId}/archive`).then(r => r.data),
    onSuccess: (_data, fichaId) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function useUnarchiveFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => api.patch(`/fichas/${fichaId}/unarchive`).then(r => r.data),
    onSuccess: (_data, fichaId) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function usePublishFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => api.patch(`/fichas/${fichaId}/publish`).then(r => r.data),
    onSuccess: (_data, fichaId) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function useUnpublishFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => api.patch(`/fichas/${fichaId}/unpublish`).then(r => r.data),
    onSuccess: (_data, fichaId) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fichaId, sectionName, ...dto }: { fichaId: string; sectionName: SectionName; [key: string]: any }) =>
      api.patch(`/fichas/${fichaId}/sections/${sectionName}`, dto).then(r => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(variables.fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function useCompleteSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fichaId, sectionName }: { fichaId: string; sectionName: SectionName }) =>
      api.patch(`/fichas/${fichaId}/sections/${sectionName}/complete`, {}).then(r => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(variables.fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function useReopenSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fichaId, sectionName }: { fichaId: string; sectionName: SectionName }) =>
      api.patch(`/fichas/${fichaId}/sections/${sectionName}/reopen`, {}).then(r => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(variables.fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function useChangelog(fichaId: string) {
  return useQuery({
    queryKey: ['fichas', 'changelog', fichaId],
    queryFn:  () => api.get(`/fichas/${fichaId}/changelog`).then(r => r.data),
    enabled:  !!fichaId,
  });
}
