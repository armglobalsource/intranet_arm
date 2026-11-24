import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { hasPermission } from '../common/permissions';
import { ResendMailerService } from '../auth/resend-mailer.service';
import { assertEventScope, EventActor, eventAccess } from './event-program.rules';
import { EventRegistrationService } from './event-registration.service';
import { EventPaymentService } from './event-payment.service';
import { money, renderEventMessage } from './event-email';
import { Audience, EventMessageDto, SurveyAnswerDto } from './event-insights.dto';

// Fase 4: resultados de venta, devoluciones con Mercado Pago, mensajes a inscritos y encuesta.

const ACTIVE="(r.status IN ('confirmed','waitlisted') OR (r.status='pending_payment' AND r.expires_at>now()))";
const AUDIENCE_SQL:Record<Audience,string>={
 all:ACTIVE,
 confirmed:"r.status='confirmed'",
 checked_in:"r.status='confirmed' AND r.checked_in_at IS NOT NULL",
 not_checked_in:"r.status='confirmed' AND r.checked_in_at IS NULL",
 pending:"r.status='pending_payment' AND r.expires_at>now()",
 waitlisted:"r.status='waitlisted'",
};
const MAX_RECIPIENTS=2000;
const n=(v:unknown)=>Number(v??0);
const b64=(s:string)=>Buffer.from(s).toString('base64url');

/** Puntaje NPS: % promotores (9-10) menos % detractores (0-6), redondeado. */
export function npsScore(values:number[]){
 if(!values.length)return null;
 const promoters=values.filter(v=>v>=9).length,detractors=values.filter(v=>v<=6).length;
 return {score:Math.round(((promoters-detractors)/values.length)*100),promoters,passives:values.length-promoters-detractors,detractors,answered:values.length};
}

@Injectable()
export class EventInsightsService {
 constructor(private readonly db:DatabaseService,private readonly registrations:EventRegistrationService,private readonly payments:EventPaymentService,private readonly mail:ResendMailerService){}

 private async managed(user:EventActor,eventId:string){
  eventAccess(user);
  const event=(await this.db.query('SELECT * FROM arm_app.event_programs WHERE id=$1',[eventId])).rows[0] as any;
  if(!event)throw new NotFoundException('Evento no encontrado');
  assertEventScope(user,event);
  return event;
 }

