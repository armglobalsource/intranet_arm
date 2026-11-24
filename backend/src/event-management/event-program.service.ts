import { EventRegistrationService, OCCUPYING, codeUses, registrationsOpen, soldByTicket } from './event-registration.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../common/database/database.service';
import { EventCategoryDto, EventDiscountCodeDto, SaveEventProgramDto } from './event-program.dto';
import { assertEventScope, EventActor, eventAccess, validateEventProgram } from './event-program.rules';
import { codeProblem, saleState } from './event-order.rules';

const iso=(v:unknown)=>v==null?null:new Date(v as string).toISOString();
/** Tipo de entrada tal como lo edita el equipo. */
function ticketDto(t:any){
 return {id:t.id,name:String(t.name),currency:String(t.currency),price:Number(t.price),description:t.description??'',capacity:t.capacity==null?null:Number(t.capacity),
  salesStart:iso(t.sales_start),salesEnd:iso(t.sales_end),hidden:!!t.hidden,maxPerOrder:Number(t.max_per_order??10)};
}
/** Tipo de entrada tal como lo ve el público: con cupos restantes y estado de venta. */
function publicTicket(t:any,sold:number){
 const left=t.capacity==null?null:Math.max(Number(t.capacity)-sold,0);
 return {...ticketDto(t),hidden:undefined,remaining:left,soldOut:left===0,sale:saleState(t)};
}
function codeDto(c:any){
 return {id:c.id,code:c.code,kind:c.kind,value:Number(c.value),maxUses:c.max_uses==null?null:Number(c.max_uses),startsAt:iso(c.starts_at),endsAt:iso(c.ends_at),
  ticketTypeIds:c.ticket_type_ids??[],active:!!c.active,uses:Number(c.uses??0),given:Number(c.given??0),createdAt:c.created_at};
}

