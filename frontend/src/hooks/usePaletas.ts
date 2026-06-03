'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PaletaColor {
  name: string;
  hex:  string;
}

export interface Paleta {
  id:     string;
  name:   string;
  colors: PaletaColor[];
  order:  number;
}

export function usePaletas() {
  const { data, isLoading } = useQuery<Paleta[]>({
    queryKey: ['paletas'],
    queryFn:  async () => {
      const { data } = await api.get('/paletas');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
  return { paletas: data ?? [], loading: isLoading };
}

export function useCreatePaleta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { name: string; colors: PaletaColor[] }) => {
      const { data } = await api.post('/paletas', dto);
      return data as Paleta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paletas'] });
    },
  });
}