 // ── Ventas ──
 async sales(user:EventActor,eventId:string){
  const event=await this.managed(user,eventId);
  const tz=event.details?.timezone||'America/Santiago';
  const [orders,tickets,byDay,types,sold,byCampus,codes]=await Promise.all([
   this.db.query(`SELECT count(*) FILTER (WHERE status='confirmed')::int AS confirmed,
     coalesce(sum(amount-refunded_amount) FILTER (WHERE payment_id IS NOT NULL AND coalesce(snapshot->>'paymentMode','')='production'),0) AS collected,
     coalesce(sum(amount-refunded_amount) FILTER (WHERE payment_id IS NOT NULL AND coalesce(snapshot->>'paymentMode','')='test'),0) AS "testCollected",
     coalesce(sum(discount) FILTER (WHERE status='confirmed'),0) AS discounts,
     coalesce(sum(refunded_amount),0) AS refunded,
     count(*) FILTER (WHERE status='pending_payment' AND expires_at>now())::int AS "pendingOrders",
     coalesce(sum(amount) FILTER (WHERE status='pending_payment' AND expires_at>now()),0) AS "pendingAmount",
     count(*) FILTER (WHERE status='waitlisted')::int AS "waitlistedOrders",
     count(*) FILTER (WHERE status='payment_review')::int AS "reviewOrders"
     FROM arm_app.event_orders WHERE event_id=$1`,[eventId]),
   this.db.query(`SELECT count(*) FILTER (WHERE status='confirmed')::int AS confirmed,count(*) FILTER (WHERE status='confirmed' AND checked_in_at IS NOT NULL)::int AS "checkedIn",
     count(*) FILTER (WHERE status='pending_payment' AND expires_at>now())::int AS pending,count(*) FILTER (WHERE status='waitlisted')::int AS waitlisted,
     count(*) FILTER (WHERE status='cancelled')::int AS cancelled,count(*) FILTER (WHERE source='manual' AND status='confirmed')::int AS courtesy
     FROM arm_app.event_registrations WHERE event_id=$1`,[eventId]),
   this.db.query(`SELECT to_char((created_at AT TIME ZONE $2)::date,'YYYY-MM-DD') AS day,count(*)::int AS tickets,coalesce(sum(amount),0) AS amount
     FROM arm_app.event_registrations WHERE event_id=$1 AND status='confirmed' GROUP BY 1 ORDER BY 1`,[eventId,tz]),
   this.db.query('SELECT id,name,capacity,price,archived FROM arm_app.event_ticket_types WHERE event_id=$1 ORDER BY archived,position',[eventId]),
   this.db.query(`SELECT ticket_type_id,coalesce(max(snapshot->>'ticketName'),'Entrada') AS name,count(*) FILTER (WHERE status='confirmed')::int AS sold,
     count(*) FILTER (WHERE status='pending_payment' AND expires_at>now())::int AS pending,coalesce(sum(amount) FILTER (WHERE status='confirmed'),0) AS revenue
     FROM arm_app.event_registrations WHERE event_id=$1 GROUP BY ticket_type_id`,[eventId]),
   this.db.query(`SELECT c.name,count(*) FILTER (WHERE r.status='confirmed')::int AS tickets,coalesce(sum(r.amount) FILTER (WHERE r.status='confirmed'),0) AS revenue
     FROM arm_app.event_registrations r JOIN arm_app.campuses c ON c.id=r.campus_id WHERE r.event_id=$1 GROUP BY c.name HAVING count(*) FILTER (WHERE r.status='confirmed')>0 ORDER BY 2 DESC`,[eventId]),
   this.db.query(`SELECT c.code,c.kind,c.value,c.active,count(o.id) FILTER (WHERE o.status='confirmed')::int AS uses,coalesce(sum(o.discount) FILTER (WHERE o.status='confirmed'),0) AS given
     FROM arm_app.event_discount_codes c LEFT JOIN arm_app.event_orders o ON o.discount_code_id=c.id WHERE c.event_id=$1 GROUP BY c.id ORDER BY 5 DESC,c.code`,[eventId]),
  ]);
  const soldBy=new Map(sold.rows.map((r:any)=>[r.ticket_type_id??'',r]));
  const ticketRows=types.rows.filter((t:any)=>!t.archived||soldBy.has(t.id)).map((t:any)=>{const s:any=soldBy.get(t.id);return {name:t.name,capacity:t.capacity==null?null:n(t.capacity),price:n(t.price),sold:n(s?.sold),pending:n(s?.pending),revenue:n(s?.revenue)};});
  const loose:any=soldBy.get('');if(loose&&(n(loose.sold)||n(loose.pending)))ticketRows.push({name:types.rows.length?'Cortesías y otras':loose.name,capacity:null,price:0,sold:n(loose.sold),pending:n(loose.pending),revenue:n(loose.revenue)});
  const o:any=orders.rows[0]??{};const t:any=tickets.rows[0]??{};
  return {
   event:{title:event.title,startsAt:event.starts_at,timezone:tz,capacity:event.capacity==null?null:n(event.capacity),pricing:event.details?.pricing},
   totals:{collected:n(o.collected),testCollected:n(o.testCollected),discounts:n(o.discounts),refunded:n(o.refunded),pendingAmount:n(o.pendingAmount),pendingOrders:n(o.pendingOrders),
    waitlistedOrders:n(o.waitlistedOrders),reviewOrders:n(o.reviewOrders),orders:n(o.confirmed),tickets:n(t.confirmed),checkedIn:n(t.checkedIn),pendingTickets:n(t.pending),
    waitlisted:n(t.waitlisted),cancelled:n(t.cancelled),courtesy:n(t.courtesy)},
   byDay:byDay.rows.map((r:any)=>({day:r.day,tickets:n(r.tickets),amount:n(r.amount)})),
   byTicket:ticketRows,
   byCampus:byCampus.rows.map((r:any)=>({name:r.name,tickets:n(r.tickets),revenue:n(r.revenue)})),
   codes:codes.rows.map((r:any)=>({code:r.code,kind:r.kind,value:n(r.value),active:!!r.active,uses:n(r.uses),given:n(r.given)})),
  };
 }

