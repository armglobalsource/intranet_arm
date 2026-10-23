import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  refreshToken: 'refresh-1' as string | null,
  setTokens: vi.fn(),
  updateUser: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('./store/auth.store', () => ({ useAuthStore: { getState: () => state } }));

const post = vi.hoisted(() => vi.fn());
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  const instance = actual.default.create();
  return { default: { ...actual.default, create: () => instance, post } };
});

import { refreshAccessToken } from './api';

describe('refreshAccessToken', () => {
  beforeEach(() => { post.mockReset(); state.setTokens.mockReset(); });

  it('shares one refresh call between concurrent 401s', async () => {
    post.mockResolvedValue({ data: { accessToken: 'access-2', refreshToken: 'refresh-2' } });
    const tokens = await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(['access-2', 'access-2', 'access-2']);
    expect(state.setTokens).toHaveBeenCalledWith('access-2', 'refresh-2');
  });

  it('starts a new refresh once the previous one finished', async () => {
    post.mockResolvedValue({ data: { accessToken: 'access-3', refreshToken: 'refresh-3' } });
    await refreshAccessToken();
    await refreshAccessToken();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('rejects every waiting request when the refresh fails', async () => {
    post.mockRejectedValue(new Error('401'));
    const results = await Promise.allSettled([refreshAccessToken(), refreshAccessToken()]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
  });
});
