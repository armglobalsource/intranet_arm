import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../common/database/database.service';
import { ResendMailerService } from '../auth/resend-mailer.service';
import { InstitutionalMailService } from './mail.service';
import { MailActor, corporateEmail, identityKey, managesMail } from './mail.rules';
import { MailActionDto, WorkspacePlanDto } from './mail.dto';
import { WorkspaceService, assertOrdinaryUser, requestMarker } from './workspace.service';

type Plan={email:string;license:string;groupEmails:string[];operation:'create'|'offboard';deliveryEmail?:string;name:string;identityKey:string};
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
const safeText=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

@Injectable()
export class WorkspaceProvisioningService {
  constructor(private readonly db:DatabaseService,private readonly workspace:WorkspaceService,
    private readonly mailer:ResendMailerService,private readonly mail:InstitutionalMailService) {}

  private async owned(client:PoolClient,id:string,actor:MailActor,version?:number) {
    if (!managesMail(actor)) throw new ForbiddenException('Solo TI puede ejecutar solicitudes en Google.');
    const r=(await client.query('SELECT * FROM arm_app.mail_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if (!r) throw new NotFoundException('Solicitud no encontrada.');
    if (r.status!=='creating' || Number(r.assigned_to)!==actor.sub) throw new ForbiddenException('Toma la solicitud aprobada antes de ejecutar la operación.');
    if (version!==undefined && r.version!==version) throw new ConflictException('La solicitud cambió. Actualiza la vista.');
    return r;
  }
  private async audit(client:PoolClient,id:string,actorId:number,action:string,note:string) {
    await client.query('INSERT INTO arm_app.mail_request_events(request_id,actor_id,action,note) VALUES($1,$2,$3,$4)',[id,actorId,action,note]);
  }
  private plan(r:any,dto:WorkspacePlanDto):Plan {
    const d=r.details;
    if (d.company!=='arm' || d.kind==='alias' || !['create','offboard'].includes(d.operation)) throw new BadRequestException('La automatización actual admite altas y suspensión de cuentas principales de armglobal.org. Los alias entre organizaciones y los cambios requieren gestión directa de TI.');
    if (!dto.identityConfirmed || !dto.licenseConfirmed) throw new BadRequestException('Confirma identidad, duplicados y disponibilidad de la licencia antes de ejecutar.');
    const email=dto.email.trim().toLowerCase();
    if (!corporateEmail(email) || !email.endsWith('@armglobal.org')) throw new BadRequestException('El correo debe pertenecer a armglobal.org.');
    if (email==='contacto@armglobal.org' || email==='pburgos@armglobal.org') throw new ForbiddenException('Esta cuenta requiere gestión directa del administrador de Google.');
    if (!dto.license.trim()) throw new BadRequestException('Registra la licencia revisada por TI.');
    if (d.operation==='offboard' && (email!==d.existingEmail || d.startsOn>new Date().toISOString().slice(0,10))) throw new BadRequestException('Comprueba el correo y la fecha efectiva de baja.');
    if (d.operation==='create' && d.expiresOn && d.expiresOn<=new Date().toISOString().slice(0,10)) throw new BadRequestException('El vencimiento ya pasó. Corrige la solicitud antes de ejecutarla.');
    const deliveryEmail=d.deliveryEmail?.trim().toLowerCase();
    if (d.operation==='create' && (!deliveryEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail) || deliveryEmail===email)) throw new BadRequestException('La solicitud aprobada debe incluir un correo de contacto accesible para la entrega. Devuélvela para completar ese dato.');
    if (d.operation==='create' && d.name.trim().split(/\s+/).length<2) throw new BadRequestException('La solicitud debe incluir nombre y apellido.');
    const groupEmails=[...new Set(dto.groupEmails.map(x=>x.trim().toLowerCase()))].sort();
    if (groupEmails.some(x=>!x.endsWith('@armglobal.org'))) throw new BadRequestException('Selecciona grupos del dominio armglobal.org.');
    if (d.operation==='offboard' && groupEmails.length) throw new BadRequestException('Una suspensión no agrega accesos a grupos.');
    return {email,license:dto.license.trim(),groupEmails,operation:d.operation,name:d.name,identityKey:identityKey(d.employeeId),...(d.operation==='create'?{deliveryEmail}:{})};
  }

  async execute(id:string,dto:WorkspacePlanDto,actor:MailActor) {
    this.workspace.requireAutomation();
    // Persist immutable intent BEFORE calling Google. A timeout can be reconciled
    // with the request marker, even if Vercel stops before recording the result.
    await this.db.transaction(async client=>{
      const r=await this.owned(client,id,actor,dto.version);
      const existing=(await client.query('SELECT request_id FROM arm_app.mail_workspace_jobs WHERE request_id=$1',[id])).rows[0];
      if (existing) return; // Retry uses only the original approved plan.
      const plan=this.plan(r,dto);
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[identityKey(r.details.employeeId)]);
      if (plan.operation==='create') {
        const duplicate=(await client.query(`SELECT 1 FROM arm_app.mail_accounts WHERE email=$1 OR ($3<>'functional' AND active AND primary_id IS NULL AND identity_key=$2 AND kind<>'functional')
          UNION ALL SELECT 1 FROM arm_app.mail_workspace_jobs j JOIN arm_app.mail_requests r ON r.id=j.request_id
          WHERE j.plan->>'email'=$1 OR ($3<>'functional' AND r.details->>'kind'<>'functional' AND r.status<>'delivered' AND j.plan->>'operation'='create' AND j.plan->>'identityKey'=$2) LIMIT 1`,[plan.email,identityKey(r.details.employeeId),r.details.kind])).rows[0];
        if (duplicate) throw new ConflictException('Existe una cuenta o ejecución para este correo o colaborador. Revisa el inventario antes de crear otra cuenta.');
        this.mailer.settings();
      } else {
        const account=(await client.query('SELECT identity_key,primary_id FROM arm_app.mail_accounts WHERE email=$1',[plan.email])).rows[0];
        if (account && (account.primary_id || account.identity_key!==identityKey(r.details.employeeId))) throw new ConflictException('La identidad no coincide con la cuenta principal del inventario.');
      }
      const directory=await this.workspace.directory();
      const googleUser=await directory.user(plan.email);
      if (plan.operation==='create' && googleUser) throw new ConflictException('El correo ya existe en Google. Revisa la identidad y usa un alias o cambio de accesos.');
      if (plan.operation==='offboard') {
        if (!googleUser || googleUser.primaryEmail.toLowerCase()!==plan.email) throw new BadRequestException('No se encontró esa cuenta principal en Google.');
        assertOrdinaryUser(googleUser);
      }
      const groups=new Set((await directory.groups()).map(g=>g.email.toLowerCase()));
      if (plan.groupEmails.some(g=>!groups.has(g))) throw new BadRequestException('Selecciona únicamente grupos existentes en Workspace.');
      await client.query('INSERT INTO arm_app.mail_workspace_jobs(request_id,plan) VALUES($1,$2)',[id,JSON.stringify(plan)]);
      await this.audit(client,id,actor.sub,'workspace_prepared','TI confirmó identidad, duplicados y licencia. Operación preparada para Google Workspace.');
    });
    try {
      await this.db.transaction(async client=>{
        const request=await this.owned(client,id,actor,dto.version);
        const job=(await client.query('SELECT * FROM arm_app.mail_workspace_jobs WHERE request_id=$1 FOR UPDATE',[id])).rows[0];
        if (job.state==='ready') return;
        const p:Plan=job.plan;
        if (p.operation==='create' && request.details.expiresOn && request.details.expiresOn<=new Date().toISOString().slice(0,10)) throw new BadRequestException('El vencimiento de esta cuenta ya pasó. TI debe revisar la ejecución antes de continuar.');
        const directory=await this.workspace.directory();
        let user;
        if (p.operation==='create') {
          // Resolve every group before creating a user; do not apply free-text access requests.
          const allowed=new Set((await directory.groups()).map(g=>g.email.toLowerCase()));
          if (p.groupEmails.some(g=>!allowed.has(g))) throw new BadRequestException('Un grupo seleccionado ya no está disponible. TI debe revisar la ejecución.');
          user=await directory.create(id,p.email,p.name);
          for (const group of p.groupEmails) await directory.addMember(group,user);
        } else {
          user=await directory.user(job.google_id||p.email);
          if (!user || user.primaryEmail.toLowerCase()!==p.email) throw new BadRequestException('No se encontró la cuenta principal indicada en Google.');
          assertOrdinaryUser(user);
          await directory.suspend(user);
        }
        await client.query("UPDATE arm_app.mail_workspace_jobs SET state='ready',google_id=$2,last_error=NULL,updated_at=now() WHERE request_id=$1",[id,user.id]);
        await this.audit(client,id,actor.sub,'workspace_executed',p.operation==='create'?'Cuenta creada y grupos aplicados. Falta entregar el acceso y verificar MFA.':'Cuenta suspendida en Google. TI debe revisar sesiones, datos y licencia antes de cerrar la baja.');
      });
    } catch(error) {
      // Fixed public error avoids persisting provider payloads, tokens or credentials.
      await this.db.query("UPDATE arm_app.mail_workspace_jobs SET state='failed',last_error='La ejecución no terminó. Reanuda para conciliar los pasos confirmados en Google.',updated_at=now() WHERE request_id=$1 AND state<>'ready'",[id]);
      throw error;
    }
    return {executed:true};
  }

