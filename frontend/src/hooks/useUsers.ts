import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User, UpdateUserDto } from '@/types/user';

export const userKeys = {
  all:    ['users'] as const,
  list:   (search?: string) => ['users', 'list', search ?? ''] as const,
  detail: (id: number)      => ['users', 'detail', id] as const,
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

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateUserDto }) =>
      api.patch(`/users/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      // Refrescar lista de usuarios y también el organigrama
      // (los nombres/fotos vinculados se actualizan automáticamente)
      qc.invalidateQueries({ queryKey: userKeys.all });
      qc.invalidateQueries({ queryKey: ['orgchart'] });
    },
  });
}
