import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { hasPermission } from '../common/permissions';
import { assertEventScope, EventActor } from './event-program.rules';
import { EventRegistrationService } from './event-registration.service';
import { ManualRegistrationDto } from './event-attendance.dto';

// Día del evento: lista de inscritos, ingreso con QR o a mano, y acciones del equipo organizador.
// Quien administra el evento puede hacerlo todo; quien solo tiene «eventos:checkin» registra
// ingresos en los eventos de su campus (sede o campus participante), sin modificar inscripciones.

const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
export type CheckInResult='ok'|'already'|'invalid'|'not_found';
const NOT_VALID:Record<string,string>={
 pending_payment:'El pago de esta entrada no está confirmado.',
 expired:'La reserva venció sin pago. No tiene entrada.',
 waitlisted:'Está en lista de espera: todavía no tiene entrada.',
 payment_review:'El pago de esta entrada está en revisión.',
 cancelled:'Esta inscripción fue anulada.',
};
// Cada fila es una entrada; el pago, el código y el envío del correo son de su compra.
const ATTENDEE_SQL=`SELECT r.id,r.participant,r.email,r.campus_id AS "campusId",c.name AS "campusName",r.snapshot->>'ticketName' AS "ticketName",r.ticket_type_id AS "ticketTypeId",
 CASE WHEN r.status='pending_payment' AND r.expires_at<=now() THEN 'expired' ELSE r.status END AS status,r.amount,r.currency,coalesce(o.payment_id,r.payment_id) AS "paymentId",
 (o.amount>0 AND coalesce(o.snapshot->>'paymentMode','test')='test') AS "testPayment",r.source,r.note,r.created_at AS "createdAt",r.answers,
 r.order_id AS "orderId",r.ticket_code AS "ticketCode",r.transferred_at AS "transferredAt",o.email AS "buyerEmail",concat_ws(' ',o.buyer->>'firstName',o.buyer->>'lastName') AS "buyerName",o.snapshot->>'code' AS "discountCode",
 r.checked_in_at AS "checkedInAt",nullif(concat_ws(' ',ci."firstName",ci."lastName"),'') AS "checkedInBy",
 nullif(concat_ws(' ',cb."firstName",cb."lastName"),'') AS "createdBy",(CASE WHEN o.status='confirmed' THEN o.confirmation_sent_at ELSE o.email_sent_at END) IS NOT NULL AS "emailSent"
 FROM arm_app.event_registrations r JOIN arm_app.event_orders o ON o.id=r.order_id JOIN arm_app.campuses c ON c.id=r.campus_id
 LEFT JOIN arm_app.users ci ON ci.id=r.checked_in_by LEFT JOIN arm_app.users cb ON cb.id=r.created_by`;

function attendee(r:any){
 const {participant:p,...rest}=r;
 return {...rest,firstName:p?.firstName??'',lastName:p?.lastName??'',phone:p?.phone??'',age:p?.age??null,amount:Number(r.amount),answers:r.answers??{}};
}

@Injectable()
export class EventAttendanceService {
 constructor(private readonly db:DatabaseService,private readonly registrations:EventRegistrationService){}

 /** Carga el evento y comprueba el ámbito: `manage` para modificar inscripciones, `door` para la puerta. */
 private async event(user:EventActor,id:string,mode:'manage'|'door'){
  const event:any=(await this.db.query('SELECT * FROM arm_app.event_programs WHERE id=$1',[id])).rows[0];
  if(!event)throw new NotFoundException('Evento no encontrado');
  try{assertEventScope(user,event);return {event,manage:true};}
  catch(err){
   if(mode==='manage'||!hasPermission(user.permissions??[],'eventos:checkin'))throw err;
   if(user.campusId==null||!(await this.campusTakesPart(id,event,user.campusId)))throw new ForbiddenException('Este evento no es de tu campus');
   return {event,manage:false};
  }
 }
 private async campusTakesPart(eventId:string,event:any,campusId:number){
  if(Number(event.campus_id)===Number(campusId))return true;
  return (await this.db.query('SELECT 1 FROM arm_app.event_program_campuses WHERE event_id=$1 AND campus_id=$2',[eventId,campusId])).rows.length>0;
 }
 private async counts(eventId:string){
  const r=(await this.db.query(`SELECT count(*) FILTER (WHERE status='confirmed') AS confirmed,count(*) FILTER (WHERE status='confirmed' AND checked_in_at IS NOT NULL) AS "checkedIn" FROM arm_app.event_registrations WHERE event_id=$1`,[eventId])).rows[0];
  return {confirmed:Number(r?.confirmed??0),checkedIn:Number(r?.checkedIn??0)};
 }
 private async one(eventId:string,id:string){
  const r=(await this.db.query(`${ATTENDEE_SQL} WHERE r.event_id=$1 AND r.id=$2`,[eventId,id])).rows[0];
  return r?attendee(r):null;
 }

