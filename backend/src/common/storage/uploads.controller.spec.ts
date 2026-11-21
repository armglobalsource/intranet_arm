import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { looksLikeImage, UploadsController } from './uploads.controller';

describe('authorized direct uploads', () => {
  const storage = { createUploadUrl: vi.fn(), readUpload: vi.fn(), discardUpload: vi.fn(), uploadPublic: vi.fn() };
  const users = { findOne: vi.fn(), uploadAvatar: vi.fn() };
  const visuals = { create: vi.fn() };
  const feedback = { create: vi.fn() };
  const jwt = new JwtService({ secret: 'test-only-long-secret-not-used-outside-unit-tests' });
  const controller = new UploadsController(storage as any, jwt, users as any, visuals as any, feedback as any);
  const actor = { sub: 12, permissions: [] };
  beforeEach(() => {
    vi.clearAllMocks();
    storage.createUploadUrl.mockResolvedValue('https://example.supabase.co/signed');
    storage.readUpload.mockResolvedValue(Buffer.from('abc'));
    users.findOne.mockResolvedValue({ id: 12 });
    users.uploadAvatar.mockResolvedValue({ id: 12 });
  });

  it('binds a ticket to its user, purpose and target', async () => {
    const { ticket } = await controller.ticket({ purpose: 'avatar', userId: 12, contentType: 'image/png', size: 3 }, actor);
    await expect(controller.avatar({ ticket }, { sub: 13, permissions: ['*'] })).rejects.toThrow();
    await expect(controller.visual({ ticket, metadata: { name: 'test' } }, { ...actor, permissions: ['*'] })).rejects.toThrow();
    expect(storage.readUpload).not.toHaveBeenCalled();
    await controller.avatar({ ticket }, actor);
    expect(users.uploadAvatar).toHaveBeenCalledWith(12, expect.objectContaining({ mimetype: 'image/png' }));
    expect(storage.discardUpload).toHaveBeenCalledTimes(1);
  });

  it('rechecks permission after upload and rejects expired tickets', async () => {
    const admin = { ...actor, permissions: ['visual-references:manage'] };
    const { ticket } = await controller.ticket({ purpose: 'visual-reference', contentType: 'image/png', size: 3 }, admin);
    await expect(controller.visual({ ticket, metadata: { name: 'test' } }, actor)).rejects.toThrow();
    const expired = await jwt.signAsync({ sub: 12, purpose: 'avatar', userId: 12, key: '12/file', size: 3 }, { audience: 'arm-upload', issuer: 'arm-api', expiresIn: -1 });
    await expect(controller.avatar({ ticket: expired }, actor)).rejects.toThrow();
    expect(storage.readUpload).not.toHaveBeenCalled();
  });

  it('rejects forbidden targets, file formats and excessive sizes before allocating storage', async () => {
    await expect(controller.ticket({ purpose: 'avatar', userId: 13, contentType: 'image/png', size: 3 }, actor)).rejects.toThrow();
    await expect(controller.ticket({ purpose: 'feedback', contentType: 'text/html', size: 3 }, actor)).rejects.toThrow();
    await expect(controller.ticket({ purpose: 'feedback', contentType: 'image/png', size: 6 * 1024 * 1024 }, actor)).rejects.toThrow();
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });

  it('portada de evento: solo quien administra eventos, solo imágenes reales y URL pública', async () => {
    await expect(controller.ticket({ purpose: 'event-cover', contentType: 'image/png', size: 3 }, actor)).rejects.toThrow();
    const organizer = { ...actor, permissions: ['eventos:organize'] };
    await expect(controller.ticket({ purpose: 'event-cover', contentType: 'image/gif', size: 3 }, organizer)).rejects.toThrow();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    storage.readUpload.mockResolvedValue(png);
    storage.uploadPublic.mockResolvedValue('https://example.supabase.co/public/event-covers/x.png');
    const { ticket } = await controller.ticket({ purpose: 'event-cover', contentType: 'image/png', size: png.length }, organizer);
    await expect(controller.eventCover({ ticket }, organizer)).resolves.toEqual({ url: 'https://example.supabase.co/public/event-covers/x.png' });
    expect(storage.uploadPublic).toHaveBeenCalledWith(expect.stringMatching(/^event-covers\/12-\d+-[a-f0-9]{8}\.png$/), png, 'image/png');
    expect(storage.discardUpload).toHaveBeenCalledTimes(1);
    // Un HTML disfrazado de PNG se rechaza y el archivo temporal igual se elimina.
    storage.readUpload.mockResolvedValue(Buffer.from('<html>no</html>'));
    const fake = await controller.ticket({ purpose: 'event-cover', contentType: 'image/png', size: 15 }, organizer);
    await expect(controller.eventCover({ ticket: fake.ticket }, organizer)).rejects.toThrow(/no es una imagen/);
    expect(storage.discardUpload).toHaveBeenCalledTimes(2);
  });

  it('reconoce las firmas de JPG, PNG y WebP', () => {
    expect(looksLikeImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true);
    expect(looksLikeImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]), 'image/webp')).toBe(true);
    expect(looksLikeImage(Buffer.from('GIF89a'), 'image/png')).toBe(false);
  });
});
