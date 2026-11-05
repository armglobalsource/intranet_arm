import { describe, expect, it } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { WeeklyReportSettings } from './weekly-report.settings';

const missing = Object.assign(new Error('relation does not exist'), { code: '42P01' });

describe('destinatarios del reporte semanal', () => {
  it('lee la lista guardada', async () => {
    const db = { query: async () => ({ rows: [{ value: ['a@arm.org', 'b@arm.org'] }] }) };
    await expect(new WeeklyReportSettings(db as any).recipients()).resolves.toEqual({ destinatarios: ['a@arm.org', 'b@arm.org'], disponible: true });
  });

  it('sin la tabla de configuración responde que no está disponible en vez de fallar', async () => {
    const db = { query: async () => { throw missing; } };
    const settings = new WeeklyReportSettings(db as any);
    await expect(settings.recipients()).resolves.toEqual({ destinatarios: [], disponible: false });
    await expect(settings.saveRecipients(['a@arm.org'], 'cami')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('guarda la lista sin repetidos y en minúsculas', async () => {
    const calls: unknown[][] = [];
    const db = { query: async (_sql: string, values: unknown[]) => { calls.push(values); return { rows: [] }; } };
    const saved = await new WeeklyReportSettings(db as any).saveRecipients(['A@arm.org ', 'a@arm.org', 'b@arm.org'], 'cami@arm.org');
    expect(saved.destinatarios).toEqual(['a@arm.org', 'b@arm.org']);
    expect(calls[0]).toEqual(['reporte_semanal.destinatarios', JSON.stringify(['a@arm.org', 'b@arm.org']), 'cami@arm.org']);
  });
});