@Injectable()
export class EventProgramService {
 constructor(private readonly db:DatabaseService,private readonly registrations?:EventRegistrationService) {}
 private async unique<T>(operation:()=>Promise<T>,message='Ese enlace o nombre ya existe. Elige otro.'):Promise<T>{
  try{return await operation();}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException(message);throw e;}
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
   this.db.query('SELECT * FROM arm_app.event_ticket_types WHERE event_id=$1 AND NOT archived ORDER BY position',[row.id]),
   this.db.query(`SELECT a.action,a.version,a.created_at AS "createdAt",concat_ws(' ',u."firstName",u."lastName") AS actor FROM arm_app.event_audit_logs a JOIN arm_app.users u ON u.id=a.actor_id WHERE event_id=$1 ORDER BY a.created_at DESC LIMIT 20`,[row.id]),
  ]);
  return {id:row.id,version:row.version,title:row.title,slug:row.slug,categoryId:row.category_id,campusId:Number(row.campus_id),organizerId:Number(row.organizer_id),startsAt:row.starts_at,endsAt:row.ends_at,status:row.status,registrationStatus:row.registration_status,capacity:row.capacity,details:row.details,campusIds:campuses.rows.map(r=>Number(r.campus_id)),ticketTypes:tickets.rows.map(ticketDto),audit:audit.rows};
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
   await this.saveTickets(db,eventId,dto);
   const version=old?old.version+1:1;
   await db.query('INSERT INTO arm_app.event_audit_logs(event_id,actor_id,action,version) VALUES($1,$2,$3,$4)',[eventId,user.sub,sourceId?`Duplicado de ${sourceId}`:old?`${old.status} → ${dto.status}`:'Creación',version]);
   return {id:eventId,version};
  }));
 }
 /**
  * Los tipos de entrada conservan su ID al editarse (sus ventas y códigos siguen apuntando a ellos).
  * Uno que se quita se borra si nunca se vendió; si tiene entradas, se archiva.
  */
 private async saveTickets(db:PoolClient,eventId:string,dto:SaveEventProgramDto){
  const existing=(await db.query('SELECT id FROM arm_app.event_ticket_types WHERE event_id=$1 AND NOT archived',[eventId])).rows.map(r=>r.id as string);
  const kept=new Set<string>();
  for(const [position,t] of dto.ticketTypes.entries()){
   const values=[t.name.trim(),t.price,t.currency,position,(t.description??'').trim(),t.capacity??null,t.salesStart??null,t.salesEnd??null,!!t.hidden,t.maxPerOrder??10];
   if(t.id&&existing.includes(t.id)){
    kept.add(t.id);
    await db.query('UPDATE arm_app.event_ticket_types SET name=$2,price=$3,currency=$4,position=$5,description=$6,capacity=$7,sales_start=$8,sales_end=$9,hidden=$10,max_per_order=$11 WHERE id=$1',[t.id,...values]);
   }else await db.query('INSERT INTO arm_app.event_ticket_types(event_id,name,price,currency,position,description,capacity,sales_start,sales_end,hidden,max_per_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[eventId,...values]);
  }
  for(const id of existing.filter(x=>!kept.has(x))){
   const used=(await db.query('SELECT 1 FROM arm_app.event_registrations WHERE ticket_type_id=$1 LIMIT 1',[id])).rows.length>0;
   if(used)await db.query('UPDATE arm_app.event_ticket_types SET archived=true,position=position+1000 WHERE id=$1',[id]);
   else await db.query('DELETE FROM arm_app.event_ticket_types WHERE id=$1',[id]);
  }
 }
 async duplicate(user:EventActor,id:string){
  const source=await this.get(user,id);
  const dto={...source,ticketTypes:source.ticketTypes.map(({id:_id,...t})=>t),version:0,title:`${source.title.slice(0,145)} (copia)`,slug:`${source.slug.slice(0,100)}-${randomUUID().slice(0,8)}`,status:'draft',registrationStatus:'pending',startsAt:new Date(source.startsAt).toISOString(),endsAt:new Date(source.endsAt).toISOString()} as SaveEventProgramDto;
  return this.save(user,dto,undefined,id);
 }
 async publicEvent(slug:string){
  const row=(await this.db.query(`SELECT e.id,e.slug,e.title,e.starts_at,e.ends_at,e.status,e.published_at,e.registration_status,e.capacity,e.details,c.name AS campus_name,k.name AS category_name FROM arm_app.event_programs e JOIN arm_app.campuses c ON c.id=e.campus_id LEFT JOIN arm_app.event_categories k ON k.id=e.category_id WHERE e.slug=$1 AND e.published_at IS NOT NULL AND e.status IN ('published','finished','cancelled')`,[slug])).rows[0];
  if(!row)throw new NotFoundException('Este evento no está publicado');
  const [tickets,campuses,codes,sold,occupied]=await Promise.all([
   this.db.query('SELECT * FROM arm_app.event_ticket_types WHERE event_id=$1 AND NOT archived ORDER BY position',[row.id]),
   this.db.query('SELECT c.id,c.name FROM arm_app.event_program_campuses ec JOIN arm_app.campuses c ON c.id=ec.campus_id WHERE ec.event_id=$1 ORDER BY c.name',[row.id]),
   this.db.query('SELECT count(*)::int AS n FROM arm_app.event_discount_codes WHERE event_id=$1 AND active',[row.id]),
   soldByTicket(this.db,row.id),
   this.db.query(`SELECT count(*)::int AS n FROM arm_app.event_registrations WHERE event_id=$1 AND ${OCCUPYING}`,[row.id]),
  ]);
  // Las entradas ocultas solo aparecen al ingresar un código que las incluya.
  const visible=tickets.rows.filter((t:any)=>!t.hidden).map((t:any)=>publicTicket(t,sold.get(t.id)??0));
  return {title:row.title,slug:row.slug,startsAt:row.starts_at,endsAt:row.ends_at,status:row.status,registrationStatus:row.registration_status,capacity:row.capacity,details:row.details,campusName:row.campus_name,categoryName:row.category_name,campuses:campuses.rows.map(c=>c.name),ticketTypes:visible,
   capacityLeft:row.capacity==null?null:Math.max(Number(row.capacity)-Number(occupied.rows[0]?.n??0),0),codesEnabled:Number(codes.rows[0]?.n??0)>0,
   paymentMode:this.registrations?.paymentMode()??'disabled',registrationEnabled:registrationsOpen(row),campusOptions:campuses.rows.map(c=>({id:Number(c.id),name:c.name}))};
 }
 /** Catálogo público: eventos publicados que aún no terminan, con su rango de precios y si quedan cupos. */
 async publicList(){
  const rows=(await this.db.query(`SELECT e.id,e.slug,e.title,e.starts_at,e.ends_at,e.capacity,e.registration_status,e.status,e.published_at,e.details,c.name AS campus_name,k.name AS category_name,
   (SELECT array_agg(pc.name ORDER BY pc.name) FROM arm_app.event_program_campuses ec JOIN arm_app.campuses pc ON pc.id=ec.campus_id WHERE ec.event_id=e.id) AS campuses,
   (SELECT min(t.price) FROM arm_app.event_ticket_types t WHERE t.event_id=e.id AND NOT t.archived AND NOT t.hidden AND t.price>0) AS min_price,
   (SELECT max(t.price) FROM arm_app.event_ticket_types t WHERE t.event_id=e.id AND NOT t.archived AND NOT t.hidden AND t.price>0) AS max_price,
   (SELECT count(*)::int FROM arm_app.event_registrations r WHERE r.event_id=e.id AND ${OCCUPYING}) AS occupied
   FROM arm_app.event_programs e JOIN arm_app.campuses c ON c.id=e.campus_id LEFT JOIN arm_app.event_categories k ON k.id=e.category_id
   WHERE e.status='published' AND e.published_at IS NOT NULL AND e.ends_at>now() ORDER BY e.starts_at,e.id LIMIT 200`,[])).rows;
  return rows.map((r:any)=>{const d=r.details??{};const left=r.capacity==null?null:Math.max(Number(r.capacity)-Number(r.occupied),0);
   return {slug:r.slug,title:r.title,startsAt:r.starts_at,endsAt:r.ends_at,timezone:d.timezone,summary:d.summary,bannerUrl:d.bannerUrl,color:d.color,modality:d.modality,location:d.location,
    campusName:r.campus_name,categoryName:r.category_name,campuses:r.campuses??[],pricing:d.pricing,minPrice:r.min_price==null?null:Number(r.min_price),maxPrice:r.max_price==null?null:Number(r.max_price),
    registrationEnabled:registrationsOpen(r),soldOut:left===0&&!d.waitlist,capacityLeft:left};});
 }
 /** Comprueba un código en la portada: el descuento que da y las entradas ocultas que desbloquea. */
 async lookupCode(slug:string,input:string){
  const event=(await this.db.query(`SELECT id FROM arm_app.event_programs WHERE slug=$1 AND published_at IS NOT NULL AND status='published'`,[slug])).rows[0];
  if(!event)throw new NotFoundException('Este evento no está publicado');
  const code:any=(await this.db.query('SELECT * FROM arm_app.event_discount_codes WHERE event_id=$1 AND code=$2',[event.id,input.trim().toUpperCase()])).rows[0];
  const problem=codeProblem(code,code?await codeUses(this.db,code.id):0);
  if(problem)throw new BadRequestException(problem);
  const sold=await soldByTicket(this.db,event.id);
  const unlocked=code.ticket_type_ids?.length?(await this.db.query('SELECT * FROM arm_app.event_ticket_types WHERE event_id=$1 AND id=ANY($2::uuid[]) AND hidden AND NOT archived ORDER BY position',[event.id,code.ticket_type_ids])).rows:[];
  return {code:code.code,kind:code.kind,value:Number(code.value),ticketTypeIds:code.ticket_type_ids??[],unlockedTickets:unlocked.map((t:any)=>publicTicket(t,sold.get(t.id)??0))};
 }

 // ── Códigos de descuento (equipo organizador) ──
 private async codeEvent(user:EventActor,eventId:string){
  eventAccess(user);const row=await this.read(this.db,eventId);assertEventScope(user,row);return row;
 }
 async codes(user:EventActor,eventId:string){
  await this.codeEvent(user,eventId);
  const rows=(await this.db.query(`SELECT c.*,(SELECT count(*)::int FROM arm_app.event_orders o WHERE o.discount_code_id=c.id AND (o.status='confirmed' OR (o.status='pending_payment' AND o.expires_at>now()))) AS uses,
   (SELECT coalesce(sum(o.discount),0) FROM arm_app.event_orders o WHERE o.discount_code_id=c.id AND o.status='confirmed') AS given FROM arm_app.event_discount_codes c WHERE c.event_id=$1 ORDER BY c.created_at DESC`,[eventId])).rows;
  return rows.map(codeDto);
 }
 async saveCode(user:EventActor,eventId:string,dto:EventDiscountCodeDto,codeId?:string){
  await this.codeEvent(user,eventId);
  if(dto.kind==='percent'&&dto.value>100)throw new BadRequestException('Un porcentaje no puede superar 100');
  if(dto.startsAt&&dto.endsAt&&Date.parse(dto.startsAt)>=Date.parse(dto.endsAt))throw new BadRequestException('La vigencia debe empezar antes de terminar');
  if(dto.ticketTypeIds.length){
   const n=(await this.db.query('SELECT count(*)::int AS n FROM arm_app.event_ticket_types WHERE event_id=$1 AND id=ANY($2::uuid[])',[eventId,dto.ticketTypeIds])).rows[0].n;
   if(n!==dto.ticketTypeIds.length)throw new BadRequestException('Elige entradas de este evento');
  }
  const values=[dto.code.trim().toUpperCase(),dto.kind,dto.value,dto.maxUses??null,dto.startsAt??null,dto.endsAt??null,dto.ticketTypeIds,dto.active];
  return this.unique(async()=>{
   const row=codeId
    ?(await this.db.query('UPDATE arm_app.event_discount_codes SET code=$3,kind=$4,value=$5,max_uses=$6,starts_at=$7,ends_at=$8,ticket_type_ids=$9,active=$10,updated_at=now() WHERE id=$1 AND event_id=$2 RETURNING *',[codeId,eventId,...values])).rows[0]
    :(await this.db.query('INSERT INTO arm_app.event_discount_codes(event_id,code,kind,value,max_uses,starts_at,ends_at,ticket_type_ids,active,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[eventId,...values,user.sub])).rows[0];
   if(!row)throw new NotFoundException('Código no encontrado');
   return codeDto({...row,uses:0,given:0});
  },'Ese código ya existe en este evento.');
 }
}