  async invite(id:string,version:number,actor:MailActor) {
    this.workspace.requireAutomation();
    const token=randomBytes(32).toString('hex');
    const p=await this.db.transaction(async client=>{
      await this.owned(client,id,actor,version);
      const job=(await client.query('SELECT * FROM arm_app.mail_workspace_jobs WHERE request_id=$1 FOR UPDATE',[id])).rows[0];
      if (!job || job.state!=='ready' || job.plan.operation!=='create' || job.activated_at) throw new BadRequestException('Esta solicitud no tiene un acceso pendiente de activación.');
      if (job.updated_at && Date.now()-new Date(job.updated_at).getTime()<60000 && job.token_hash) throw new BadRequestException('Espera un minuto antes de enviar otro enlace.');
      await client.query("UPDATE arm_app.mail_workspace_jobs SET token_hash=$2,token_expires_at=now()+interval '24 hours',token_used_at=NULL,invitation_sent_at=NULL,updated_at=now() WHERE request_id=$1",[id,digest(token)]);
      return job.plan as Plan;
    });
    const link=`${this.mailer.settings().origin}/auth/activar-correo#token=${token}`;
    try {
      await this.mailer.sendHtml({to:[p.deliveryEmail!],subject:'Activa tu correo institucional ARM Global',idempotencyKey:`workspace-invite/${id}/${digest(token)}`,
        text:`Tu correo institucional es ${p.email}.\n\nDefine tu contraseña inicial en ${link}\n\nEl enlace vence en 24 horas y solo se puede usar una vez. Luego ingresa a Google y completa el cambio inicial y la verificación en dos pasos. Si no esperabas este correo, contacta a TI.`,
        html:`<div style="font-family:Arial,sans-serif;color:#253341;max-width:520px;margin:auto;padding:28px"><h1 style="font-size:24px">Tu correo institucional</h1><p>${safeText(p.email)}</p><p>Define tu contraseña inicial para acceder a Google Workspace.</p><p><a href="${safeText(link)}" style="display:inline-block;background:#253341;color:white;padding:14px 20px;border-radius:8px;text-decoration:none">Activar mi correo</a></p><p>Este enlace vence en 24 horas y solo se puede usar una vez. Al ingresar a Google completa el cambio inicial y activa la verificación en dos pasos.</p><p>Si no esperabas este correo, contacta a TI.</p></div>`});
    } catch {
      throw new ServiceUnavailableException('No se confirmó el envío. Puedes enviar un nuevo enlace después de un minuto; el anterior quedará invalidado.');
    }
    await this.db.transaction(async client=>{
      await client.query('UPDATE arm_app.mail_workspace_jobs SET invitation_sent_at=now() WHERE request_id=$1 AND token_hash=$2',[id,digest(token)]);
      await this.audit(client,id,actor.sub,'workspace_invited','Enlace de activación enviado al correo de contacto aprobado.');
    });
    return {sent:true};
  }

