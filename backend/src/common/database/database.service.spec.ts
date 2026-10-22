import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { buildPostgresOptions } from './postgres-options';

const mocks = vi.hoisted(() => ({
  query: vi.fn(), connect: vi.fn(), end: vi.fn(), on: vi.fn(), release: vi.fn(),
}));
vi.mock('pg', () => ({ Pool: vi.fn(() => mocks) }));
import { DatabaseService } from './database.service';

const config = () => new ConfigService({ DATABASE_URL: 'postgresql://app:example@db.example.org:6543/postgres?sslmode=require' });

describe('conexión PostgreSQL', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('mantiene validación TLS incluso con sslmode en la URI', () => {
    const options = buildPostgresOptions('postgresql://app:a%40b@db.example.org:6543/postgres?sslmode=require', 'certificate');
    expect(options.password).toBe('a@b');
    expect(options.ssl).toEqual({ rejectUnauthorized: true, ca: 'certificate' });
    expect(options.max).toBe(3);
    expect(() => buildPostgresOptions('postgresql://app:x@db.example.org/postgres?sslmode=disable')).toThrow('TLS');
  });

  it('oculta el valor de una URI inválida en el error', () => {
    const secret = 'not-a-url-with-a-secret';
    try { buildPostgresOptions(secret); throw new Error('expected rejection'); }
    catch (error) { expect((error as Error).message).not.toContain(secret); }
  });

  it('incluye la CA pública de Supabase conservando validación del certificado y hostname', () => {
    const options = buildPostgresOptions('postgresql://app:example@db.abcdefghijklmnopqrst.supabase.co/postgres?sslmode=no-verify');
    expect(options.ssl).toMatchObject({ rejectUnauthorized: true });
    expect((options.ssl as { ca: string[] }).ca.some(cert => cert.includes('BEGIN CERTIFICATE'))).toBe(true);
  });

  it('es opcional mientras los servicios se migran de Firestore', async () => {
    const service = new DatabaseService(new ConfigService({}));
    expect(service.configured).toBe(false);
    expect(() => service.query('select 1')).toThrow('DATABASE_URL');
    await service.onModuleDestroy();
    expect(mocks.end).not.toHaveBeenCalled();
  });

  it('hace rollback con el mismo cliente y siempre lo libera', async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const client = { query: clientQuery, release: mocks.release };
    mocks.connect.mockResolvedValue(client);
    const service = new DatabaseService(config());
    const failure = new Error('application failure');
    await expect(service.transaction(async connection => {
      await connection.query('select 1'); throw failure;
    })).rejects.toBe(failure);
    expect(clientQuery.mock.calls.map(call => call[0])).toEqual(['BEGIN', 'select 1', 'ROLLBACK']);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledWith(false);
  });

  it('descarta una conexión cuyo rollback falla sin ocultar el error original', async () => {
    const failure = new Error('original failure');
    const clientQuery = vi.fn().mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('rollback failure'));
    mocks.connect.mockResolvedValue({ query: clientQuery, release: mocks.release });
    await expect(new DatabaseService(config()).transaction(async () => { throw failure; })).rejects.toBe(failure);
    expect(mocks.release).toHaveBeenCalledWith(true);
  });

  it('confirma transacciones y cierra el pool al apagar el módulo', async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    mocks.connect.mockResolvedValue({ query: clientQuery, release: mocks.release });
    const service = new DatabaseService(config());
    expect(await service.transaction(async () => 42)).toBe(42);
    expect(clientQuery.mock.calls.map(call => call[0])).toEqual(['BEGIN', 'COMMIT']);
    await service.onModuleDestroy();
    expect(mocks.end).toHaveBeenCalledOnce();
  });
});