 // ── Devoluciones ──
 /** Devuelve con Mercado Pago una entrada (su monto) o lo que queda de la compra; anula esas entradas y libera los cupos. */
 async refund(user:EventActor,eventId:string,registrationId:string,wholeOrder:boolean){
  await this.managed(user,eventId);
  if(!hasPermission(user.permissions??[],'eventos:refund'))throw new ForbiddenException('Para devolver pagos necesitas el permiso «Devolver pagos con Mercado Pago».');
  const result=await this.db.transaction(async db=>{
   const ticket=(await db.query('SELECT * FROM arm_app.event_registrations WHERE id=$1 AND event_id=$2 FOR UPDATE',[registrationId,eventId])).rows[0];
   if(!ticket)throw new NotFoundException('Inscripción no encontrada');
   const order=(await db.query('SELECT * FROM arm_app.event_orders WHERE id=$1 FOR UPDATE',[ticket.order_id])).rows[0];
   if(!order?.payment_id||n(order.amount)<=0)throw new BadRequestException('Esta inscripción no tiene un pago de Mercado Pago que devolver.');
   this.payments.assertRegistrationMode(order);
   const remaining=n(order.amount)-n(order.refunded_amount);
   const tickets=wholeOrder
    ?(await db.query('SELECT * FROM arm_app.event_registrations WHERE order_id=$1 AND refunded_at IS NULL FOR UPDATE',[order.id])).rows
    :[ticket];
   if(!wholeOrder&&ticket.refunded_at)throw new ConflictException('Esta entrada ya fue devuelta.');
   const amount=wholeOrder?remaining:Math.min(n(ticket.amount),remaining);
   if(amount<=0)throw new BadRequestException(wholeOrder?'No queda monto por devolver en esta compra.':'Esta entrada no tiene monto que devolver. Si quieres liberar el cupo, anúlala.');
   const refund=await this.payments.refund(String(order.payment_id),Math.round(amount),`event-refund/${order.id}/${wholeOrder?'all':ticket.id}/${n(order.refunded_amount)}`);
   const entry={id:refund.id,amount:refund.amount,status:refund.status,ticketIds:tickets.map((t:any)=>t.id),by:user.sub,at:new Date().toISOString()};
   await db.query(`UPDATE arm_app.event_orders SET refunded_amount=refunded_amount+$2,refunds=refunds||$3::jsonb,refunded_at=now(),updated_at=now() WHERE id=$1`,[order.id,refund.amount,JSON.stringify([entry])]);
   await db.query(`UPDATE arm_app.event_registrations SET status='cancelled',cancelled_at=coalesce(cancelled_at,now()),cancelled_by=coalesce(cancelled_by,$2),refunded_at=now(),updated_at=now() WHERE id=ANY($1::uuid[])`,[tickets.map((t:any)=>t.id),user.sub]);
   await db.query(`UPDATE arm_app.event_orders o SET status='cancelled',updated_at=now() WHERE o.id=$1 AND NOT EXISTS(SELECT 1 FROM arm_app.event_registrations r WHERE r.order_id=o.id AND r.status<>'cancelled')`,[order.id]);
   return {orderId:order.id as string,refund,buyer:`${order.buyer?.firstName??''} ${order.buyer?.lastName??''}`.trim(),currency:order.currency as string};
  });
  const order=(await this.db.query('SELECT * FROM arm_app.event_orders WHERE id=$1',[result.orderId])).rows[0];
  await this.registrations.notify({...order,amount:result.refund.amount,discount:0},{force:true,kind:'refunded'});
  await this.registrations.promoteWaitlist(eventId).catch(()=>[]);
  const pending=result.refund.status==='in_process'?' La devolución quedó en proceso en Mercado Pago.':'';
  return {amount:result.refund.amount,refundId:result.refund.id,message:`Devolvimos ${money(result.refund.amount,result.currency)} a ${result.buyer} con Mercado Pago y anulamos ${wholeOrder?'las entradas de la compra':'la entrada'}.${pending}`};
 }

