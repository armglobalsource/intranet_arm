'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AppNotification {
  id:        number;
  userId:    number;
  title:     string;
  body?:     string | null;
  link?:     string | null;
  channel:   string;
  read:      boolean;
  readAt?:   string | null;
  createdAt: string;
}

export function useNotifications() {
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn:  async () => {
      const { data } = await api.get('/notifications');
      return data;
    },
    refetchInterval: 30_000,
    staleTime:       10_000,
  });

  const unreadCount = data.filter((n) => !n.read).length;

  const { mutate: markRead } = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onMutate:   async (id) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      qc.setQueryData<AppNotification[]>(['notifications'], (prev = []) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return { notifications: data, unreadCount, isLoading, markRead };
}
