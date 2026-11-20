import { EventRegistrationService, registrationsOpen } from './event-registration.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../common/database/database.service';
import { EventCategoryDto, SaveEventProgramDto } from './event-program.dto';
import { assertEventScope, EventActor, eventAccess, validateEventProgram } from './event-program.rules';

@Injectable()
export class EventProgramService {
 constructor(private readonly db:DatabaseService,private readonly registrations?:EventRegistrationService) {}
 private async unique<T>(operation:()=>Promise<T>):Promise<T>{
  try{return await operation();}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException('Ese enlace o nombre ya existe. Elige otro.');throw e;}
 }
 async options(user:EventActor){
  const access=eventAccess(user);
  const [categories,campuses,organizers]=await Promise.all([
   this.db.query('SELECT id,name,active FROM arm_app.event_categories ORDER BY name'),
   this.db.query('SELECT id,name,country FROM arm_app.campuses WHERE "isActive"=true ORDER BY name'),
   this.db.query(`SELECT id,concat_ws(' ',"firstName","lastName") AS name FROM arm_app.users WHERE status='active' AND ($1::boolean OR "campusId"=$2 OR id=$3) ORDER BY name`,[access.global,user.campusId??null,user.sub]),
  ]);
  return {paymentMode:this.registrations?.paymentMode()??'disabled',categories:categories.rows,campuses:campuses.rows.map(r=>({...r,id:Number(r.id)})),organizers:organizers.rows.map(r=>({...r,id:Number(r.id)})),access};
 }
 async category(user:EventActor,dto:EventCategoryDto,id?:string){
  if(!eventAccess(user).global)throw new ForbiddenException('Solo administración global puede configurar categorías');
  if(!dto.name.trim())throw new BadRequestException('Escribe el nombre de la categoría');
  return this.unique(async()=>{
   const result=id?await this.db.query('UPDATE arm_app.event_categories SET name=$2,active=$3 WHERE id=$1 RETURNING *',[id,dto.name.trim(),dto.active]):await this.db.query('INSERT INTO arm_app.event_categories(name,active) VALUES($1,$2) RETURNING *',[dto.name.trim(),dto.active]);
   if(!result.rows[0])throw new NotFoundException('Categoría no encontrada');return result.rows[0];
  });
 }
 async list(user:EventActor){
  const a=eventAccess(user);
  return (await this.db.query(`SELECT e.id,e.slug,e.title,e.status,e.registration_status AS "registrationStatus",e.starts_at AS "startsAt",e.ends_at AS "endsAt",e.version,e.campus_id AS "campusId",c.name AS "campusName",c.country,k.name AS "categoryName",e.details->>'bannerUrl' AS "bannerUrl" FROM arm_app.event_programs e JOIN arm_app.campuses c ON c.id=e.campus_id LEFT JOIN arm_app.event_categories k ON k.id=e.category_id WHERE ($1::boolean OR ($2::boolean AND e.campus_id=$3) OR ($4::boolean AND e.organizer_id=$5)) ORDER BY e.starts_at DESC,e.id`,[a.global,a.campus,user.campusId??null,a.assigned,user.sub])).rows;
 }
 private async read(db:{query:(sql:string,values:unknown[])=>Promise<{rows:any[]}>},id:string,lock=false){
  const row=(await db.query(`SELECT * FROM arm_app.event_programs WHERE id=$1${lock?' FOR UPDATE':''}`,[id])).rows[0];
  if(!row)throw new NotFoundException('Evento no encontrado');return row;
 }
 private async expand(row:any){
  const [campuses,tickets,audit]=await Promise.all([
   this.db.query('SELECT campus_id FROM arm_app.event_program_campuses WHERE event_id=$1 ORDER BY campus_id',[row.id]),
   this.db.query('SELECT id,name,price,currency FROM arm_app.event_ticket_types WHERE event_id=$1 ORDER BY position',[row.id]),
   this.db.query(`SELECT a.action,a.version,a.created_at AS "createdAt",concat_ws(' ',u."firstName",u."lastName") AS actor FROM arm_app.event_audit_logs a JOIN arm_app.users u ON u.id=a.actor_id WHERE event_id=$1 ORDER BY a.created_at DESC LIMIT 20`,[row.id]),
  ]);
  return {id:row.id,version:row.version,title:row.title,slug:row.slug,categoryId:row.category_id,campusId:Number(row.campus_id),organizerId:Number(row.organizer_id),startsAt:row.starts_at,endsAt:row.ends_at,status:row.status,registrationStatus:row.registration_status,capacity:row.capacity,details:row.details,campusIds:campuses.rows.map(r=>Number(r.campus_id)),ticketTypes:tickets.rows.map(t=>({name:String(t.name),currency:String(t.currency),price:Number(t.price)})),audit:audit.rows};
 }
 async get(user:EventActor,id:string){eventAccess(user);const row=await this.read(this.db,id);assertEventScope(user,row);return this.expand(row);}
 private async references(db:PoolClient,dto:SaveEventProgramDto,old?:any){
  const ids=[...new Set([dto.campusId,...dto.campusIds])];
  if((await db.query('SELECT id FROM arm_app.campuses WHERE id=ANY($1::bigint[]) AND "isActive"=true',[ids])).rows.length!==ids.length)throw new BadRequestException('Selecciona campus activos válidos');
  if(!(await db.query(`SELECT id FROM arm_app.users WHERE id=$1 AND status='active'`,[dto.organizerId])).rowCount)throw new BadRequestException('El responsable debe ser un usuario activo');
  if(dto.categoryId&&!(await db.query('SELECT id FROM arm_app.event_categories WHERE id=$1 AND (active OR id=$2)',[dto.categoryId,old?.category_id??null])).rowCount)throw new BadRequestException('Selecciona una categoría activa');
 }
 async save(user:EventActor,dto:SaveEventProgramDto,id?:string,sourceId?:string){
  const a=eventAccess(user);validateEventProgram(dto);
  if(dto.registrationStatus==='open')this.registrations?.assertConfigured(dto.details.pricing);
  return this.unique(()=>this.db.transaction(async db=>{
   const old=id?await this.read(db,id,true):undefined;
   if(old){assertEventScope(user,old);if(old.version!==dto.version)throw new ConflictException('Otra persona actualizó el evento. Recarga antes de guardar.');}
   else if(!a.global&&!(a.campus&&Number(user.campusId)===dto.campusId))throw new ForbiddenException('No puedes crear eventos para este campus');
   if(!a.global){
    if(old&&Number(old.campus_id)!==dto.campusId)throw new ForbiddenException('Solo administración global puede trasladar un evento');
    const campusManager=a.campus&&Number(user.campusId)===dto.campusId;
    if(!campusManager&&old&&Number(old.organizer_id)!==dto.organizerId)throw new ForbiddenException('No puedes reasignar este evento');
    if(campusManager&&!(await db.query('SELECT id FROM arm_app.users WHERE id=$1 AND "campusId"=$2',[dto.organizerId,dto.campusId])).rowCount)throw new ForbiddenException('Selecciona un responsable de tu campus');
   }
   await this.references(db,dto,old);
   if(old&&dto.capacity!=null){
    const occupied=Number((await db.query("SELECT count(*) FROM arm_app.event_registrations WHERE event_id=$1 AND (status='confirmed' OR (status='pending_payment' AND expires_at>now()))",[id])).rows[0]?.count??0);
    if(dto.capacity<occupied)throw new BadRequestException('La capacidad no puede ser menor que los cupos ya confirmados o reservados');
   }
   if(old&&old.published_at&&old.slug!==dto.slug)throw new BadRequestException('El enlace de un evento publicado no puede cambiar');
   const eventId=id??randomUUID();
   const values=[eventId,dto.title.trim(),dto.slug,dto.categoryId??null,dto.campusId,dto.organizerId,dto.startsAt,dto.endsAt,dto.status,dto.registrationStatus,dto.capacity??null,JSON.stringify(dto.details)];
   if(old)await db.query(`UPDATE arm_app.event_programs SET title=$2,slug=$3,category_id=$4,campus_id=$5,organizer_id=$6,starts_at=$7,ends_at=$8,status=$9,registration_status=$10,capacity=$11,details=$12,version=version+1,updated_at=now() WHERE id=$1`,values);
   else await db.query(`INSERT INTO arm_app.event_programs(id,title,slug,category_id,campus_id,organizer_id,starts_at,ends_at,status,registration_status,capacity,details,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[...values,user.sub]);
   if(dto.status==='published')await db.query('UPDATE arm_app.event_programs SET published_at=coalesce(published_at,now()) WHERE id=$1',[eventId]);
   await db.query('DELETE FROM arm_app.event_program_campuses WHERE event_id=$1',[eventId]);
   for(const campusId of dto.campusIds)await db.query('INSERT INTO arm_app.event_program_campuses(event_id,campus_id) VALUES($1,$2)',[eventId,campusId]);
   await db.query('DELETE FROM arm_app.event_ticket_types WHERE event_id=$1',[eventId]);
   for(const [position,t] of dto.ticketTypes.entries())await db.query('INSERT INTO arm_app.event_ticket_types(event_id,name,price,currency,position) VALUES($1,$2,$3,$4,$5)',[eventId,t.name.trim(),t.price,t.currency,position]);
   const version=old?old.version+1:1;
   await db.query('INSERT INTO arm_app.event_audit_logs(event_id,actor_id,action,version) VALUES($1,$2,$3,$4)',[eventId,user.sub,sourceId?`Duplicado de ${sourceId}`:old?`${old.status} → ${dto.status}`:'Creación',version]);
   return {id:eventId,version};
  }));
 }
 async duplicate(user:EventActor,id:string){
  const source=await this.get(user,id);
  const dto={...source,version:0,title:`${source.title.slice(0,145)} (copia)`,slug:`${source.slug.slice(0,100)}-${randomUUID().slice(0,8)}`,status:'draft',registrationStatus:'pending',startsAt:new Date(source.startsAt).toISOString(),endsAt:new Date(source.endsAt).toISOString()} as SaveEventProgramDto;
  return this.save(user,dto,undefined,id);
 }
 async publicEvent(slug:string){
  const row=(await this.db.query(`SELECT e.id,e.slug,e.title,e.starts_at,e.ends_at,e.status,e.published_at,e.registration_status,e.capacity,e.details,c.name AS campus_name,k.name AS category_name FROM arm_app.event_programs e JOIN arm_app.campuses c ON c.id=e.campus_id LEFT JOIN arm_app.event_categories k ON k.id=e.category_id WHERE e.slug=$1 AND e.published_at IS NOT NULL AND e.status IN ('published','finished','cancelled')`,[slug])).rows[0];
  if(!row)throw new NotFoundException('Este evento no está publicado');
  const [tickets,campuses]=await Promise.all([
   this.db.query('SELECT id,name,price,currency FROM arm_app.event_ticket_types WHERE event_id=$1 ORDER BY position',[row.id]),
   this.db.query('SELECT c.id,c.name FROM arm_app.event_program_campuses ec JOIN arm_app.campuses c ON c.id=ec.campus_id WHERE ec.event_id=$1 ORDER BY c.name',[row.id]),
  ]);
  return {title:row.title,slug:row.slug,startsAt:row.starts_at,endsAt:row.ends_at,status:row.status,registrationStatus:row.registration_status,capacity:row.capacity,details:row.details,campusName:row.campus_name,categoryName:row.category_name,campuses:campuses.rows.map(c=>c.name),ticketTypes:tickets.rows.map(t=>({...t,price:Number(t.price)})),paymentMode:this.registrations?.paymentMode()??'disabled',registrationEnabled:registrationsOpen(row),campusOptions:campuses.rows.map(c=>({id:Number(c.id),name:c.name}))};
 }
}
