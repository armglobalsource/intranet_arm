'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { directUpload, requiresDirectUpload } from '@/lib/direct-upload';

export interface FeedbackItem {
  id:             number;
  userId:         number;
  userName:       string;
  userEmail:      string;
  type:           'bug' | 'suggestion';
  message:        string;
  screenshotUrl?: string | null;
  status:         'open' | 'in_progress' | 'resolved';
  note?:          string | null;
  createdAt:      string;
  resolvedByName?: string | null;
}

export function useFeedbackList() {
  return useQuery<FeedbackItem[]>({
    queryKey: ['feedback'],
    queryFn:  () => api.get('/feedback').then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useSubmitFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (form: FormData) => {
      const file = form.get('screenshot');
      if (file instanceof File && requiresDirectUpload(file)) {
        const ticket = await directUpload(file, 'feedback');
        return api.post('/uploads/feedback/complete', { ticket, metadata: { type: form.get('type'), message: form.get('message') } }).then(r => r.data);
      }
      return api.post('/feedback', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}

export function useUpdateFeedbackStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: string; note?: string }) =>
      api.patch(`/feedback/${id}/status`, { status, note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}

export function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/feedback/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}
