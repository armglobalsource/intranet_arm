import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface JobTitle {
  id:        number;
  name:      string;
  isActive:  boolean;
  sortOrder: number;
  createdAt: string;
}

export const jobTitleKeys = {
  all:    ['job-titles'] as const,
  active: ['job-titles', 'active'] as const,
};

export interface JobTitleAffectedUser {
  id:        number;
  firstName: string;
  lastName:  string;
  sources:   ('manual' | 'orgchart')[];
}

/** Personas afectadas por un cargo — usado para advertir antes de editar/eliminar en el mantenedor. */
export function useJobTitleAffectedUsers(id: number | null) {
  return useQuery<JobTitleAffectedUser[]>({
    queryKey: ['job-titles', id, 'affected-users'],
    queryFn:  () => api.get(`/job-titles/${id}/affected-users`).then((r) => r.data),
    enabled:  id !== null,
  });
}

/** Todos los cargos (admin) */
export function useAllJobTitles() {
  return useQuery<JobTitle[]>({
    queryKey: jobTitleKeys.all,
    queryFn:  () => api.get('/job-titles').then((r) => r.data),
    staleTime: 0,
  });
}

/** Solo nombres de cargos activos (para el combobox en modales) */
export function useActiveJobTitleNames() {
  return useQuery<string[]>({
    queryKey: jobTitleKeys.active,
    queryFn:  () => api.get('/job-titles/active').then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; sortOrder?: number }) =>
      api.post('/job-titles', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobTitleKeys.all }),
  });
}

export function useUpdateJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; isActive?: boolean; sortOrder?: number } }) =>
      api.patch(`/job-titles/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobTitleKeys.all }),
  });
}

export function useDeleteJobTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/job-titles/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: jobTitleKeys.all }),
  });
}
