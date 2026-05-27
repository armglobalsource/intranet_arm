'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type EventCategory =
  | 'encuentro'
  | 'conferencia'
  | 'evento_especial'
  | 'adn'
  | 'evento_social'
  | 'amor_casa'
  | 'personalizado'
  // legacy (datos existentes)
  | 'culto'
  | 'retiro'
  | 'capacitacion'
  | 'social'
  | 'otro';

export interface ArmEvent {
  id:           string;
  title:        string;
  description?: string | null;
  date:         string;
  endDate?:     string | null;
  time?:        string | null;
  category:     EventCategory;
  customLabel?: string | null;
  location?:    string | null;
  createdBy:    number;
}

export type CreateEventPayload = Omit<ArmEvent, 'id' | 'createdBy'>;

// ── Query keys ────────────────────────────────────────────────────────────────

const KEYS = {
  all:  ['events'] as const,
  list: (year: number) => ['events', 'list', year] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useEvents(year: number) {
  return useQuery<ArmEvent[]>({
    queryKey: KEYS.list(year),
    queryFn:  async () => {
      const res = await api.get(`/events?year=${year}`);
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateEventPayload) =>
      api.post('/events', data).then((r) => r.data),
    onSuccess: (_result, vars) => {
      const year = Number(vars.date.slice(0, 4));
      qc.invalidateQueries({ queryKey: KEYS.list(year) });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; year: number }) =>
      api.delete(`/events/${id}`).then((r) => r.data),
    onSuccess: (_result, { year }) => {
      qc.invalidateQueries({ queryKey: KEYS.list(year) });
    },
  });
}
