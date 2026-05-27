'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
    mutationFn: (form: FormData) =>
      api.post('/feedback', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
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
