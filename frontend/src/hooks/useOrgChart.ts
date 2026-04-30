import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { OrgArea, OrgAreaTree, OrgSearchResult, OrgNodeType } from '@/types/orgchart';

export const orgchartKeys = {
  areas:  ['orgchart', 'areas'] as const,
  tree:   (slug: string) => ['orgchart', 'tree', slug] as const,
  search: (q: string)    => ['orgchart', 'search', q] as const,
};

export function useOrgAreas() {
  return useQuery<OrgArea[]>({
    queryKey: orgchartKeys.areas,
    queryFn:  () => api.get('/orgchart/areas').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrgAreaTree(slug: string, enabled = true) {
  return useQuery<OrgAreaTree>({
    queryKey: orgchartKeys.tree(slug),
    queryFn:  () => api.get(`/orgchart/areas/${slug}/tree`).then((r) => r.data),
    enabled:  enabled && !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrgSearch(q: string) {
  return useQuery<OrgSearchResult[]>({
    queryKey: orgchartKeys.search(q),
    queryFn:  () => api.get('/orgchart/search', { params: { q } }).then((r) => r.data),
    enabled:  q.trim().length >= 2,
    staleTime: 30 * 1000,
  });
}

export function useUpdateOrgNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; role?: string; description?: string } }) =>
      api.patch(`/orgchart/nodes/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgchart'] });
    },
  });
}

export interface CreateOrgNodePayload {
  areaId:       number;
  parentId?:    number;
  userId?:      number;
  type:         OrgNodeType;
  name:         string;
  role?:        string;
  description?: string;
  icon?:        string;
  colPosition?: number;
}

export function useCreateOrgNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrgNodePayload) =>
      api.post('/orgchart/nodes', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgchart'] });
    },
  });
}

export function useUpdateOrgArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; desc?: string } }) =>
      api.patch(`/orgchart/areas/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgchart'] });
    },
  });
}

export function useDeleteOrgNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/orgchart/nodes/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgchart'] });
    },
  });
}

export function useLinkOrgUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, userId }: { nodeId: number; userId: number | null }) =>
      api.patch(`/orgchart/nodes/${nodeId}/link-user`, { userId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orgchart'] });
    },
  });
}
