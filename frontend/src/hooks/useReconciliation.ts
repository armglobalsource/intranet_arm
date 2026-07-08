import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { userKeys } from './useUsers';

export interface ExcelRowInput {
  rowKey:           string;
  nombreCompleto:   string;
  area?:            string;
  correo?:          string;
  fechaNacimiento?: string;
  campus?:          string;
}

export interface MatchCandidate {
  userId: number;
  name:   string;
  email:  string;
  score:  number;
  campus: string | null;
  area:   string | null;
}

export interface MatchResult {
  rowKey: string;
  excelRow: {
    nombreCompleto:   string;
    area?:            string;
    correo?:          string;
    fechaNacimiento?: string;
    campus?:          string;
  };
  parsedBirthDate:  string | null;
  resolvedCampusId: number | null;
  suggestedUserId:  number | null;
  confidence:       number;
  topCandidates:    MatchCandidate[];
}

export interface ApplyMatchInput {
  rowKey:          string;
  action:          'update' | 'create';
  userId?:         number;
  nombreCompleto?: string;
  email?:          string;
  birthDate?:      string;
  campusId?:       number;
}

export interface ApplyResult {
  rowKey:   string;
  userId?:  number;
  status:   'success' | 'skipped' | 'error';
  message?: string;
}

export function useMatchReconciliation() {
  return useMutation({
    mutationFn: (rows: ExcelRowInput[]) =>
      api.post<MatchResult[]>('/reconciliation/match', { rows }).then((r) => r.data),
  });
}

export function useApplyReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matches: ApplyMatchInput[]) =>
      api.post<ApplyResult[]>('/reconciliation/apply', { matches }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}
