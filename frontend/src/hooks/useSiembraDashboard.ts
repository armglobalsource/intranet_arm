import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type GroupBy = 'week' | 'month';

export interface SiembraTotales {
  ofrendas: number;
  diezmos: number;
  otros: number;
  total: number;
  efectivo: number;
  sumup: number;
  metodoDesconocido: number;
}

export interface SiembraMoneda extends SiembraTotales {
  moneda: string;
  label: string;
  hasRate: boolean;
}

export interface SiembraReferencia extends SiembraTotales {
  missingRateCurrencies: string[];
}

export interface SiembraPeriodo {
  key: string;
  label: string;
  start: string;
  end: string;
  referenceCLP: number;
  referenceUSD: number;
}

export interface FxRate {
  moneda: string;
  unitsPerUSD: number;
  source?: 'api' | 'manual';
  updatedAt?: string;
  updatedBy?: { uid: string; email: string };
}

export interface SiembraDashboardResponse {
  meta: {
    year: number;
    groupBy: GroupBy;
    campus: string | null;
    generatedAt: string;
    recordCount: number;
    legacyRecordCount: number;
  };
  currencies: SiembraMoneda[];
  reference: { clp: SiembraReferencia; usd: SiembraReferencia };
  periods: SiembraPeriodo[];
  fxRates: FxRate[];
}

const keys = {
  dashboard: (year: number, groupBy: GroupBy, campus?: string) =>
    ['siembra-dashboard', year, groupBy, campus ?? null] as const,
};

export function useSiembraDashboard(year: number, groupBy: GroupBy, campus?: string) {
  return useQuery<SiembraDashboardResponse>({
    queryKey: keys.dashboard(year, groupBy, campus),
    queryFn: () =>
      api.get('/siembra/dashboard', { params: { year, groupBy, ...(campus ? { campus } : {}) } })
        .then((r) => r.data),
    staleTime: 60 * 1000,
  });
}

export function useUpdateTipoCambio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moneda, unitsPerUSD }: { moneda: string; unitsPerUSD: number }) =>
      api.patch(`/tipo-cambio/${moneda}`, { unitsPerUSD }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['siembra-dashboard'] }),
  });
}

/** Fuerza un refresco inmediato desde la API pública (no hace falta esperar el TTL diario). */
export function useRefreshTipoCambio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/tipo-cambio/refresh').then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['siembra-dashboard'] }),
  });
}