 /** Eventos publicados que terminan desde ayer en adelante, para elegir en qué puerta trabajar. */
 async doorEvents(user:EventActor){
  const perms=user.permissions??[];
  const global=hasPermission(perms,'eventos:manageAll');const campus=hasPermission(perms,'eventos:manageCampus');
  const organizer=hasPermission(perms,'eventos:organize');const door=hasPermission(perms,'eventos:checkin');
  if(!global&&!campus&&!organizer&&!door)throw new ForbiddenException('No tienes acceso al control de ingreso');
  return (await this.db.query(`SELECT e.id,e.slug,e.title,e.starts_at AS "startsAt",e.ends_at AS "endsAt",e.capacity,c.name AS "campusName",e.details->>'bannerUrl' AS "bannerUrl",e.details->>'timezone' AS timezone,
   (SELECT count(*) FROM arm_app.event_registrations r WHERE r.event_id=e.id AND r.status='confirmed')::int AS confirmed,
   (SELECT count(*) FROM arm_app.event_registrations r WHERE r.event_id=e.id AND r.status='confirmed' AND r.checked_in_at IS NOT NULL)::int AS "checkedIn"
   FROM arm_app.event_programs e JOIN arm_app.campuses c ON c.id=e.campus_id
   WHERE e.status='published' AND e.ends_at>now()-interval '1 day'
   AND ($1::boolean OR (($2::boolean OR $5::boolean) AND (e.campus_id=$3 OR EXISTS(SELECT 1 FROM arm_app.event_program_campuses ec WHERE ec.event_id=e.id AND ec.campus_id=$3))) OR ($4::boolean AND e.organizer_id=$6))
   ORDER BY e.starts_at,e.id LIMIT 50`,[global,campus,user.campusId??null,organizer,door,user.sub])).rows;
 }

 async attendees(user:EventActor,eventId:string){
  const {event,manage}=await this.event(user,eventId,'door');
  const [rows,tickets,campuses]=await Promise.all([
   this.db.query(`${ATTENDEE_SQL} WHERE r.event_id=$1 ORDER BY r.created_at DESC LIMIT 5000`,[eventId]),
   this.db.query('SELECT id,name,price,currency FROM arm_app.event_ticket_types WHERE event_id=$1 AND NOT archived ORDER BY position',[eventId]),
   this.db.query('SELECT c.id,c.name FROM arm_app.event_program_campuses ec JOIN arm_app.campuses c ON c.id=ec.campus_id WHERE ec.event_id=$1 ORDER BY c.name',[eventId]),
  ]);
  const d=event.details??{};
  return {
   event:{id:event.id,slug:event.slug,title:event.title,status:event.status,startsAt:event.starts_at,endsAt:event.ends_at,capacity:event.capacity,timezone:d.timezone,pricing:d.pricing,color:d.color,bannerUrl:d.bannerUrl,
    tickets:tickets.rows.map((t:any)=>({id:t.id,name:t.name,price:Number(t.price),currency:t.currency})),campuses:campuses.rows.map((c:any)=>({id:Number(c.id),name:c.name})),
    questions:(d.questions??[]).map((q:any)=>({id:q.id,label:q.label,type:q.type}))},
   manage,
   registrations:rows.rows.map(attendee),
  };
 }

