'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RosterResult } from '@/types/disponibilidad';

export function useEquipoRoster(campusId: number | null, weekLabel: string) {
  return useQuery<RosterResult>({
    queryKey: ['equipo-roster', campusId ?? 0, weekLabel],
    queryFn:  async () => {
      const res = await api.get('/equipo-roster', {
        params: { campusId, week: weekLabel },
      });
      return res.data;
    },
    enabled:   !!campusId && !!weekLabel,
    staleTime: 30_000,
  });
}
