'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Cancion } from '@/types/ficha';

// ── Buscar canciones ──────────────────────────────────────────────────────────

export function useCanciones(q: string) {
  return useQuery<Cancion[]>({
    queryKey: ['canciones', q],
    queryFn:  async () => {
      const { data } = await api.get('/canciones', { params: { q } });
      return data;
    },
    enabled:     true,
    staleTime:   30_000,   // 30s — la lista de canciones no cambia seguido
    placeholderData: [],
  });
}

// ── Upsert canción ────────────────────────────────────────────────────────────

export function useUpsertCancion() {
  const qc = useQueryClient();
  return useMutation<Cancion, Error, { titulo: string; tonalidad?: string }>({
    mutationFn: async (payload) => {
      const { data } = await api.post('/canciones', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canciones'] });
    },
  });
}