 async checkIn(user:EventActor,eventId:string,code:string):Promise<{result:CheckInResult;message:string;attendee:any;counts:{confirmed:number;checkedIn:number}}>{
  const {event}=await this.event(user,eventId,'door');
  const id=UUID.exec(code??'')?.[0]?.toLowerCase();
  const reply=async(result:CheckInResult,message:string,a:any=null)=>({result,message,attendee:a,counts:await this.counts(eventId)});
  if(!id)return reply('not_found','No reconocemos este código. Prueba de nuevo o busca a la persona por su nombre.');
  if(event.status==='cancelled')return reply('invalid','El evento está cancelado: no se registran ingresos.');
  // El QR lleva el código de la entrada, que cambia al transferirla: el código anterior deja de servir.
  const updated=(await this.db.query(`UPDATE arm_app.event_registrations SET checked_in_at=now(),checked_in_by=$3,updated_at=now() WHERE ticket_code=$1 AND event_id=$2 AND status='confirmed' AND checked_in_at IS NULL RETURNING id`,[id,eventId,user.sub])).rows[0];
  const found=(await this.db.query(`${ATTENDEE_SQL} WHERE r.event_id=$1 AND r.ticket_code=$2`,[eventId,id])).rows[0];
  const a=found?attendee(found):null;
  if(!a){
   const old=await this.one(eventId,id);
   if(old?.transferredAt)return reply('invalid',`Esta entrada fue transferida a ${old.firstName} ${old.lastName}: el código anterior ya no sirve.`,old);
   return reply('not_found','Esta entrada no corresponde a este evento.');
  }
  if(updated)return reply('ok',`Bienvenida/o, ${a.firstName}.`,a);
  if(a.status==='confirmed'&&a.checkedInAt)return reply('already','Esta entrada ya se usó para ingresar.',a);
  return reply('invalid',NOT_VALID[a.status]??'Esta entrada no es válida para ingresar.',a);
 }

 async undoCheckIn(user:EventActor,eventId:string,registrationId:string){
  await this.event(user,eventId,'door');
  const r=(await this.db.query('UPDATE arm_app.event_registrations SET checked_in_at=NULL,checked_in_by=NULL,updated_at=now() WHERE id=$1 AND event_id=$2 AND checked_in_at IS NOT NULL RETURNING id',[registrationId,eventId])).rows[0];
  if(!r)throw new NotFoundException('Esta persona no tenía un ingreso registrado');
  return {attendee:await this.one(eventId,registrationId),counts:await this.counts(eventId)};
 }

 async addManual(user:EventActor,eventId:string,dto:ManualRegistrationDto){
  await this.event(user,eventId,'manage');
  if(!dto.firstName.trim()||!dto.lastName.trim())throw new BadRequestException('Completa nombre y apellido');
  const email=dto.email.trim().toLowerCase();
  let order:any;let ticketId='';
  order=await this.db.transaction(async db=>{
   const event=(await db.query('SELECT * FROM arm_app.event_programs WHERE id=$1 FOR UPDATE',[eventId])).rows[0];
   if(['cancelled','finished'].includes(event.status))throw new BadRequestException('El evento está cancelado o finalizado');
   if(!(await this.campusTakesPart(eventId,event,dto.campusId)))throw new BadRequestException('Elige un campus participante del evento');
   const d=event.details??{};
   let ticketName=d.pricing==='paid'?'Cortesía':'Entrada gratuita';
   if(dto.ticketTypeId){
    const t=(await db.query('SELECT name FROM arm_app.event_ticket_types WHERE id=$1 AND event_id=$2',[dto.ticketTypeId,eventId])).rows[0];
    if(!t)throw new BadRequestException('Elige una entrada de este evento');
    ticketName=t.name;
   }
   // Una compra de una entrada, sin cobro, hecha por el equipo.
   const orderId=randomUUID();ticketId=randomUUID();
   const snapshot={paymentMode:'free',collectorId:null,title:event.title,slug:event.slug,startsAt:event.starts_at,timezone:d.timezone,ticketName,ticketSummary:ticketName,conditions:d.conditions,cancellationPolicy:d.cancellationPolicy,eventVersion:event.version,addedBy:user.sub};
   const participant={firstName:dto.firstName.trim(),lastName:dto.lastName.trim(),phone:dto.phone??'',age:null};
   const buyer={firstName:participant.firstName,lastName:participant.lastName,phone:participant.phone};
   const row=(await db.query(`INSERT INTO arm_app.event_orders(id,event_id,campus_id,request_hash,email,buyer,snapshot,status,subtotal,discount,amount,currency,source,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,'confirmed',0,0,0,'CLP','manual',$8) RETURNING *`,
    [orderId,eventId,dto.campusId,createHash('sha256').update(`manual:${orderId}`).digest('hex'),email,JSON.stringify(buyer),JSON.stringify(snapshot),user.sub])).rows[0];
   await db.query(`INSERT INTO arm_app.event_registrations(id,event_id,campus_id,request_hash,email,participant,snapshot,status,amount,currency,source,created_by,note,order_id,ticket_type_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,'confirmed',0,'CLP','manual',$8,$9,$10,$11)`,
    [ticketId,eventId,dto.campusId,createHash('sha256').update(`manual:${ticketId}`).digest('hex'),email,JSON.stringify(participant),JSON.stringify(snapshot),user.sub,dto.note?.trim()||null,orderId,dto.ticketTypeId??null]);
   return row;
  });
  const emailSent=dto.sendEmail?await this.registrations.notify(order):false;
  return {attendee:await this.one(eventId,ticketId),emailSent};
 }

