'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Totales { totalGral: number; totalAudit: number; paj: number }
export type Celda = Totales | 'n/a' | 'S/R' | 'P/R' | 'Obs.';
export interface FilaSemanal {
  campusId: number; campus: string; pais: string; fecha: string; dia: string; hora: string;
  modalidad: 'Presencial' | 'On Line'; tipo: string; evento: boolean;
  estado: 'subido' | 'enviado' | 'observado' | 'sin_reporte';
  totales: { totalGral: number; totalAudit: number | null; paj: number } | null;
}
export interface ReporteSemanal {
  semana: { desde: string; hasta: string };
  anterior: { desde: string; hasta: string };
  incluyePorRevisar: boolean;
  dias: { fecha: string; dia: string; paises: { pais: string; filas: FilaSemanal[]; subtotal: Totales }[]; total: Totales }[];
  totalSemana: Totales;
  campus: {
    campusId: number; campus: string; pais: string; dias: string[]; eventos: string[];
    anterior: { porDia: Record<string, Celda>; semana: Totales };
    actual: { porDia: Record<string, Celda>; semana: Totales };
    diferencia: Totales;
  }[];
  comparacion: { anterior: Totales; actual: Totales; diferencia: Totales };
  resumen: { incluidos: number; sinReporte: number; porRevisar: number; observados: number };
  /** El mismo HTML que se envía por correo (los textos ya vienen escapados por la API). */
  html: string;
}

export function useReporteSemanal(semana: string, porRevisar: boolean) {
  return useQuery<ReporteSemanal>({
    queryKey: ['estadisticas', 'reporte-semanal', semana, porRevisar],
    queryFn: () => api.get('/estadisticas/reporte-semanal', { params: { semana, porRevisar: porRevisar ? '1' : undefined } }).then((r) => r.data),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(semana),
    staleTime: 60_000,
  });
}

export function useEnviarReporteSemanal() {
  return useMutation({
    mutationFn: (body: { semana: string; porRevisar: boolean; destinatarios: string[] }) =>
      api.post('/estadisticas/reporte-semanal/enviar', body).then((r) => r.data as { enviado: boolean; destinatarios: number }),
  });
}
