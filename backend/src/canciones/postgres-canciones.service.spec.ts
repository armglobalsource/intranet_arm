import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { PostgresCancionesService } from './postgres-canciones.service';
import { CancionesController } from './canciones.controller';
import { PERMISSION_KEY } from '../common/decorators/require-permission.decorator';

describe('catálogo de canciones', () => {
  it('limita la edición del catálogo a personas con permiso de fichas', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, CancionesController.prototype.update)).toBe('fichas:edit');
  });
  it('devuelve la letra solo en el detalle, no en resultados de búsqueda', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const svc = new PostgresCancionesService({ query } as any);
    await svc.search('light');
    expect(query.mock.calls[0][0]).toContain('AS "hasLetra"');
    expect(query.mock.calls[0][0]).not.toContain('titulo,tonalidad,letra');
  });
  it('guarda tono y letra cuando coincide la revisión con microsegundos', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ cancionId: 'song', tonalidad: 'G', letra: 'Letra interna' }] });
    const svc = new PostgresCancionesService({ query } as any);
    await expect(svc.update('song', { tonalidad: ' G ', letra: ' Letra interna ', expectedUpdatedAt: '2026-10-27T09:00:00.123456Z' })).resolves.toMatchObject({ tonalidad: 'G' });
    expect(query.mock.calls[0][0]).toContain('IS NOT DISTINCT FROM $4::timestamptz');
    expect(query.mock.calls[0][1]).toEqual(['song', 'G', 'Letra interna', '2026-10-27T09:00:00.123456Z']);
  });
  it('rechaza una edición obsoleta sin sobrescribir la versión guardada', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{}], rowCount: 1 });
    const svc = new PostgresCancionesService({ query } as any);
    await expect(svc.update('song', { tonalidad: 'D', letra: 'texto', expectedUpdatedAt: '2026-10-27T09:00:00.123456Z' })).rejects.toThrow('La canción cambió');
    expect(query).toHaveBeenCalledTimes(2);
  });
});
