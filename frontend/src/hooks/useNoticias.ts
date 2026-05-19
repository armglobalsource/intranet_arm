'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Noticia {
  id:        number;
  title:     string;
  body:      string;
  excerpt?:  string;
  imageUrl?: string;
  pinned?:   boolean;
  campusId?: string | null;
  status:    'draft' | 'published';
  authorId:  number;
  createdAt: string;
  updatedAt: string;
}

export function useNoticiasGlobal() {
  return useQuery<Noticia[]>({
    queryKey: ['noticias', 'global'],
    queryFn:  () => api.get('/content/news/global').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useNoticiasCampus() {
  return useQuery<Noticia[]>({
    queryKey: ['noticias', 'campus'],
    queryFn:  () => api.get('/content/news/campus').then((r) => r.data),
    staleTime: 60_000,
  });
}
