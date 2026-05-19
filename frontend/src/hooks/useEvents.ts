'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type EventCategory =
  | 'culto'
  | 'conferencia'
  | 'retiro'
  | 'capacitacion'
  | 'social'
  | 'otro';

export interface ArmEvent {
  id:          string;
  title:       string;
  description?: string | null;
  date:        string;       // "YYYY-MM-DD"
  endDate?:    string | null;// "YYYY-MM-DD"
  time?:       string | null;// "HH:MM"
  category:    EventCategory;
  location?:   string | null;
  createdBy:   number;
}

export type CreateEventPayload = Omit<ArmEvent, 'id' | 'createdBy'>;

// ── Query keys ────────────────────────────────────────────────────────────────

const KEYS = {
  all:  ['events'] as const,
  list: (year: number) => ['events', 'list', year] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Lista de eventos para un año dado */
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

/** Crear evento (solo admin) */
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

/** Eliminar evento (solo admin) */
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