 // ── Mensajes ──
 private async recipients(eventId:string,dto:Pick<EventMessageDto,'audience'|'ticketTypeId'|'campusId'>){
  const where=`r.event_id=$1 AND (${AUDIENCE_SQL[dto.audience]}) AND ($2::uuid IS NULL OR r.ticket_type_id=$2) AND ($3::bigint IS NULL OR r.campus_id=$3)`;
  const rows=(await this.db.query(`SELECT lower(r.email) AS email FROM arm_app.event_registrations r WHERE ${where}
   UNION SELECT lower(o.email) FROM arm_app.event_registrations r JOIN arm_app.event_orders o ON o.id=r.order_id WHERE ${where}`,[eventId,dto.ticketTypeId??null,dto.campusId??null])).rows;
  return rows.map((r:any)=>String(r.email)).filter(e=>/^[^@\s]+@[^@\s]+$/.test(e));
 }
 private async userEmail(user:EventActor){
  return (await this.db.query('SELECT email FROM arm_app.users WHERE id=$1',[user.sub])).rows[0]?.email as string|undefined;
 }
 async sendMessage(user:EventActor,eventId:string,dto:EventMessageDto){
  const event=await this.managed(user,eventId);
  if(!dto.subject.trim()||!dto.body.trim())throw new BadRequestException('Escribe el asunto y el mensaje.');
  const list=await this.recipients(eventId,dto);
  if(dto.dryRun)return {recipients:list.length};
  const d=event.details??{};
  const origin=this.registrations.publicOrigin();
  const mail=renderEventMessage({subject:dto.subject.trim(),body:dto.body,origin,senderName:d.senderName,
   event:{title:event.title,slug:event.slug,bannerUrl:d.bannerUrl,color:d.color,startsAt:new Date(event.starts_at).toISOString(),timezone:d.timezone,location:d.location}});
  if(dto.test){
   const to=await this.userEmail(user);
   if(!to)throw new BadRequestException('Tu cuenta no tiene un correo para la prueba.');
   await this.mail.sendHtml({to:[to],subject:`[Prueba] ${mail.subject}`,html:mail.html,text:mail.text,sender:{name:d.senderName,email:d.senderEmail},idempotencyKey:`event-message-test/${eventId}/${Date.now()}`});
   return {test:true,to,message:`Te enviamos una prueba a ${to}.`};
  }
  if(!list.length)throw new BadRequestException('No hay personas que reciban este mensaje con esos filtros.');
  if(list.length>MAX_RECIPIENTS)throw new BadRequestException(`El mensaje llegaría a ${list.length} personas; el máximo por envío es ${MAX_RECIPIENTS}. Usa los filtros para dividirlo.`);
  const row=(await this.db.query('INSERT INTO arm_app.event_messages(event_id,subject,body,audience,recipients,sent_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
   [eventId,dto.subject.trim(),dto.body,JSON.stringify({audience:dto.audience,ticketTypeId:dto.ticketTypeId??null,campusId:dto.campusId??null}),list.length,user.sub])).rows[0];
  const result=await this.mail.sendBatch(list.map(to=>({to,subject:mail.subject,html:mail.html,text:mail.text})),{idempotencyKey:`event-message/${row.id}`,sender:{name:d.senderName,email:d.senderEmail}});
  await this.db.query('UPDATE arm_app.event_messages SET sent=$2,failed=$3 WHERE id=$1',[row.id,result.sent,result.failed]);
  return {id:row.id,recipients:list.length,...result,message:result.failed?`Enviamos ${result.sent} de ${list.length} correos. Los demás fallaron: inténtalo más tarde con un filtro.`:`Mensaje enviado a ${result.sent} personas.`};
 }
 async messages(user:EventActor,eventId:string){
  await this.managed(user,eventId);
  return (await this.db.query(`SELECT m.id,m.subject,m.body,m.audience,m.recipients,m.sent,m.failed,m.created_at AS "createdAt",concat_ws(' ',u."firstName",u."lastName") AS "sentBy"
   FROM arm_app.event_messages m JOIN arm_app.users u ON u.id=m.sent_by WHERE m.event_id=$1 ORDER BY m.created_at DESC LIMIT 50`,[eventId])).rows;
 }

