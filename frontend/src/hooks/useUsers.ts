import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User, UpdateUserDto } from '@/types/user';

export interface Role {
  id:          number;
  name:        string;
  description: string | null;
}

export interface CreateUserDto {
  email:          string;
  password:       string;
  firstName:      string;
  lastName:       string;
  roleId:         number;
  campusId?:      number;
  jobTitleIds?:   number[];
  phone?:         string;
  country?:       string;
  bio?:           string;
}

export const userKeys = {
  all:    ['users'] as const,
  list:   (search?: string) => ['users', 'list', search ?? ''] as const,
  detail: (id: number)      => ['users', 'detail', id] as const,
  roles:  ['users', 'roles'] as const,
};

export function useUsers(search?: string) {
  return useQuery<User[]>({
    queryKey: userKeys.list(search),
    queryFn: () =>
      api
        .get('/users', { params: search ? { search } : undefined })
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });
}

// Re-export from the dedicated hook for backwards compatibility
export { useActiveJobTitleNames as useJobTitles } from './useJobTitles';

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: userKeys.roles,
    queryFn:  () => api.get('/users/roles').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserDto) =>
      api.post('/users', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserDto }) =>
      api.patch(`/users/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      qc.invalidateQueries({ queryKey: ['orgchart'] });
    },
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'inactive' }) =>
      api.patch(`/users/${id}`, { status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      qc.invalidateQueries({ queryKey: ['orgchart'] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}
