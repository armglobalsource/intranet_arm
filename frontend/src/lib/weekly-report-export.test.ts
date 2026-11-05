import { describe, expect, it } from 'vitest';
import { parseRecipients, weeklySheets } from './weekly-report-export';
import type { ReporteSemanal } from '@/hooks/useReporteSemanal';

const t = (totalGral: number, totalAudit: number, paj: number) => ({ totalGral, totalAudit, paj });
const report: ReporteSemanal = {
  semana: { desde: '2026-10-26', hasta: '2026-11-01' },
  anterior: { desde: '2026-10-19', hasta: '2026-10-25' },
  incluyePorRevisar: false,
  dias: [{ fecha: '2026-10-28', dia: 'Miércoles', total: t(673, 213, 12), paises: [{ pais: 'Chile', subtotal: t(673, 213, 12), filas: [
    { campusId: 1, campus: 'Stgo Centro', pais: 'Chile', fecha: '2026-10-28', dia: 'Miércoles', hora: '20:00', modalidad: 'Presencial', tipo: 'Encuentro', evento: false, estado: 'subido', totales: { totalGral: 319, totalAudit: 213, paj: 9 } },
    { campusId: 1, campus: 'Stgo Centro', pais: 'Chile', fecha: '2026-10-28', dia: 'Miércoles', hora: '20:00', modalidad: 'On Line', tipo: 'Enc. Global', evento: false, estado: 'subido', totales: { totalGral: 354, totalAudit: null, paj: 3 } },
    { campusId: 2, campus: 'Puente Alto', pais: 'Chile', fecha: '2026-10-28', dia: 'Miércoles', hora: '20:00', modalidad: 'Presencial', tipo: 'Encuentro', evento: false, estado: 'sin_reporte', totales: null },
  ] }] }],
  totalSemana: t(673, 213, 12),
  campus: [{ campusId: 1, campus: 'Stgo Centro', pais: 'Chile', dias: ['Miércoles'], eventos: [],
    anterior: { porDia: { 'Miércoles': t(298, 208, 14) }, semana: t(298, 208, 14) },
    actual: { porDia: { 'Miércoles': 'P/R' }, semana: t(673, 213, 12) }, diferencia: t(375, 5, -2) }],
  comparacion: { anterior: t(298, 208, 14), actual: t(673, 213, 12), diferencia: t(375, 5, -2) },
  resumen: { incluidos: 1, sinReporte: 1, porRevisar: 0, observados: 0 },
  html: '',
};

describe('exportación del reporte semanal', () => {
  it('arma las tres hojas con los mismos valores del correo', () => {
    const [semanal, campus, comparacion] = weeklySheets(report);
    expect(semanal.rows[2]).toEqual(['Chile', '2026-10-28', 'Miércoles', 'Stgo Centro', '20:00', 'On Line', 'Enc. Global', 354, 'n/a', 3]);
    expect(semanal.rows[3].slice(7)).toEqual(['S/R', 'S/R', 'S/R']);
    expect(semanal.rows.at(-1)).toEqual(['', '', '', '', '', '', 'TOTAL SEM.', 673, 213, 12]);
    expect(campus.rows).toContainEqual(['Stgo Centro', 'Chile', 'Miércoles', '2026-10-26 al 2026-11-01', 'P/R', 'P/R', 'P/R']);
    expect(comparacion.rows.at(-1)).toEqual(['Diferencia', 375, 5, -2]);
  });

  it('separa correos válidos e inválidos y quita repetidos', () => {
    expect(parseRecipients('Cami@ARM.org, cami@arm.org;\nlider@arm.org  malo@')).toEqual({ valid: ['cami@arm.org', 'lider@arm.org'], invalid: ['malo@'] });
  });
});