  async activate(token:string,password:string) {
    this.workspace.requireAutomation();
    if (password.length<12 || password.length>100 || !password.trim()) throw new BadRequestException('Usa una contraseña de 12 a 100 caracteres.');
    // Consume before any external mutation: even ambiguous Google timeouts cannot replay it.
    const job=(await this.db.query(`UPDATE arm_app.mail_workspace_jobs j SET token_used_at=now(),updated_at=now()
      WHERE token_hash=$1 AND token_used_at IS NULL AND token_expires_at>now() AND activated_at IS NULL AND state='ready'
      AND EXISTS(SELECT 1 FROM arm_app.mail_requests r WHERE r.id=j.request_id AND r.status='creating' AND (r.details->>'expiresOn' IS NULL OR r.details->>'expiresOn'>to_char(CURRENT_DATE,'YYYY-MM-DD'))) RETURNING j.*`,[digest(token)])).rows[0];
    if (!job || job.plan.operation!=='create') throw new BadRequestException('El enlace venció o ya se usó. Solicita uno nuevo a TI.');
    try {
      const directory=await this.workspace.directory();
      const user=await directory.user(job.google_id);
      if (!user || user.primaryEmail.toLowerCase()!==job.plan.email || !requestMarker(user,job.request_id)) throw new ForbiddenException();
      await directory.activate(user,password,job.request_id);
    } catch {
      throw new ServiceUnavailableException('No se confirmó la activación. Por seguridad este enlace ya no se puede usar; solicita uno nuevo a TI.');
    }
    await this.db.query('UPDATE arm_app.mail_workspace_jobs SET activated_at=now(),updated_at=now() WHERE request_id=$1',[job.request_id]);
    return {activated:true,email:job.plan.email};
  }

