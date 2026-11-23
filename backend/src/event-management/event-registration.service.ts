import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { ResendMailerService } from '../auth/resend-mailer.service';
import { EventPaymentService, InspectedPayment } from './event-payment.service';
import { RegistrationDto } from './event-registration.dto';
import { assertEventScope, EventActor, eventAccess } from './event-program.rules';

export function registrationsOpen(event:any,now=Date.now()){
 const d=event.details;
 return event.status==='published'&&!!event.published_at&&event.registration_status==='open'&&now<new Date(event.ends_at).getTime()&&(!d.registrationOpensAt||now>=Date.parse(d.registrationOpensAt))&&(!d.registrationClosesAt||now<Date.parse(d.registrationClosesAt))&&(d.pricing!=='paid'||!d.paymentDueAt||now<Date.parse(d.paymentDueAt));
}
@Injectable()
export class EventRegistrationService {
 constructor(private readonly db:DatabaseService,private readonly config:ConfigService,private readonly payments:EventPaymentService,private readonly mail:ResendMailerService){}
 private settings(){
  const secret=this.config.get<string>('EVENT_REGISTRATION_SECRET')??'';
  let url:URL;
  try{url=new URL(this.config.get<string>('FRONTEND_URL')??'https://invalid.local');}catch{throw new ServiceUnavailableException('Las inscripciones todavía no están configuradas.');}
  if(secret.length<32||url.protocol!=='https:'||url.hostname==='invalid.local'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new ServiceUnavailableException('Las inscripciones todavía no están configuradas.');
  return {secret,origin:url.origin};
 }
 assertConfigured(pricing:string){
  this.settings();
  if(pricing==='paid')this.payments.assertConfigured();
 }
 paymentMode(){return this.payments.mode();}
 async checkPayments(user:EventActor){
  eventAccess(user);this.assertConfigured('paid');
  let collectorId:string;
  try{collectorId=await this.payments.assertSeller();}
  catch(err){
   // Solo para quien administra eventos: últimos 4 dígitos de cada ID, para ver cuál corregir sin exponer el token.
   if(!(err instanceof ServiceUnavailableException)||!/ID receptor configurado/.test(err.message))throw err;
   const ids=await this.payments.sellerIds();
   const tail=(v:string)=>v?`…${v.slice(-4)} (${v.length} dígitos)`:'(vacío)';
   throw new ServiceUnavailableException(`${err.message} Cuenta del Access Token: ${tail(ids.seller)} · ID configurado: ${tail(ids.configured)}.`);
  }
  return {mode:this.paymentMode(),collectorId,message:'Cuenta receptora y configuración verificadas. Esta comprobación no realiza cobros.'};
 }
 private token(id:string){return createHmac('sha256',this.settings().secret).update(`event-registration:${id}`).digest('hex');}
 private async row(id:string){const r=(await this.db.query('SELECT * FROM arm_app.event_registrations WHERE id=$1',[id])).rows[0];if(!r)throw new NotFoundException('Inscripción no encontrada');return r;}
 private authorize(id:string,token:string){const expected=this.token(id);if(!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(token,'hex')))throw new NotFoundException('Inscripción no encontrada');}
 private view(row:any){
  const expired=row.status==='pending_payment'&&Date.parse(row.expires_at)<=Date.now();
  return {id:row.id,token:this.token(row.id),status:expired?'expired':row.status,participantName:`${row.participant.firstName} ${row.participant.lastName}`,title:row.snapshot.title,startsAt:row.snapshot.startsAt,timezone:row.snapshot.timezone,amount:Number(row.amount),currency:row.currency,expiresAt:row.expires_at,emailSent:!!(row.status==='confirmed'?row.confirmation_sent_at:row.email_sent_at),testPayment:Number(row.amount)>0&&(row.snapshot.paymentMode??'test')==='test',ticketCode:row.status==='confirmed'?row.id:null};
 }
 async register(slug:string,dto:RegistrationDto){
  this.settings();
  if(!dto.firstName.trim()||!dto.lastName.trim())throw new BadRequestException('Completa tu nombre y apellido');
  const email=dto.email.trim().toLowerCase();const requestHash=createHash('sha256').update(dto.requestKey).digest('hex');
  let row:any;
  try{row=await this.db.transaction(async db=>{
   const event=(await db.query('SELECT * FROM arm_app.event_programs WHERE slug=$1 FOR UPDATE',[slug])).rows[0];
   if(!event)throw new NotFoundException('Evento no encontrado');
   const old=(await db.query('SELECT * FROM arm_app.event_registrations WHERE event_id=$1 AND request_hash=$2',[event.id,requestHash])).rows[0];
   if(old)return old;
   if(!registrationsOpen(event))throw new BadRequestException('Las inscripciones no están abiertas en este momento');
   const d=event.details;
   this.assertConfigured(d.pricing);
   if(d.minimumAge!=null&&(dto.age==null||dto.age<d.minimumAge))throw new BadRequestException(`La edad mínima es ${d.minimumAge} años`);
   const campus=(await db.query('SELECT c.id FROM arm_app.event_program_campuses ec JOIN arm_app.campuses c ON c.id=ec.campus_id WHERE ec.event_id=$1 AND c.id=$2 AND c."isActive"=true',[event.id,dto.campusId])).rows[0];
   if(!campus)throw new BadRequestException('Selecciona un campus participante');
   let amount=0;let ticketName='Entrada gratuita';
   if(d.pricing==='paid'){
    const ticket=(await db.query('SELECT * FROM arm_app.event_ticket_types WHERE id=$1 AND event_id=$2',[dto.ticketTypeId??null,event.id])).rows[0];
    if(!ticket||ticket.currency!=='CLP'||Number(ticket.price)<=0||!Number.isInteger(Number(ticket.price)))throw new BadRequestException('Selecciona una entrada válida en pesos chilenos');
    amount=Number(ticket.price);ticketName=ticket.name;
   }
   await db.query("UPDATE arm_app.event_registrations SET status='expired',updated_at=now() WHERE event_id=$1 AND status='pending_payment' AND expires_at<=now()",[event.id]);
   const count=Number((await db.query("SELECT count(*) FROM arm_app.event_registrations WHERE event_id=$1 AND status IN ('confirmed','pending_payment')",[event.id])).rows[0].count);
   const full=event.capacity!=null&&count>=event.capacity;
   if(full&&!d.waitlist)throw new ConflictException('Los cupos se agotaron.');
   const status=full?'waitlisted':amount>0?'pending_payment':'confirmed';
   const expires=amount>0?new Date(Math.min(Date.now()+24*60*60*1000,new Date(event.ends_at).getTime(),d.paymentDueAt?Date.parse(d.paymentDueAt):Infinity)).toISOString():null;
   const snapshot={paymentMode:amount>0?this.paymentMode():'free',collectorId:amount>0&&this.paymentMode()==='production'?this.config.get('MERCADOPAGO_COLLECTOR_ID'):null,title:event.title,slug:event.slug,startsAt:event.starts_at,timezone:d.timezone,ticketName,conditions:d.conditions,cancellationPolicy:d.cancellationPolicy,eventVersion:event.version,consentAt:new Date().toISOString()};
   const participant={firstName:dto.firstName.trim(),lastName:dto.lastName.trim(),phone:dto.phone,age:dto.age??null};
   return (await db.query('INSERT INTO arm_app.event_registrations(id,event_id,campus_id,request_hash,email,participant,snapshot,status,amount,currency,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,\'CLP\',$10) RETURNING *',[randomUUID(),event.id,dto.campusId,requestHash,email,JSON.stringify(participant),JSON.stringify(snapshot),status,amount,expires])).rows[0];
  });}catch(e){if((e as any).code==='23505')throw new ConflictException('Ya existe una inscripción para ese correo. Revisa tu comprobante o contacta al organizador.');throw e;}
  await this.notify(row);return this.view(await this.row(row.id));
 }
 async get(id:string,token:string){
  this.authorize(id,token);const row=await this.reconcile(await this.row(id));
  const event=(await this.db.query('SELECT status FROM arm_app.event_programs WHERE id=$1',[row.event_id])).rows[0];
  if(event?.status==='cancelled')row.status='cancelled';
  return this.view(row);
 }
 async checkout(id:string,token:string){
  this.authorize(id,token);
  return this.db.transaction(async db=>{
   const row=(await db.query('SELECT * FROM arm_app.event_registrations WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!row||row.status!=='pending_payment'||Date.parse(row.expires_at)<=Date.now())throw new BadRequestException('Esta inscripción no tiene un pago pendiente vigente');
   const event=(await db.query('SELECT status FROM arm_app.event_programs WHERE id=$1',[row.event_id])).rows[0];
   if(event.status!=='published')throw new BadRequestException('El evento no admite pagos');
   this.payments.assertConfigured();
   this.payments.assertRegistrationMode(row);
   if(row.checkout_url)return {url:row.checkout_url};
   const checkout=await this.payments.checkout(row,this.settings().origin);
   await db.query('UPDATE arm_app.event_registrations SET preference_id=$2,checkout_url=$3,updated_at=now() WHERE id=$1',[id,checkout.id,checkout.url]);
   return {url:checkout.url};
  });
 }
 async notify(row:any){
  const confirmed=row.status==='confirmed';
  if(confirmed?row.confirmation_sent_at:row.email_sent_at)return;
  const link=`${this.settings().origin}/eventos/${encodeURIComponent(row.snapshot.slug)}/inscripcion#id=${row.id}&token=${this.token(row.id)}`;
  const testPayment=Number(row.amount)>0&&(row.snapshot.paymentMode??'test')==='test';
  const paymentNote=Number(row.amount)===0?'':testPayment?'Este pago utiliza Mercado Pago de prueba.':'El estado de un pago se confirma únicamente después de verificarlo con Mercado Pago.';
  const text=`Tu inscripción en ARM Global fue registrada. Consulta su estado y, si está confirmada, tu entrada: ${link}\n${paymentNote} Una lista de espera no asegura un cupo.`;
  try{
   await this.mail.sendHtml({to:[row.email],subject:confirmed?'Tu entrada está confirmada · ARM Global':'Tu inscripción · ARM Global',text,html:`<p>${confirmed?'Tu entrada está confirmada.':'Tu inscripción fue registrada.'}</p><p><a href="${link.replace(/&/g,'&amp;')}">Consultar inscripción y entrada</a></p><p>${paymentNote}</p>`,idempotencyKey:`event-registration/${row.id}/${confirmed?'confirmed':'registered'}`});
   await this.db.query(`UPDATE arm_app.event_registrations SET ${confirmed?'confirmation_sent_at':'email_sent_at'}=now() WHERE id=$1`,[row.id]);
  }catch{/* A failed email never undoes a committed booking; authenticated retry is available. */}
 }
 async resend(id:string,token:string){this.authorize(id,token);await this.notify(await this.row(id));return this.get(id,token);}
 /**
  * Si el aviso de Mercado Pago no llegó, se le pregunta directamente por un pago aprobado de esta
  * inscripción. Pasa por las mismas comprobaciones que el webhook; si Mercado Pago no responde,
  * la inscripción queda como estaba.
  */
 private async reconcile(row:any){
  if(row.status!=='pending_payment'||!row.preference_id||Number(row.amount)<=0)return row;
  try{
   const approved=(await this.payments.findPayments(row.id)).find((p:any)=>p.status==='approved');
   if(!approved)return row;
   await this.applyPayment(approved);
   return await this.row(row.id);
  }catch{return row;}
 }
 async webhook(id:string,requestId:string,signature:string){
  // payment() ya comprobó que el pago consultado corresponde a este ID.
  return this.applyPayment({...(await this.payments.payment(id,requestId,signature)),id});
 }
 /** Aplica un pago ya verificado con Mercado Pago (llegue por webhook o por consulta directa). */
 private async applyPayment(payment:any){
  const id=String(payment.id);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payment.external_reference??''))return {received:true};
  const found=(await this.db.query('SELECT event_id FROM arm_app.event_registrations WHERE id=$1',[payment.external_reference])).rows[0];
  if(!found)return {received:true};
  await this.db.transaction(async db=>{
   const event=(await db.query('SELECT * FROM arm_app.event_programs WHERE id=$1 FOR UPDATE',[found.event_id])).rows[0];
   const row=(await db.query('SELECT * FROM arm_app.event_registrations WHERE id=$1 FOR UPDATE',[payment.external_reference])).rows[0];
   this.payments.assertRegistrationMode(row);
   if(Number(row.amount)!==Number(payment.transaction_amount)||payment.currency_id!==row.currency||!row.preference_id||Number(row.amount)<=0)throw new BadRequestException('El importe no coincide con la inscripción');
   if(row.payment_id&&row.payment_id!==id)throw new ConflictException('La inscripción ya tiene otro pago asociado');
   if(['refunded','charged_back'].includes(payment.status)||Number(payment.transaction_amount_refunded)>0){
    if(row.payment_id===id)await db.query("UPDATE arm_app.event_registrations SET status='payment_review',updated_at=now() WHERE id=$1",[row.id]);
    return;
   }
   if(payment.status!=='approved'||row.payment_id===id)return;
   // Late payments require review; never silently grant a cupo after its reservation expired.
   const valid=row.status==='pending_payment'&&Date.parse(row.expires_at)>Date.now()&&event.status==='published';
   await db.query('UPDATE arm_app.event_registrations SET status=$2,payment_id=$3,updated_at=now() WHERE id=$1',[row.id,valid?'confirmed':'payment_review',id]);
  });
  const row=await this.row(payment.external_reference);
  if(row.status==='confirmed')await this.notify(row);
  return {received:true};
 }
 /** Para el organizador: consulta el pago en Mercado Pago, lo aplica si corresponde y explica el resultado. */
 async verifyPayment(user:EventActor,eventId:string,registrationId:string){
  const event=(await this.db.query('SELECT * FROM arm_app.event_programs WHERE id=$1',[eventId])).rows[0];
  if(!event)throw new NotFoundException('Evento no encontrado');assertEventScope(user,{campus_id:event.campus_id,organizer_id:event.organizer_id});
  const before=await this.row(registrationId);
  if(before.event_id!==eventId)throw new NotFoundException('Inscripción no encontrada');
  if(Number(before.amount)<=0)return {status:before.status,message:'Esta inscripción no tiene pago.',payments:[]};
  const found:InspectedPayment[]=await this.payments.inspectPayments(registrationId);
  const payments=found.map(({payment:_p,...rest}:InspectedPayment)=>rest);
  let after=before;
  const approved=found.find((p:InspectedPayment)=>p.status==='approved'&&p.sameReference&&p.sameMode&&p.sameSeller);
  if(approved&&before.status==='pending_payment'){await this.applyPayment(approved.payment);after=await this.row(registrationId);}
  const message=!found.length?'Mercado Pago no tiene pagos con la referencia de esta inscripción. Revisa que el pago se haya hecho desde su botón «Pagar con Mercado Pago».'
   :after.status==='confirmed'?'Pago aprobado verificado con Mercado Pago. La inscripción quedó confirmada.'
   :approved&&after.status==='payment_review'?'El pago está aprobado, pero llegó después de vencer la reserva: queda para revisión.'
   :approved?'El pago aprobado ya estaba aplicado.'
   :found.some((p:InspectedPayment)=>p.status==='approved')?'Hay un pago aprobado, pero no corresponde a esta cuenta o entorno de pagos.'
   :`Mercado Pago informa el pago como «${found[0].status}${found[0].statusDetail?` · ${found[0].statusDetail}`:''}».`;
  return {status:after.status,message,payments};
 }
 async list(user:EventActor,eventId:string){
  const event=(await this.db.query('SELECT * FROM arm_app.event_programs WHERE id=$1',[eventId])).rows[0];
  if(!event)throw new NotFoundException('Evento no encontrado');assertEventScope(user,{campus_id:event.campus_id,organizer_id:event.organizer_id});
  return (await this.db.query(`SELECT r.id,r.participant,r.email,c.name AS "campusName",CASE WHEN r.status='pending_payment' AND r.expires_at<=now() THEN 'expired' ELSE r.status END AS status,r.amount,r.currency,r.payment_id AS "paymentId",(r.amount>0 AND coalesce(r.snapshot->>'paymentMode','test')='test') AS "testPayment",r.created_at AS "createdAt" FROM arm_app.event_registrations r JOIN arm_app.campuses c ON c.id=r.campus_id WHERE r.event_id=$1 ORDER BY r.created_at DESC LIMIT 500`,[eventId])).rows;
 }
}
