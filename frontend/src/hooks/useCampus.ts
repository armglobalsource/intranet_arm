import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Campus {
  id:        number;
  name:      string;
  address?:  string | null;
  isActive:  boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampusOption {
  id:      number;
  name:    string;
  address?: string | null;
}

const campusKeys = {
  all:    ['campus'] as const,
  active: ['campus', 'active'] as const,
};

export function useAllCampuses() {
  return useQuery<Campus[]>({
    queryKey: campusKeys.all,
    queryFn:  () => api.get('/campus').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveCampuses() {
  return useQuery<CampusOption[]>({
    queryKey: campusKeys.active,
    queryFn:  () => api.get('/campus/active').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCampus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; address?: string }) =>
      api.post('/campus', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: campusKeys.all }),
  });
}

export function useUpdateCampus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; address?: string; isActive?: boolean } }) =>
      api.patch(`/campus/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: campusKeys.all }),
  });
}

export function useDeleteCampus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/campus/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: campusKeys.all }),
  });
}
