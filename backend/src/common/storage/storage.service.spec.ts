import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
const storage = vi.hoisted(() => ({
  upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn(), getPublicUrl: vi.fn(), from: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage }) }));
import { StorageService } from './storage.service';

describe('Supabase Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.from.mockReturnValue(storage);
    storage.upload.mockResolvedValue({ error: null });
    storage.remove.mockResolvedValue({ error: null });
    storage.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.supabase.co/public/image.png' } });
    storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.supabase.co/private/signed' }, error: null });
  });
  const service = () => new StorageService(new ConfigService({ STORAGE: 'supabase', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-only' }));

  it('separa documentos privados de imágenes públicas', async () => {
    const subject = service();
    await subject.uploadDocument('documents/a.pdf', Buffer.from('pdf'), 'application/pdf');
    expect(storage.from).toHaveBeenLastCalledWith('arm-documents');
    expect(storage.getPublicUrl).not.toHaveBeenCalled();
    await subject.getPresignedUrl('documents', 'documents/a.pdf', 60);
    expect(storage.createSignedUrl).toHaveBeenCalledWith('documents/a.pdf', 60);
    await subject.uploadPublic('avatars/a.png', Buffer.from('png'), 'image/png');
    expect(storage.from).toHaveBeenLastCalledWith('arm-public');
    expect(storage.upload).toHaveBeenLastCalledWith('avatars/a.png', expect.any(Buffer), { contentType: 'image/png', upsert: false });
  });

  it('rechaza rutas fuera del bucket y oculta detalles de errores del proveedor', async () => {
    await expect(service().uploadPublic('../secret', Buffer.from('x'), 'image/png')).rejects.toThrow('Ruta');
    expect(storage.upload).not.toHaveBeenCalled();
    storage.upload.mockResolvedValue({ error: { message: 'sensitive provider details' } });
    await expect(service().uploadPublic('a.png', Buffer.from('x'), 'image/png')).rejects.toThrow('No se pudo guardar');
    expect(storage.getPublicUrl).not.toHaveBeenCalled();
  });

  it('rechaza configuraciones incompletas en lugar de guardar localmente', () => {
    expect(() => new StorageService(new ConfigService({ STORAGE: 'supabase' }))).toThrow('Faltan SUPABASE_URL');
    expect(() => new StorageService(new ConfigService({ STORAGE: 'typo' }))).toThrow('Proveedor');
  });
});
