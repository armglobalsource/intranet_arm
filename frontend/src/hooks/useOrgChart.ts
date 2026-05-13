import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { OrgArea, OrgAreaTree, OrgTeam, OrgSearchUser } from '@/types/orgchart';

export const orgchartKeys = {
  areas:  ['orgchart', 'areas'] as const,
  teams:  ['orgchart', 'teams'] as const,
  tree:   (slug: string) => ['orgchart', 'tree', slug] as const,
  search: (q: string)    => ['orgchart', 'search', q] as const,
};

export type CreateOrgAreaPayload = {
  slug: string;
  name: string;
  color: string;
  icon: string;
  desc?: string;
  sortOrder?: number;
};

// ── Áreas ─────────────────────────────────────────────────────────────────────

export function useOrgAreas() {
  return useQuery<OrgArea[]>({
    queryKey: orgchartKeys.areas,
    queryFn:  () => api.get('/orgchart/areas').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrgAllAreas() {
  return useQuery<OrgArea[]>({
    queryKey: [...orgchartKeys.areas, 'all'],
    queryFn:  () => api.get('/orgchart/areas/all').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOrgArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrgAreaPayload) =>
      api.post('/orgchart/areas', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgchart'] }),
  });
}

export function useUpdateOrgArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch(`/orgchart/areas/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgchart'] }),
  });
}

export function useDeleteOrgArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/orgchart/areas/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgchart'] }),
  });
}

// ── Árbol ──────────────────────────────────────────────────────────────────────

export function useOrgAreaTree(slug: string, enabled = true) {
  return useQuery<OrgAreaTree>({
    queryKey: orgchartKeys.tree(slug),
    queryFn:  () => api.get(`/orgchart/areas/${slug}/tree`).then((r) => r.data),
    enabled:  enabled && !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Equipos ────────────────────────────────────────────────────────────────────

export function useOrgTeams() {
  return useQuery<OrgTeam[]>({
    queryKey: orgchartKeys.teams,
    queryFn:  () => api.get('/orgchart/teams').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrgAllTeams() {
  return useQuery<OrgTeam[]>({
    queryKey: [...orgchartKeys.teams, 'all'],
    queryFn:  () => api.get('/orgchart/teams/all').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateOrgTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.patch(`/orgchart/teams/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgchart'] }),
  });
}

export function useCreateOrgTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { areaId: number; name: string; icon?: string; desc?: string; colPosition?: number; sortOrder?: number }) =>
      api.post('/orgchart/teams', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgchart'] }),
  });
}

export function useDeleteOrgTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/orgchart/teams/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgchart'] }),
  });
}

// ── Membresías ─────────────────────────────────────────────────────────────────

export function useCreateOrgMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { userId: number; areaId?: number; teamId?: number; role: string; sortOrder?: number }) =>
      api.post('/orgchart/memberships', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgchart'] }),
  });
}

export function useUploadTeamLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return api.post(`/orgchart/teams/${id}/logo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgchart'] }),
  });
}

export function useDeleteOrgMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/orgchart/memberships/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgchart'] }),
  });
}

// ── Búsqueda ───────────────────────────────────────────────────────────────────

export function useOrgSearch(q: string) {
  return useQuery<OrgSearchUser[]>({
    queryKey: orgchartKeys.search(q),
    queryFn:  () => api.get('/orgchart/search', { params: { q } }).then((r) => r.data),
    enabled:  q.trim().length >= 2,
    staleTime: 30 * 1000,
  });
}
