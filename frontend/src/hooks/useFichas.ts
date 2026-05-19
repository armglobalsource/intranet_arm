'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { api } from '@/lib/api';
import { clientDb } from '@/lib/firebase-client';
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

// ─── Ficha individual en tiempo real (Firestore onSnapshot) ──────────────────

export function useFichaRealtime(fichaId: string) {
  const [ficha, setFicha]   = useState<Ficha | null>(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!fichaId) return;
    setLoad(true);
    const ref = doc(clientDb, 'fichas', fichaId);
    const unsub = onSnapshot(
      ref,
      snap => {
        if (!snap.exists()) { setError('Ficha no encontrada'); setLoad(false); return; }
        setFicha({ ...snap.data(), fichaId: snap.id } as Ficha);
        setLoad(false);
        setError(null);
      },
      err => { setError(err.message); setLoad(false); },
    );
    return () => unsub();
  }, [fichaId]);

  return { ficha, loading, error };
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
    mutationFn: ({ fichaId, ...dto }: { fichaId: string; title?: string; date?: string; status?: string }) =>
      api.patch(`/fichas/${fichaId}`, dto).then(r => r.data),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: KEYS.list() }),
  });
}

export function useDeleteFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => api.delete(`/fichas/${fichaId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useCloneFicha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fichaId: string) => api.post(`/fichas/${fichaId}/clone`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateSection() {
  return useMutation({
    mutationFn: ({ fichaId, sectionName, ...dto }: { fichaId: string; sectionName: SectionName; [key: string]: any }) =>
      api.patch(`/fichas/${fichaId}/sections/${sectionName}`, dto).then(r => r.data),
  });
}

export function useCompleteSection() {
  return useMutation({
    mutationFn: ({ fichaId, sectionName }: { fichaId: string; sectionName: SectionName }) =>
      api.patch(`/fichas/${fichaId}/sections/${sectionName}/complete`, {}).then(r => r.data),
  });
}

export function useChangelog(fichaId: string) {
  return useQuery({
    queryKey: ['fichas', 'changelog', fichaId],
    queryFn:  () => api.get(`/fichas/${fichaId}/changelog`).then(r => r.data),
    enabled:  !!fichaId,
  });
}
