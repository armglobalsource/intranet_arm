import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CampusSchedule {
  dia:          string;
  hora:         string;
  bloque?:      string;
  descripcion?: string;
  fichaType?:   'unico' | 'multi' | 'oracion';
}

export interface Campus {
  id:           number;
  name:         string;
  siglas?:      string | null;
  address?:     string | null;
  city?:        string | null;
  country?:     string | null;
  phone?:       string | null;
  email?:       string | null;
  website?:     string | null;
  description?: string | null;
  pastorIds:    number[];
  adminIds:     number[];
  schedules:    CampusSchedule[];
  asistenciaCategoriaKeys: string[];
  voluntarioCategoriaKeys: string[];
  monedaCodes:             string[];
  isActive:     boolean;
  createdAt:    string;
  updatedAt:    string;
}

export interface CampusOption {
  id:      number;
  name:    string;
  siglas?: string | null;
  address?: string | null;
  country?: string | null;
  phone?:   string | null;
}

export interface CreateCampusPayload {
  name:         string;
  siglas?:      string;
  address?:     string;
  city?:        string;
  country?:     string;
  phone?:       string;
  email?:       string;
  website?:     string;
  description?: string;
  pastorIds?:   number[];
  adminIds?:    number[];
  schedules?:   CampusSchedule[];
  asistenciaCategoriaKeys?: string[];
  voluntarioCategoriaKeys?: string[];
  monedaCodes?:             string[];
}

const campusKeys = {
  all:    ['campus'] as const,
  active: ['campus', 'active'] as const,
  detail: (id: number) => ['campus', id] as const,
};

export function useAllCampuses() {
  return useQuery<Campus[]>({
    queryKey: campusKeys.all,
    queryFn:  () => api.get('/campus').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCampus(id: number) {
  return useQuery<Campus>({
    queryKey: campusKeys.detail(id),
    queryFn:  () => api.get(`/campus/${id}`).then((r) => r.data),
    enabled:  Number.isFinite(id),
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
    mutationFn: (data: CreateCampusPayload) =>
      api.post('/campus', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: campusKeys.all }),
  });
}

export function useUpdateCampus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateCampusPayload> & { isActive?: boolean } }) =>
      api.patch(`/campus/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campusKeys.all });
      qc.invalidateQueries({ queryKey: campusKeys.active });
    },
  });
}

export function useDeleteCampus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/campus/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campusKeys.all });
      qc.invalidateQueries({ queryKey: campusKeys.active });
    },
  });
}
