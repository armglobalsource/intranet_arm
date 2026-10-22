import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { UploadsController } from './uploads.controller';

describe('authorized direct uploads', () => {
  const storage = { createUploadUrl: vi.fn(), readUpload: vi.fn(), discardUpload: vi.fn() };
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
});
