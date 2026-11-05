import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../common/database/database.service';
import { insertIdentity } from '../common/database/identity-sql';
import { hasPermission } from '../common/permissions';
import { CreateMailRequestDto, MailActionDto, ReviseMailRequestDto } from './mail.dto';
import { approvesMail, canReadRequest, corporateEmail, DOMAINS, identityKey, MailActor, managesMail, nextStatus, validateDetails } from './mail.rules';

@Injectable()
export class InstitutionalMailService {
  constructor(private readonly db: DatabaseService) {}

  async options(user: MailActor) {
    const rows = (await this.db.query(`SELECT u.id, concat_ws(' ',u."firstName",u."lastName") name, r.permissions
      FROM arm_app.users u JOIN arm_app.roles r ON r.id=u."roleId"
      WHERE u.status='active' AND r."isActive" IS DISTINCT FROM false ORDER BY u."firstName"`)).rows;
    const dueReviews = managesMail(user) ? Number((await this.db.query('SELECT count(*) total FROM arm_app.mail_accounts WHERE active AND review_on<=CURRENT_DATE')).rows[0].total) : 0;
    return { dueReviews, canManage: managesMail(user), canApprove: approvesMail(user), managers: rows
      .filter(r => Number(r.id) !== user.sub && hasPermission(r.permissions ?? [],'institutional-mail:approve'))
      .map(r => ({id: Number(r.id), name: r.name})), domains: DOMAINS };
  }
  async list(user: MailActor, view: string, status: string, page: number) {
    let clause = 'requester_id=$1';
    if (view === 'approvals') {
      if (!approvesMail(user)) throw new ForbiddenException();
      clause = 'manager_id=$1';
    } else if (view === 'it') {
      if (!managesMail(user)) throw new ForbiddenException();
      clause = '$1::bigint IS NOT NULL';
    } else if (view !== 'mine') throw new BadRequestException('Bandeja inválida.');
    const result = await this.db.query(`SELECT id,status,version,created_at,updated_at,
      details->>'name' name,details->>'company' company,details->>'operation' operation,details->>'kind' kind,
      details->>'domain' domain, count(*) OVER() AS total
      FROM arm_app.mail_requests WHERE ${clause} AND ($2='' OR status=$2)
      ORDER BY created_at DESC,id LIMIT 30 OFFSET $3`, [user.sub,status,(page-1)*30]);
    return {items:result.rows,total:Number(result.rows[0]?.total ?? 0),page};
  }
  async detail(id: string, user: MailActor) {
    const r = (await this.db.query(`SELECT r.*, concat_ws(' ',u."firstName",u."lastName") requester_name,
      concat_ws(' ',m."firstName",m."lastName") manager_name, concat_ws(' ',a."firstName",a."lastName") assignee_name
      FROM arm_app.mail_requests r JOIN arm_app.users u ON u.id=r.requester_id JOIN arm_app.users m ON m.id=r.manager_id
      LEFT JOIN arm_app.users a ON a.id=r.assigned_to WHERE r.id=$1`,[id])).rows[0];
    if (!r || !canReadRequest(r,user)) throw new NotFoundException('Solicitud no encontrada.');
    const events = (await this.db.query(`SELECT e.id,e.action,e.note,e.created_at,e.snapshot,
      concat_ws(' ',u."firstName",u."lastName") actor_name
      FROM arm_app.mail_request_events e JOIN arm_app.users u ON u.id=e.actor_id
      WHERE e.request_id=$1 ORDER BY e.created_at,e.id`,[id])).rows;
    return {...r,events,canApprove: Number(r.manager_id)===user.sub && approvesMail(user) && Number(r.requester_id)!==user.sub,
      canRevise:Number(r.requester_id)===user.sub && r.status==='observed',canManage:managesMail(user)};
  }
  private async manager(client: PoolClient, managerId: number, requesterId: number) {
    if (managerId === requesterId) throw new BadRequestException('La jefatura debe ser otra persona.');
    const r = (await client.query(`SELECT r.permissions FROM arm_app.users u JOIN arm_app.roles r ON r.id=u."roleId"
      WHERE u.id=$1 AND u.status='active' AND r."isActive" IS DISTINCT FROM false`,[managerId])).rows[0];
    if (!r || !hasPermission(r.permissions ?? [],'institutional-mail:approve')) throw new BadRequestException('Selecciona una jefatura habilitada para aprobar.');
  }
  private async event(client: PoolClient, r: any, user: MailActor, action: string, note: string, snapshot: any = {}) {
    await client.query(`INSERT INTO arm_app.mail_request_events(request_id,actor_id,action,note,snapshot) VALUES($1,$2,$3,$4,$5)`,[r.id,user.sub,action,note,JSON.stringify(snapshot)]);
    const recipients = new Set<number>([Number(r.requester_id)]);
    if (r.status === 'approval') recipients.add(Number(r.manager_id));
    if (['approval','validation','creating'].includes(r.status)) {
      const candidates = (await client.query(`SELECT u.id,r.permissions FROM arm_app.users u JOIN arm_app.roles r ON r.id=u."roleId"
        WHERE u.status='active' AND r."isActive" IS DISTINCT FROM false`)).rows;
      candidates.filter(x => hasPermission(x.permissions ?? [],'institutional-mail:manage')).forEach(x => recipients.add(Number(x.id)));
    }
    for (const userId of recipients) if (userId!==user.sub) await insertIdentity(client,'notifications',{
      userId,title:'Correos y accesos · Solicitud actualizada',body:'Revisa el estado y las acciones pendientes en el ecosistema.',
      link:`/dashboard/correos?request=${r.id}`,channel:'in_app',read:false,createdAt:new Date(),updatedAt:new Date(),
    });
  }
  async create(dto: CreateMailRequestDto,user: MailActor) {
    const details = validateDetails(dto.details);
    return this.db.transaction(async client => {
      await this.manager(client,dto.managerId,user.sub);
      const r = (await client.query(`INSERT INTO arm_app.mail_requests(requester_id,manager_id,details) VALUES($1,$2,$3) RETURNING *`,[user.sub,dto.managerId,JSON.stringify(details)])).rows[0];
      await this.event(client,r,user,'submitted','Solicitud enviada a jefatura.',details);
      return {id:r.id};
    });
  }
  async revise(id: string,dto: ReviseMailRequestDto,user: MailActor) {
    const details = validateDetails(dto.details);
    return this.db.transaction(async client => {
      const r = await this.lock(client,id,user,dto.version);
      if (Number(r.requester_id)!==user.sub || r.status!=='observed') throw new ForbiddenException('Solo el solicitante puede corregir una solicitud observada.');
      await this.manager(client,dto.managerId,user.sub);
      await client.query(`UPDATE arm_app.mail_requests SET details=$2,manager_id=$3,status='approval',assigned_to=NULL,version=version+1,updated_at=now() WHERE id=$1`,[id,JSON.stringify(details),dto.managerId]);
      await this.event(client,{...r,manager_id:dto.managerId,status:'approval'},user,'resubmitted','Datos corregidos. Se requiere nueva aprobación.',details);
      return {id};
    });
  }
  private async lock(client: PoolClient,id: string,user: MailActor,version: number) {
    const r = (await client.query('SELECT * FROM arm_app.mail_requests WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if (!r || !canReadRequest(r,user)) throw new NotFoundException('Solicitud no encontrada.');
    if (r.version!==version) throw new ConflictException('La solicitud cambió. Actualiza la vista antes de continuar.');
    return r;
  }
  async action(id: string,dto: MailActionDto,user: MailActor) {
    try {
      return await this.db.transaction(async client => {
        const r = await this.lock(client,id,user,dto.version);
        const status = nextStatus(r,user,dto.action,dto.note);
        if (dto.action==='start' && !dto.workspaceChecked) throw new BadRequestException('Confirma la validación de dominio, identidad, licencia y duplicados en Google Workspace.');
        if (dto.action==='complete') {
          if (Number(r.assigned_to)!==user.sub) throw new ForbiddenException('La entrega debe registrarla el responsable de TI que tomó la solicitud.');
          await this.fulfill(client,r,dto);
        }
        await client.query(`UPDATE arm_app.mail_requests SET status=$2,version=version+1,updated_at=now(),
          assigned_to=CASE WHEN $3='start' THEN $4 ELSE assigned_to END WHERE id=$1`,[id,status,dto.action,user.sub]);
        await this.event(client,{...r,status},user,dto.action,dto.note?.trim() ?? '',dto.action==='complete' ? {
          email:dto.email,license:dto.license,groups:dto.groups,workspaceChecked:dto.workspaceChecked,
          mfaConfirmed:dto.mfaConfirmed,secureDelivery:dto.secureDelivery,accessRevoked:dto.accessRevoked,
        } : {workspaceChecked:dto.workspaceChecked});
        return {id,status};
      });
    } catch(error) {
      if ((error as any)?.code==='23505') throw new ConflictException('El correo o la cuenta principal de esta persona ya están registrados. Revisa los duplicados y utiliza un alias cuando corresponda.');
      throw error;
    }
  }
  private async fulfill(client: PoolClient,r: any,dto: MailActionDto) {
    const d=r.details;
    if (!dto.workspaceChecked) throw new BadRequestException('Confirma la operación en Google Workspace.');
    // Serialize all changes to an identity, including cross-domain principal/alias operations.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[identityKey(d.employeeId)]);
    const email=(dto.email ?? '').trim().toLowerCase();
    if (!corporateEmail(email) || !email.endsWith('@'+DOMAINS[d.company as keyof typeof DOMAINS])) throw new BadRequestException('El correo final debe usar el dominio asignado a la empresa.');
    if (d.operation==='offboard' && email!==d.existingEmail) throw new BadRequestException('El correo final debe coincidir con la cuenta que se da de baja.');
    if (d.operation!=='offboard' && (!dto.mfaConfirmed || !dto.secureDelivery)) throw new BadRequestException('Confirma MFA y la entrega por un canal seguro.');
    if (d.operation!=='offboard' && !dto.license?.trim()) throw new BadRequestException('Registra la licencia; para alias indica «Sin licencia adicional».');
    if (d.operation==='offboard' && (!dto.accessRevoked || !dto.note?.trim())) throw new BadRequestException('Confirma la revocación de accesos y registra el resultado de la baja.');
    if (d.operation==='offboard' && d.startsOn>new Date().toISOString().slice(0,10)) throw new BadRequestException('La fecha efectiva de baja todavía no llega. Mantén la solicitud en ejecución.');
    if (d.operation!=='offboard' && d.expiresOn && d.expiresOn<=new Date().toISOString().slice(0,10)) throw new BadRequestException('La fecha de vencimiento ya pasó. Devuelve la solicitud para corregirla.');
    const existing=(await client.query('SELECT * FROM arm_app.mail_accounts WHERE email=$1 FOR UPDATE',[d.operation==='create'?email:d.existingEmail])).rows[0];
    if (existing && existing.identity_key!==identityKey(d.employeeId)) throw new ConflictException('El correo está asociado a otra identidad. Revisa el ID antes de continuar.');
    if (d.operation==='create' && existing) throw new ConflictException('Este correo ya figura en el inventario.');
    if (d.operation==='change' && existing && existing.kind!==d.kind) throw new BadRequestException('El tipo de cuenta debe coincidir con el inventario. Solicita una corrección.');
    if (d.operation==='offboard') {
      if (existing) await client.query(`UPDATE arm_app.mail_accounts SET active=false,last_request_id=$2,updated_at=now() WHERE id=$1 OR primary_id=$1`,[existing.id,r.id]);
      else await client.query(`INSERT INTO arm_app.mail_accounts(email,identity_key,owner_name,kind,active,license,last_request_id)
        VALUES($1,$2,$3,'collaborator',false,'Baja de cuenta previa',$4)`,[email,identityKey(d.employeeId),d.name,r.id]);
      return;
    }
    let primaryId: string|null = null;
    if (d.kind==='alias') {
      if (d.operation==='change') {
        if (!existing?.primary_id) throw new BadRequestException('Para cambiar un alias primero debe estar registrado en el inventario.');
        primaryId=existing.primary_id;
        const parent=(await client.query('SELECT active FROM arm_app.mail_accounts WHERE id=$1 FOR UPDATE',[primaryId])).rows[0];
        if (!parent?.active) throw new BadRequestException('La cuenta principal del alias no está activa.');
      } else {
        let primary=(await client.query('SELECT * FROM arm_app.mail_accounts WHERE email=$1 FOR UPDATE',[d.existingEmail])).rows[0];
        if (primary && (!primary.active || primary.primary_id || primary.identity_key!==identityKey(d.employeeId))) throw new BadRequestException('La cuenta principal debe estar activa y pertenecer a la misma persona.');
        if (!primary) primary=(await client.query(`INSERT INTO arm_app.mail_accounts(email,identity_key,owner_name,kind,license,last_request_id)
          VALUES($1,$2,$3,'collaborator','Existente; validada por TI',$4) RETURNING *`,[d.existingEmail,identityKey(d.employeeId),d.name,r.id])).rows[0];
        primaryId=primary.id;
      }
    } else if (existing?.primary_id) throw new BadRequestException('No puedes convertir un alias en una cuenta con licencia.');
    if (existing) {
      await client.query(`UPDATE arm_app.mail_accounts SET owner_name=$2,kind=$3,expires_on=$4,license=$5,groups_text=$6,
        active=true,last_request_id=$7,updated_at=now(),email=$8 WHERE id=$1`,[existing.id,d.responsible || d.name,d.kind,d.expiresOn || null,
        d.kind==='alias'?'Sin licencia adicional':dto.license,dto.groups ?? '',r.id,email]);
    } else await client.query(`INSERT INTO arm_app.mail_accounts(email,primary_id,identity_key,owner_name,kind,expires_on,license,groups_text,last_request_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[email,primaryId,identityKey(d.employeeId),d.responsible || d.name,d.kind,d.expiresOn || null,
      d.kind==='alias'?'Sin licencia adicional':dto.license,dto.groups ?? '',r.id]);
  }
  async accounts(user: MailActor,due: boolean,page: number) {
    if (!managesMail(user)) throw new ForbiddenException();
    return (await this.db.query(`SELECT a.*,p.email primary_email,r.details request_details,count(*) OVER() total FROM arm_app.mail_accounts a
      JOIN arm_app.mail_requests r ON r.id=a.last_request_id
      LEFT JOIN arm_app.mail_accounts p ON p.id=a.primary_id WHERE (NOT $1 OR (a.active AND a.review_on<=CURRENT_DATE))
      ORDER BY a.active DESC,a.expires_on ASC NULLS LAST,a.email LIMIT 30 OFFSET $2`,[due,(page-1)*30])).rows;
  }
}
