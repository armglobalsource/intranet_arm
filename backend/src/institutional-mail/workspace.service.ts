import { BadRequestException, ConflictException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
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
    return { configured, available: configured && production, automation: configured && production && this.config.get<string>('GOOGLE_WORKSPACE_AUTOMATION_ENABLED') === 'true', domain: WORKSPACE_IDENTITY.domain, mode: 'verification' };
  }

  requireAutomation() {
    if (this.config.get<string>('VERCEL_ENV') !== 'production' || this.config.get<string>('GOOGLE_WORKSPACE_ENABLED') !== 'true' || this.config.get<string>('GOOGLE_WORKSPACE_AUTOMATION_ENABLED') !== 'true') {
      throw new ServiceUnavailableException('La automatización de Workspace todavía no está habilitada en Production.');
    }
  }

  async directory() {
    this.requireAutomation();
    return new WorkspaceDirectory(await this.accessToken());
  }

  async groups(actor: MailActor) {
    this.requireManager(actor);
    if (!this.status(actor).available) throw new ServiceUnavailableException('Workspace no está disponible en Production.');
    return new WorkspaceDirectory(await this.accessToken()).groups();
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

export type DirectoryUser = {id:string;primaryEmail:string;isAdmin?:boolean;isDelegatedAdmin?:boolean;suspended?:boolean;isEnforcedIn2Sv?:boolean;isEnrolledIn2Sv?:boolean;isMailboxSetup?:boolean;externalIds?:{type:string;customType?:string;value:string}[]};
export const requestMarker = (u:DirectoryUser, id:string) => u.externalIds?.some(x=>x.customType==='ecosistema-request' && x.value===id) === true;
export function assertOrdinaryUser(u:DirectoryUser) {
  if (u.isAdmin || u.isDelegatedAdmin || u.primaryEmail.toLowerCase()===WORKSPACE_IDENTITY.administrator || u.primaryEmail.toLowerCase()==='pburgos@armglobal.org') throw new ForbiddenException('Esta cuenta requiere gestión directa del administrador de Google.');
}

// Internal adapter: callers only use typed operations, never arbitrary URLs or bodies.
export class WorkspaceDirectory {
  constructor(private readonly token:string) {}
  private async call(path:string, method='GET', body?:unknown, allowMissing=false):Promise<any> {
    try {
      const res=await fetch(`https://admin.googleapis.com/admin/directory/v1/${path}`, {
        method, redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},
        ...(body===undefined?{}:{body:JSON.stringify(body)}),
      });
      if (allowMissing && res.status===404) return null;
      if (res.status===409) throw new ConflictException('Google informa que el correo o la asignación ya existe. Revisa la solicitud antes de reintentar.');
      if (!res.ok) throw new ServiceUnavailableException(`Google no confirmó la operación (HTTP ${res.status}). Puedes reanudarla desde esta solicitud.`);
      return res.status===204 ? {} : await res.json();
    } catch(error) {
      if (error instanceof ConflictException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Google no confirmó la operación. Puedes reanudarla desde esta solicitud.');
    }
  }
  async user(key:string):Promise<DirectoryUser|null> {
    return this.call(`users/${encodeURIComponent(key)}?projection=full&fields=id,primaryEmail,isAdmin,isDelegatedAdmin,suspended,isEnforcedIn2Sv,isEnrolledIn2Sv,isMailboxSetup,externalIds`,'GET',undefined,true);
  }
  async groups():Promise<{id:string;email:string;name:string}[]> {
    let page=''; const all:{id:string;email:string;name:string}[]=[];
    do {
      const data=await this.call(`groups?domain=${WORKSPACE_IDENTITY.domain}&maxResults=200&fields=groups(id,email,name),nextPageToken${page?'&pageToken='+encodeURIComponent(page):''}`);
      all.push(...(data.groups??[])); page=data.nextPageToken??'';
      if (all.length>2000) throw new BadRequestException('Demasiados grupos para este selector. Contacta al administrador.');
    } while(page);
    return all;
  }
  async create(id:string,email:string,name:string):Promise<DirectoryUser> {
    const existing=await this.user(email);
    if (existing) {
      assertOrdinaryUser(existing);
      if (!requestMarker(existing,id) || existing.primaryEmail.toLowerCase()!==email || existing.suspended) throw new ConflictException('Este correo ya existe en Google, fue suspendido o no fue creado por esta solicitud.');
      return existing;
    }
    const [givenName,...surname]=name.trim().split(/\s+/);
    if (!surname.length) throw new BadRequestException('Indica nombre y apellido antes de crear la cuenta.');
    // Random bootstrap credential is discarded, never returned, persisted, or emailed.
    const created=await this.call('users','POST',{primaryEmail:email,name:{givenName,familyName:surname.join(' ')},
      password:randomBytes(48).toString('base64url'),changePasswordAtNextLogin:true,
      externalIds:[{type:'custom',customType:'ecosistema-request',value:id}],
    });
    if (!created.id || created.primaryEmail?.toLowerCase()!==email) throw new ServiceUnavailableException('Google no confirmó el identificador de la cuenta. Reanuda la solicitud para verificarla.');
    return created;
  }
  async addMember(group:string,user:DirectoryUser) {
    const path=`groups/${encodeURIComponent(group)}/members`;
    const existing=await this.call(`${path}/${encodeURIComponent(user.id)}`,'GET',undefined,true);
    if (existing) return;
    try {await this.call(path,'POST',{email:user.primaryEmail,role:'MEMBER'});}
    catch(error) {if (!(error instanceof ConflictException) || !await this.call(`${path}/${encodeURIComponent(user.id)}`,'GET',undefined,true)) throw error;}
  }
  async suspend(u:DirectoryUser) {
    assertOrdinaryUser(u);
    if (!u.suspended) await this.call(`users/${encodeURIComponent(u.id)}`,'PATCH',{suspended:true});
  }
  async activate(u:DirectoryUser,password:string,requestId:string) {
    assertOrdinaryUser(u);
    if (u.suspended || !requestMarker(u,requestId)) throw new ForbiddenException('La cuenta no está disponible para activación. Contacta a TI.');
    await this.call(`users/${encodeURIComponent(u.id)}`,'PATCH',{password,changePasswordAtNextLogin:true});
  }
}
