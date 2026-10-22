import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { directUpload, requiresDirectUpload } from '@/lib/direct-upload';

export interface VisualReference {
  id:             number;
  name:           string;
  tags:           string[];
  imageUrl:       string;
  storageKey?:    string;
  uploadedBy:     number;
  uploadedByName: string | null;
  uploadedAt:     string;
  usageCount:     number;
  isActive:       boolean;
}

export interface UpdateVisualReferencePayload {
  name?:     string;
  /** Se envía como string separada por comas; el backend parsea y normaliza. */
  tags?:     string;
  isActive?: boolean;
}

const keys = {
  all:    ['visual-references'] as const,
  list:   (search?: string) => ['visual-references', 'list', search ?? ''] as const,
  detail: (id: number)      => ['visual-references', 'detail', id] as const,
};

export function useVisualReferences(search?: string) {
  return useQuery<VisualReference[]>({
    queryKey: keys.list(search),
    queryFn:  () => api.get('/visual-references', { params: search ? { search } : undefined }).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useVisualReference(id: number | null) {
  return useQuery<VisualReference>({
    queryKey: keys.detail(id ?? 0),
    queryFn:  () => api.get(`/visual-references/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

/**
 * Upload de una nueva referencia. Recibe File + metadata; construye el FormData
 * internamente. Nota: no seteamos Content-Type — axios lo autodetecta con el
 * boundary correcto para multipart cuando le pasamos un FormData.
 */
export function useUploadVisualReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, name, tags }: { file: File; name: string; tags?: string }) => {
      if (requiresDirectUpload(file)) {
        const ticket = await directUpload(file, 'visual-reference');
        return api.post('/uploads/visual-reference/complete', { ticket, metadata: { name, tags } }).then(r => r.data);
      }
      const form = new FormData();
      form.append('file', file);
      form.append('name', name);
      if (tags) form.append('tags', tags);
      return api.post('/visual-references', form).then((r) => r.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.all }); },
  });
}

export function useUpdateVisualReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateVisualReferencePayload }) =>
      api.patch(`/visual-references/${id}`, data).then((r) => r.data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: keys.detail(id) });
    },
  });
}

export function useDeleteVisualReference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/visual-references/${id}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.all }); },
  });
}
