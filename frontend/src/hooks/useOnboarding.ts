'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface OnboardingStep {
  title:       string;
  description: string;
  order:       number;
}

export interface OnboardingTeam {
  id:            number;
  teamName:      string;
  slug:          string;
  welcomeTitle?: string | null;
  welcomeText?:  string | null;
  videoUrl?:     string | null;
  emoji?:        string | null;
  color?:        string | null;
  roleNames:     string[];
  steps:         OnboardingStep[];
  isActive:      boolean;
  createdAt:     string;
  updatedAt:     string;
}

export interface CreateOnboardingPayload {
  teamName:      string;
  slug:          string;
  welcomeTitle?: string;
  welcomeText?:  string;
  videoUrl?:     string;
  emoji?:        string;
  color?:        string;
  roleNames?:    string[];
  steps?:        OnboardingStep[];
  isActive?:     boolean;
}

const keys = {
  all:  ['onboarding'] as const,
  slug: (slug: string) => ['onboarding', slug] as const,
};

export function useOnboardingList() {
  return useQuery<OnboardingTeam[]>({
    queryKey: keys.all,
    queryFn:  () => api.get('/onboarding').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useOnboardingBySlug(slug: string) {
  return useQuery<OnboardingTeam>({
    queryKey: keys.slug(slug),
    queryFn:  () => api.get(`/onboarding/${slug}`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    enabled:  !!slug,
  });
}

export function useCreateOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOnboardingPayload) =>
      api.post('/onboarding', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateOnboardingPayload> }) =>
      api.patch(`/onboarding/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useDeleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/onboarding/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
