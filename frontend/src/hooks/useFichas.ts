'use client';

import { useQuery, useMutation, useQueryClient, useIsMutating } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import type { Ficha, FichaListItem, CreateFichaPayload, SectionName, LayoutVisualSong } from '@/types/ficha';

const KEYS = {
  all:    ['fichas'] as const,
  list:   (campusId?: string) => ['fichas', 'list', campusId ?? 'all'] as const,
  detail: (fichaId: string)   => ['fichas', 'detail', fichaId] as const,
};

// Mutation key compartida por toda escritura sobre el detalle de una ficha.
// useFichaRealtime la usa para pausar su polling (refetchInterval) mientras
// hay una escritura en curso — si no, un GET del polling puede leer el
// backend ANTES de que el PATCH commitee y resolver DESPUÉS, pisando el
// resultado optimista/fresco y haciendo que la UI "revierta" unos segundos
// después de guardar (visto al reordenar secciones).
const WRITE_KEY = ['fichas', 'write'] as const;

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
  // Mientras haya una escritura en curso sobre esta ficha, pausamos TODA
  // refetch automática (polling, focus, reconnect) — ver comentario de
  // WRITE_KEY más arriba. No alcanza con pausar solo refetchInterval: React
  // Query por default también refetchea al recuperar foco de ventana
  // (refetchOnWindowFocus) y esa vía no pasaba por ningún guard, así que
  // igual podía pisar un guardado optimista con una lectura vieja.
  const isWriting = useIsMutating({ mutationKey: WRITE_KEY }) > 0;
  const query = useQuery<Ficha>({
    queryKey: KEYS.detail(fichaId),
    queryFn: () => api.get(`/fichas/${fichaId}`).then((response) => response.data),
    enabled: !!fichaId && !isWriting,
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
    mutationKey: WRITE_KEY,
    mutationFn: ({ fichaId, ...dto }: { fichaId: string; title?: string; date?: string; hiddenSections?: string[]; sectionLayout?: { left: string[]; right: string[]; leftRatio?: number } }) =>
      api.patch(`/fichas/${fichaId}`, dto).then(r => r.data),
    // Cancela cualquier GET en vuelo (disparado por el refetchInterval de
    // useFichaRealtime) antes de escribir — si no, esa respuesta stale puede
    // resolver DESPUÉS de nuestro PATCH y pisar el resultado fresco, haciendo
    // que la UI "revierta" el cambio unos segundos después de guardarlo.
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: KEYS.detail(v.fichaId) });
    },
    onSuccess: (data, v) => {
      // El PATCH devuelve la ficha completa ya actualizada — la escribimos
      // directo en cache en vez de solo invalidar, para no depender de que
      // el próximo refetch del polling gane la carrera.
      qc.setQueryData(KEYS.detail(v.fichaId), data);
      qc.invalidateQueries({ queryKey: KEYS.all });
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

export function useSplitPrayerGlobal() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: (fichaId: string) =>
      api.post(`/fichas/${fichaId}/split-prayer-global`).then(r => r.data),
    onSuccess: (data, fichaId) => {
      qc.setQueryData(KEYS.detail(fichaId), data.prayerFicha);
      qc.setQueryData(KEYS.detail(data.globalFicha.fichaId), data.globalFicha);
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

export function useArchiveFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: WRITE_KEY,
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
    mutationKey: WRITE_KEY,
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
    mutationKey: WRITE_KEY,
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
    mutationKey: WRITE_KEY,
    mutationFn: (fichaId: string) => api.patch(`/fichas/${fichaId}/unpublish`).then(r => r.data),
    onSuccess: (_data, fichaId) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ['fichas', 'mine'] });
    },
  });
}

/**
 * Actualiza el bloque layoutVisual completo de la ficha (vista alternativa
 * accesible desde la píldora "Layout Visual"). El backend hace replace del
 * array de songs, así que el frontend siempre envía el estado completo.
 */
export function useUpdateLayoutVisual() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: ({ fichaId, songs, producerNotes }: { fichaId: string; songs: LayoutVisualSong[]; producerNotes?: string }) =>
      api.patch(`/fichas/${fichaId}/layout-visual`, { songs, ...(producerNotes !== undefined ? { producerNotes } : {}) }).then(r => r.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(variables.fichaId) });
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useUpdateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: WRITE_KEY,
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
    mutationKey: WRITE_KEY,
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
    mutationKey: WRITE_KEY,
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
