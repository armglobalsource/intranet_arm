import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ResendMailerService } from './resend-mailer.service';

const config = { RESEND_API_KEY: 'test-only-key', RESEND_FROM_EMAIL: 'ARM <access@example.invalid>', FRONTEND_URL: 'https://ecosistema.armglobal.org' };
afterEach(() => vi.unstubAllGlobals());
describe('Resend recovery delivery', () => {
  it('sends both formats with a fragment token and an idempotency key', async () => {
    const fetch = vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'email-id'})});
    vi.stubGlobal('fetch',fetch);
    await new ResendMailerService(new ConfigService(config)).sendPasswordReset('owner@example.invalid','a'.repeat(64),'request-id');
    const [url,options] = fetch.mock.calls[0];
    const body=JSON.parse(options.body);
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers['Idempotency-Key']).toBe('password-reset/request-id');
    expect(body.to).toEqual(['owner@example.invalid']);
    expect(body.text).toContain('https://ecosistema.armglobal.org/auth/reset-password#token=');
    expect(body.html).toContain('15 minutos');
    expect(body.html).not.toContain(config.RESEND_API_KEY);
  });
  it.each(['http://ecosistema.armglobal.org','https://evil:password@example.invalid','https://example.invalid/path',''])('rejects an unsafe reset origin: %s', origin=>{
    expect(()=>new ResendMailerService(new ConfigService({...config,FRONTEND_URL:origin})).settings()).toThrow();
  });
  it('rejects missing configuration before looking up an account',()=>{
    expect(()=>new ResendMailerService(new ConfigService({...config,RESEND_API_KEY:''})).settings()).toThrow();
  });
  it('never considers a provider error or malformed acknowledgement successful',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:403}));
    await expect(new ResendMailerService(new ConfigService(config)).sendPasswordReset('test@example.invalid','a'.repeat(64),'id')).rejects.toThrow('Resend HTTP 403');
  });
});
