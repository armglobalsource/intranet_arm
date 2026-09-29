import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type GroupBy = 'day' | 'week' | 'month';

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
  /** Pesos chilenos por 1 unidad (1 para CLP, null si no hay tasa). */
  clpPorUnidad: number | null;
  totalClp: number | null;
}

export type SiembraReferencia = SiembraTotales;

export interface TasaClp {
  moneda: string;
  clpPorUnidad: number | null;
  fuente: 'api' | 'manual';
  updatedAt: string | null;
}

export interface SiembraPeriodo {
  key: string;
  label: string;
  start: string;
  end: string;
  referenceCLP: number;
  referenceUSD: number;
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
  tipoCambio: {
    actualizadoApi: string | null;
    sinTasa: string[];
    tasas: TasaClp[];
  };
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
    mutationFn: ({ moneda, clpPorUnidad }: { moneda: string; clpPorUnidad: number }) =>
      api.patch(`/tipo-cambio/${moneda}`, { clpPorUnidad }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['siembra-dashboard'] }),
  });
}

/** Quita el ajuste manual de una moneda: vuelve a la tasa automática. */
export function useResetTipoCambio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moneda: string) => api.delete(`/tipo-cambio/${moneda}`).then((r) => r.data),
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
