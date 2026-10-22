import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { directUpload, requiresDirectUpload } from '@/lib/direct-upload';
import type { User, UpdateUserDto } from '@/types/user';

export interface Role {
  id:          number;
  name:        string;
  description: string | null;
}

export interface CreateUserDto {
  email:              string;
  password?:          string;
  firstName:          string;
  lastName:           string;
  roleId:             number;
  campusId?:          number;
  jobTitleIds?:       number[];
  phone?:             string;
  country?:           string;
  bio?:               string;
  birthDate?:         string;
  ministerialTitle?:  'pastor_principal' | 'pastor' | 'ministro' | null;
}

export interface PaginatedUsers {
  data:       User[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export const userKeys = {
  all:       ['users'] as const,
  list:      (search?: string, page?: number, limit?: number) =>
               ['users', 'list', search ?? '', page ?? 1, limit ?? 50] as const,
  detail:    (id: number) => ['users', 'detail', id] as const,
  roles:     ['users', 'roles'] as const,
  birthdays: ['users', 'birthdays'] as const,
};

export interface UserBirthday {
  id:        number;
  firstName: string;
  lastName:  string;
  avatarUrl: string | null;
  birthDate: string;
}

/**
 * Lista liviana (sin cargos, permisos ni datos de cuenta) de quienes tienen
 * fecha de nacimiento registrada, para pintar cumpleaños en el calendario.
 * staleTime largo a propósito: los cumpleaños casi nunca cambian, así que no
 * hay razón para volver a pedirlos cada vez que se navega el calendario.
 */
export function useBirthdays() {
  return useQuery<UserBirthday[]>({
    queryKey: userKeys.birthdays,
    queryFn:  () => api.get<UserBirthday[]>('/users/birthdays').then((r) => r.data),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

/** Devuelve solo el array de usuarios (compatibilidad con código existente). */
export function useUsers(search?: string, options?: { enabled?: boolean }) {
  return useQuery<User[]>({
    queryKey: userKeys.list(search),
    queryFn: () =>
      api
        .get<PaginatedUsers>('/users', { params: { search: search || undefined, limit: 2000 } })
        .then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled,
  });
}

/** Un solo usuario por id — para la página de edición. */
export function useUser(id: number | null) {
  return useQuery<User>({
    queryKey: userKeys.detail(id ?? 0),
    queryFn:  () => api.get<User>(`/users/${id}`).then((r) => r.data),
    enabled:  id != null,
    staleTime: 60 * 1000,
  });
}

/** Devuelve la respuesta paginada completa (total, páginas, etc.). */
export function useUsersPaginated(search?: string, page = 1, limit = 50) {
  return useQuery<PaginatedUsers>({
    queryKey: userKeys.list(search, page, limit),
    queryFn: () =>
      api
        .get<PaginatedUsers>('/users', { params: { search: search || undefined, page, limit } })
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

// Re-export from the dedicated hook for backwards compatibility
export { useActiveJobTitleNames as useJobTitles } from './useJobTitles';

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: userKeys.roles,
    queryFn:  () => api.get('/roles').then((r) => r.data),
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

export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleId }: { id: number; roleId?: number }) =>
      api.patch(`/users/${id}/approve`, roleId ? { roleId } : {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useRejectUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.patch(`/users/${id}/reject`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useUploadUserAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      if (requiresDirectUpload(file)) {
        const ticket = await directUpload(file, 'avatar', id);
        return api.post<User>('/uploads/avatar/complete', { ticket }).then(r => r.data);
      }
      const form = new FormData();
      form.append('file', file);
      return api.post<User>(`/users/${id}/avatar`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}
