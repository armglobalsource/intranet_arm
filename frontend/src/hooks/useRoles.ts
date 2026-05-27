import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SystemRole {
  id:          number;
  name:        string;
  description: string | null;
  isSystem:    boolean;
  isActive:    boolean;
  permissions: string[];
  userCount:   number;
  createdAt:   string;
}

export const roleKeys = {
  all: ['roles'] as const,
};

export function useSystemRoles() {
  return useQuery<SystemRole[]>({
    queryKey: roleKeys.all,
    queryFn:  () => api.get('/roles').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.post('/roles', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; isActive?: boolean; permissions?: string[] } }) =>
      api.patch(`/roles/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.all }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/roles/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: roleKeys.all }),
  });
}