 // ── Encuesta ──
 private surveyToken(eventId:string,email:string){return this.registrations.sign(`survey:${eventId}:${email}`);}
 private surveyLink(event:any,email:string){
  return `${this.registrations.publicOrigin()}/eventos/${encodeURIComponent(event.slug)}/encuesta#e=${b64(email)}&t=${this.surveyToken(event.id,email)}`;
 }
 private respondent(eventId:string,email:string){return createHash('sha256').update(`${eventId}:${email}`).digest('hex');}
 private async surveyRecipients(eventId:string){
  const anyCheckIn=(await this.db.query("SELECT 1 FROM arm_app.event_registrations WHERE event_id=$1 AND checked_in_at IS NOT NULL LIMIT 1",[eventId])).rows.length>0;
  const rows=(await this.db.query(`SELECT DISTINCT lower(email) AS email FROM arm_app.event_registrations WHERE event_id=$1 AND status='confirmed'${anyCheckIn?' AND checked_in_at IS NOT NULL':''}`,[eventId])).rows;
  return {emails:rows.map((r:any)=>String(r.email)),onlyCheckedIn:anyCheckIn};
 }
 /** Envía la encuesta a quienes asistieron (o a todas las entradas confirmadas si no se usó el control de ingreso). */
 async sendSurvey(eventId:string,user?:EventActor){
  const event=user?await this.managed(user,eventId):(await this.db.query('SELECT * FROM arm_app.event_programs WHERE id=$1',[eventId])).rows[0];
  if(!event)throw new NotFoundException('Evento no encontrado');
  if(new Date(event.ends_at).getTime()>Date.now())throw new BadRequestException('La encuesta se envía cuando el evento termina.');
  if(event.survey_sent_at)throw new ConflictException('La encuesta ya se envió.');
  const {emails}=await this.surveyRecipients(eventId);
  if(!emails.length)throw new BadRequestException('No hay asistentes a quienes enviar la encuesta.');
  const d=event.details??{};const origin=this.registrations.publicOrigin();
  const mails=emails.slice(0,MAX_RECIPIENTS).map(to=>{
   const m=renderEventMessage({subject:`¿Cómo te fue en ${event.title}?`,origin,senderName:d.senderName,
    body:`¡Gracias por participar!\n\nQueremos que el próximo sea aún mejor. ¿Nos cuentas cómo lo viviste? Son cuatro preguntas y toma un minuto. Tus respuestas son anónimas.`,
    button:{label:'Responder la encuesta',link:this.surveyLink(event,to)},
    event:{title:event.title,slug:event.slug,bannerUrl:d.bannerUrl,color:d.color,startsAt:new Date(event.starts_at).toISOString(),timezone:d.timezone,location:d.location}});
   return {to,subject:m.subject,html:m.html,text:m.text};
  });
  await this.db.query('UPDATE arm_app.event_programs SET survey_sent_at=now() WHERE id=$1 AND survey_sent_at IS NULL',[eventId]);
  const result=await this.mail.sendBatch(mails,{idempotencyKey:`event-survey/${eventId}`,sender:{name:d.senderName,email:d.senderEmail}});
  return {recipients:mails.length,...result,message:`Encuesta enviada a ${result.sent} personas.`};
 }
 /** Tarea diaria: encuestas de eventos que terminaron hace entre 6 horas y 3 días. */
 async dailySurveys(){
  const due=(await this.db.query(`SELECT id FROM arm_app.event_programs WHERE status IN ('published','finished') AND survey_sent_at IS NULL
   AND ends_at<now()-interval '6 hours' AND ends_at>now()-interval '3 days' AND coalesce((details->>'survey')::boolean,true)`)).rows;
  let sent=0;for(const e of due){try{sent+=(await this.sendSurvey(e.id)).sent;}catch{/* sin asistentes o ya enviada */}}
  return {surveys:due.length,surveyEmails:sent};
 }
 private surveyEmail(eventId:string,e:string,t:string){
  const email=Buffer.from(e,'base64url').toString().toLowerCase();
  const expected=Buffer.from(this.surveyToken(eventId,email));const given=Buffer.from(t);
  if(expected.length!==given.length||!timingSafeEqual(expected,given))throw new NotFoundException('Este enlace de encuesta no es válido.');
  return email;
 }
 private async surveyEvent(slug:string){
  const event=(await this.db.query(`SELECT * FROM arm_app.event_programs WHERE slug=$1 AND published_at IS NOT NULL`,[slug])).rows[0];
  if(!event)throw new NotFoundException('Evento no encontrado');
  return event;
 }
 async surveyInfo(slug:string,e:string,t:string){
  const event=await this.surveyEvent(slug);const email=this.surveyEmail(event.id,e,t);
  const answered=(await this.db.query('SELECT 1 FROM arm_app.event_survey_responses WHERE event_id=$1 AND respondent_hash=$2',[event.id,this.respondent(event.id,email)])).rows.length>0;
  const d=event.details??{};
  return {title:event.title,startsAt:event.starts_at,timezone:d.timezone,bannerUrl:d.bannerUrl,color:d.color,question:d.surveyQuestion?.trim()||null,answered};
 }
 async answerSurvey(slug:string,dto:SurveyAnswerDto){
  const event=await this.surveyEvent(slug);const email=this.surveyEmail(event.id,dto.e,dto.t);
  const clean=(v?:string)=>v?.trim()?v.trim().slice(0,1000):null;
  const r=(await this.db.query(`INSERT INTO arm_app.event_survey_responses(event_id,respondent_hash,rating,nps,liked,improve,extra) VALUES($1,$2,$3,$4,$5,$6,$7)
   ON CONFLICT(event_id,respondent_hash) DO NOTHING RETURNING id`,[event.id,this.respondent(event.id,email),dto.rating,dto.nps??null,clean(dto.liked),clean(dto.improve),clean(dto.extra)])).rows[0];
  if(!r)throw new ConflictException('Ya respondiste esta encuesta. ¡Gracias!');
  return {message:'¡Gracias por responder!'};
 }
 async surveyResults(user:EventActor,eventId:string){
  const event=await this.managed(user,eventId);
  const rows=(await this.db.query('SELECT rating,nps,liked,improve,extra,created_at AS "createdAt" FROM arm_app.event_survey_responses WHERE event_id=$1 ORDER BY created_at DESC',[eventId])).rows;
  const {emails,onlyCheckedIn}=await this.surveyRecipients(eventId);
  const ratings=rows.map((r:any)=>Number(r.rating));
  return {
   enabled:event.details?.survey??true,question:event.details?.surveyQuestion??null,sentAt:event.survey_sent_at,ended:new Date(event.ends_at).getTime()<=Date.now(),
   recipients:emails.length,onlyCheckedIn,responses:rows.length,
   rating:ratings.length?Math.round((ratings.reduce((s,v)=>s+v,0)/ratings.length)*10)/10:null,
   distribution:[1,2,3,4,5].map(v=>ratings.filter(x=>x===v).length),
   nps:npsScore(rows.filter((r:any)=>r.nps!=null).map((r:any)=>Number(r.nps))),
   comments:rows.filter((r:any)=>r.liked||r.improve||r.extra).slice(0,200),
  };
 }
}
