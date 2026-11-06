import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { getVercelOidcToken } from '@vercel/oidc';
import { WorkspaceService, WORKSPACE_IDENTITY, WORKSPACE_SCOPES } from './workspace.service';

vi.mock('@vercel/oidc', () => ({ getVercelOidcToken: vi.fn() }));
const operator = { sub: 3, permissions: ['institutional-mail:manage'] };
const make = (environment = 'production', enabled = 'true') => new WorkspaceService(new ConfigService({ VERCEL_ENV: environment, GOOGLE_WORKSPACE_ENABLED: enabled }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Workspace federation boundary', () => {
  it('restricts status and token exchange to TI', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const service = make();
    for (const permissions of [[], ['institutional-mail:approve']]) {
      expect(() => service.status({ sub: 1, permissions })).toThrow('Solo TI');
      await expect(service.check({ sub: 1, permissions })).rejects.toThrow('Solo TI');
    }
    expect(getVercelOidcToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('never exchanges tokens in Preview, development, or when disabled', async () => {
    for (const [env, enabled] of [['preview', 'true'], ['development', 'true'], ['production', 'false']]) {
      await expect(make(env, enabled).check(operator)).rejects.toThrow('Production');
    }
    expect(getVercelOidcToken).not.toHaveBeenCalled();
  });
  it('uses the approved identity, short JWT lifetime, exact scopes, and read-only directory calls', async () => {
    vi.mocked(getVercelOidcToken).mockResolvedValue('vercel-token');
    const replies = [{ access_token: 'federated-token' }, { signedJwt: 'signed-token' }, { access_token: 'workspace-token' }, { users: [{ id: 'private-user-id' }] }, { groups: [{ id: 'private-group-id' }] }];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(replies.shift()), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await make().check(operator);
    expect(result).toMatchObject({ connected: true, domain: 'armglobal.org', mode: 'verification' });
    expect(JSON.stringify(result)).not.toMatch(/token|private-/);
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const exchange = new URLSearchParams(calls[0][1].body as string);
    expect(exchange.get('audience')).toBe(WORKSPACE_IDENTITY.provider);
    expect(exchange.get('subject_token')).toBe('vercel-token');
    const payload = JSON.parse(JSON.parse(calls[1][1].body as string).payload);
    expect(payload).toMatchObject({ iss: WORKSPACE_IDENTITY.serviceAccount, sub: WORKSPACE_IDENTITY.administrator, scope: WORKSPACE_SCOPES.join(' ') });
    expect(payload.exp - payload.iat).toBe(300);
    expect(calls.slice(3).map(([, options]) => options.method)).toEqual(['GET', 'GET']);
    expect(calls.slice(3).every(([url]) => url.includes('domain=armglobal.org') && url.includes('maxResults=1'))).toBe(true);
  });
  it('does not report connected or leak provider bodies when permissions are denied', async () => {
    vi.mocked(getVercelOidcToken).mockResolvedValue('private-vercel-token');
    const fetchMock = vi.fn(async () => new Response('private provider content', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(make().check(operator)).rejects.toThrow('identidad, HTTP 403');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('sanitizes network failures and refuses malformed token responses', async () => {
    vi.mocked(getVercelOidcToken).mockResolvedValue('private-vercel-token');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private-secret')));
    await expect(make().check(operator)).rejects.toThrow('No se pudo verificar Workspace (identidad).');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(make().check(operator)).rejects.toThrow('Google no confirmó');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