 async cancel(user:EventActor,eventId:string,registrationId:string){
  await this.event(user,eventId,'manage');
  const r=await this.db.transaction(async db=>{
   const t=(await db.query(`UPDATE arm_app.event_registrations SET status='cancelled',cancelled_at=now(),cancelled_by=$3,updated_at=now() WHERE id=$1 AND event_id=$2 AND status<>'cancelled' RETURNING id,order_id,amount`,[registrationId,eventId,user.sub])).rows[0];
   if(!t)return null;
   // Si ya no queda ninguna entrada vigente, la compra completa queda anulada.
   const order=(await db.query(`UPDATE arm_app.event_orders o SET status='cancelled',updated_at=now() WHERE o.id=$1 AND NOT EXISTS(SELECT 1 FROM arm_app.event_registrations r WHERE r.order_id=o.id AND r.status<>'cancelled') RETURNING payment_id`,[t.order_id])).rows[0];
   const paymentId=order?.payment_id??(await db.query('SELECT payment_id FROM arm_app.event_orders WHERE id=$1',[t.order_id])).rows[0]?.payment_id;
   return {...t,payment_id:paymentId};
  });
  if(!r){if(!(await this.one(eventId,registrationId)))throw new NotFoundException('Inscripción no encontrada');throw new ConflictException('Esta inscripción ya estaba anulada');}
  const paid=r.payment_id&&Number(r.amount)>0;
  await this.registrations.promoteWaitlist(eventId).catch(()=>[]);
  return {attendee:await this.one(eventId,registrationId),message:paid?`Inscripción anulada y cupo liberado. Si corresponde devolver el dinero, hazlo en Mercado Pago (pago N° ${r.payment_id}).`:'Inscripción anulada y cupo liberado.'};
 }

 async resend(user:EventActor,eventId:string,registrationId:string){
  await this.event(user,eventId,'manage');
  const row=(await this.db.query('SELECT o.* FROM arm_app.event_registrations r JOIN arm_app.event_orders o ON o.id=r.order_id WHERE r.id=$1 AND r.event_id=$2',[registrationId,eventId])).rows[0];
  if(!row)throw new NotFoundException('Inscripción no encontrada');
  if(row.status==='cancelled'||(row.status==='pending_payment'&&Date.parse(row.expires_at)<=Date.now()))throw new BadRequestException('Esta inscripción no está vigente: no hay nada que reenviar');
  if(!(await this.registrations.resendOrder(row.id)))throw new ServiceUnavailableException('No pudimos enviar el correo. Inténtalo de nuevo en unos minutos.');
  return {message:row.status==='confirmed'?`Entradas reenviadas a ${row.email}.`:`Correo reenviado a ${row.email}.`};
 }
}
