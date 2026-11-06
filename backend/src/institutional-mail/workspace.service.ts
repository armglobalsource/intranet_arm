import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getVercelOidcToken } from '@vercel/oidc';
import { MailActor, managesMail } from './mail.rules';

// Tenant and identity explicitly approved for this deployment. No client input can
// select another service account, delegated administrator, audience or domain.
export const WORKSPACE_IDENTITY = {
  provider: '//iam.googleapis.com/projects/950009830479/locations/global/workloadIdentityPools/vercel-production/providers/vercel',
  serviceAccount: 'ecosistema-correos@skilled-box-513911-h1.iam.gserviceaccount.com',
  administrator: 'contacto@armglobal.org',
  domain: 'armglobal.org',
} as const;
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member',
] as const;

@Injectable()
export class WorkspaceService {
  constructor(private readonly config: ConfigService) {}

  private requireManager(actor: MailActor) {
    if (!managesMail(actor)) throw new ForbiddenException('Solo TI puede comprobar la conexión con Google Workspace.');
  }

  status(actor: MailActor) {
    this.requireManager(actor);
    const configured = this.config.get<string>('GOOGLE_WORKSPACE_ENABLED') === 'true';
    const production = this.config.get<string>('VERCEL_ENV') === 'production';
    return { configured, available: configured && production, domain: WORKSPACE_IDENTITY.domain, mode: 'verification' };
  }

  private async json(url: string, init: RequestInit, stage: string): Promise<Record<string, any>> {
    try {
      const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new ServiceUnavailableException(`No se pudo verificar Workspace (${stage}, HTTP ${response.status}).`);
      return await response.json();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      // Provider bodies, JWTs, tokens and directory data must never reach logs or UI.
      throw new ServiceUnavailableException(`No se pudo verificar Workspace (${stage}). Inténtalo nuevamente.`);
    }
  }

  private requiredString(value: unknown, stage: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new ServiceUnavailableException(`Google no confirmó la conexión (${stage}).`);
    return value;
  }

  private async accessToken(): Promise<string> {
    let oidc: string;
    try { oidc = this.requiredString(await getVercelOidcToken(), 'identidad'); }
    catch { throw new ServiceUnavailableException('No se recibió la identidad de Production de Vercel.'); }
    const federated = await this.json('https://sts.googleapis.com/v1/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        audience: WORKSPACE_IDENTITY.provider,
        requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        scope: 'https://www.googleapis.com/auth/iam', subject_token: oidc,
      }).toString(),
    }, 'identidad');
    const now = Math.floor(Date.now() / 1000);
    const signed = await this.json(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${WORKSPACE_IDENTITY.serviceAccount}:signJwt`, {
      method: 'POST', headers: { Authorization: `Bearer ${this.requiredString(federated.access_token, 'identidad')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: JSON.stringify({
        iss: WORKSPACE_IDENTITY.serviceAccount, sub: WORKSPACE_IDENTITY.administrator,
        aud: 'https://oauth2.googleapis.com/token', scope: WORKSPACE_SCOPES.join(' '), iat: now, exp: now + 300,
      }) }),
    }, 'firma');
    const delegated = await this.json('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: this.requiredString(signed.signedJwt, 'firma') }).toString(),
    }, 'delegación');
    return this.requiredString(delegated.access_token, 'delegación');
  }

  async check(actor: MailActor) {
    const status = this.status(actor);
    if (!status.available) throw new ServiceUnavailableException('La conexión con Workspace aún no está habilitada en Production.');
    const token = await this.accessToken();
    const headers = { Authorization: `Bearer ${token}` };
    // Only read a single ID per collection, discard it, and return no personal data.
    await this.json(`https://admin.googleapis.com/admin/directory/v1/users?domain=${WORKSPACE_IDENTITY.domain}&maxResults=1&fields=users(id)`, { method: 'GET', headers }, 'usuarios');
    await this.json(`https://admin.googleapis.com/admin/directory/v1/groups?domain=${WORKSPACE_IDENTITY.domain}&maxResults=1&fields=groups(id)`, { method: 'GET', headers }, 'grupos');
    return { connected: true, domain: WORKSPACE_IDENTITY.domain, checkedAt: new Date().toISOString(), mode: 'verification' };
  }
}