  async complete(id:string,dto:MailActionDto,actor:MailActor) {
    const {version}=dto;
    this.workspace.requireAutomation();
    const job=await this.db.transaction(async client=>{
      await this.owned(client,id,actor,version);
      return (await client.query('SELECT * FROM arm_app.mail_workspace_jobs WHERE request_id=$1',[id])).rows[0];
    });
    if (!job || job.state!=='ready') throw new BadRequestException('Completa la ejecución en Google primero.');
    const directory=await this.workspace.directory();
    const user=await directory.user(job.google_id);
    if (!user || user.primaryEmail.toLowerCase()!==job.plan.email) throw new ConflictException('La cuenta cambió en Google. TI debe revisarla antes de cerrar.');
    assertOrdinaryUser(user);
    if (job.plan.operation==='offboard') {
      if (!user.suspended || !dto.accessRevoked || !dto.note?.trim()) throw new BadRequestException('La cuenta debe estar suspendida y TI debe confirmar la revisión de sesiones, datos, accesos y licencia.');
      return this.mail.action(id,{version,action:'complete',email:job.plan.email,workspaceChecked:true,accessRevoked:true,note:dto.note},actor,true);
    }
    if (!job.activated_at || !user.isEnrolledIn2Sv || !user.isEnforcedIn2Sv || !user.isMailboxSetup || user.suspended) throw new BadRequestException('Falta completar la activación, disponer del buzón y tener MFA inscrito y obligatorio en Google. La solicitud seguirá pendiente.');
    return this.mail.action(id,{version,action:'complete',email:job.plan.email,license:job.plan.license,groups:job.plan.groupEmails.join(', ')||'Ninguno',workspaceChecked:true,mfaConfirmed:true,secureDelivery:true,note:'Cuenta, buzón y MFA verificados mediante Google Workspace. Acceso inicial activado por el destinatario.'},actor,true);
  }
}
