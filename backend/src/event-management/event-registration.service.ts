import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import * as QRCode from 'qrcode';
import { DatabaseService } from '../common/database/database.service';
import { ResendMailerService } from '../auth/resend-mailer.service';
import { EventPaymentService, InspectedPayment } from './event-payment.service';
import { renderEventEmail, renderTicketsLinkEmail, EmailKind } from './event-email';
import { RegistrationDto } from './event-registration.dto';
import { EventWalletService } from './event-wallet.service';
import { assertEventScope, EventActor, eventAccess } from './event-program.rules';
import { CodeRow, Question, TicketRow, cleanAnswers, codeAppliesTo, codeProblem, priceOrder, saleState, selfService, ticketSummary } from './event-order.rules';

// Una compra (event_orders) reúne a quien compra, el total y el pago de Mercado Pago;
// cada entrada (event_registrations) es un asistente con su propio código QR.
// Las inscripciones anteriores a las compras tienen una compra con su mismo ID.

export function registrationsOpen(event:any,now=Date.now()){
 const d=event.details;
 return event.status==='published'&&!!event.published_at&&event.registration_status==='open'&&now<new Date(event.ends_at).getTime()&&(!d.registrationOpensAt||now>=Date.parse(d.registrationOpensAt))&&(!d.registrationClosesAt||now<Date.parse(d.registrationClosesAt))&&(d.pricing!=='paid'||!d.paymentDueAt||now<Date.parse(d.paymentDueAt));
}
type Db={query:(sql:string,values?:unknown[])=>Promise<{rows:any[]}>};
/** Entradas que ocupan cupo: confirmadas o con una reserva de pago vigente. */
export const OCCUPYING="(status='confirmed' OR (status='pending_payment' AND expires_at>now()))";
/** Cupos ocupados por tipo de entrada. */
export async function soldByTicket(db:Db,eventId:string){
 const rows=(await db.query(`SELECT ticket_type_id,count(*)::int AS n FROM arm_app.event_registrations WHERE event_id=$1 AND ticket_type_id IS NOT NULL AND ${OCCUPYING} GROUP BY ticket_type_id`,[eventId])).rows;
 return new Map<string,number>(rows.map((r:any)=>[r.ticket_type_id,Number(r.n)]));
}
/** Veces que se usó un código: compras confirmadas o con reserva vigente. */
export async function codeUses(db:Db,codeId:string){
 return Number((await db.query(`SELECT count(*)::int AS n FROM arm_app.event_orders WHERE discount_code_id=$1 AND ${OCCUPYING}`,[codeId])).rows[0]?.n??0);
}
const fullName=(p:any)=>`${p?.firstName??''} ${p?.lastName??''}`.trim();

@Injectable()
export class EventRegistrationService {
 constructor(private readonly db:DatabaseService,private readonly config:ConfigService,private readonly payments:EventPaymentService,private readonly mail:ResendMailerService,@Optional() private readonly wallet?:EventWalletService){}
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
 /** Dominio público (https) para enlaces en correos. */
 publicOrigin(){return this.settings().origin;}
 /** Firma corta (HMAC) para enlaces sin cuenta, como la encuesta. */
 sign(text:string){return createHmac('sha256',this.settings().secret).update(text).digest('base64url');}
 /** El enlace de seguimiento firma el ID de la compra (antes, de la inscripción: es el mismo ID). */
 token(id:string){return createHmac('sha256',this.settings().secret).update(`event-registration:${id}`).digest('hex');}
 private async order(id:string,db:Db=this.db){const r=(await db.query('SELECT * FROM arm_app.event_orders WHERE id=$1',[id])).rows[0];if(!r)throw new NotFoundException('Inscripción no encontrada');return r;}
 private async tickets(orderId:string,db:Db=this.db){return (await db.query('SELECT * FROM arm_app.event_registrations WHERE order_id=$1 ORDER BY created_at,id',[orderId])).rows;}
 private authorize(id:string,token:string){const expected=this.token(id);if(!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(token,'hex')))throw new NotFoundException('Inscripción no encontrada');}
 private view(order:any,tickets:any[],event?:any){
  const expired=order.status==='pending_payment'&&Date.parse(order.expires_at)<=Date.now();
  const status=expired?'expired':order.status;
  return {id:order.id,token:this.token(order.id),status,buyerName:fullName(order.buyer),title:order.snapshot.title,startsAt:order.snapshot.startsAt,timezone:order.snapshot.timezone,
   subtotal:Number(order.subtotal),discount:Number(order.discount),amount:Number(order.amount),currency:order.currency,code:order.snapshot.code??null,summary:order.snapshot.ticketSummary??order.snapshot.ticketName??null,
   expiresAt:order.expires_at,emailSent:!!(order.status==='confirmed'?order.confirmation_sent_at:order.email_sent_at),testPayment:Number(order.amount)>0&&(order.snapshot.paymentMode??'test')==='test',
   tickets:tickets.map(t=>{const st=t.status==='cancelled'?'cancelled':status;return {id:t.id,name:fullName(t.participant),ticketName:t.snapshot?.ticketName??'Entrada',amount:Number(t.amount),status:st,code:st==='confirmed'?(t.ticket_code??t.id):null,wallet:st==='confirmed'?this.wallet?.links(t.id,t.ticket_code??t.id)??{}:{},checkedIn:!!t.checked_in_at,transferred:!!t.transferred_at};}),
   selfService:event?selfService(event.details,event.starts_at):null};
 }

 async register(slug:string,dto:RegistrationDto){
  this.settings();
  // Si se liberaron cupos, la lista de espera tiene prioridad sobre las nuevas inscripciones.
  const target=(await this.db.query('SELECT id FROM arm_app.event_programs WHERE slug=$1',[slug])).rows[0];
  if(target)await this.promoteWaitlist(target.id).catch(()=>[]);
  if(!dto.firstName.trim()||!dto.lastName.trim())throw new BadRequestException('Completa tu nombre y apellido');
  const email=dto.email.trim().toLowerCase();const requestHash=createHash('sha256').update(dto.requestKey).digest('hex');
  let order:any;
  try{order=await this.db.transaction(async db=>{
   const event=(await db.query('SELECT * FROM arm_app.event_programs WHERE slug=$1 FOR UPDATE',[slug])).rows[0];
   if(!event)throw new NotFoundException('Evento no encontrado');
   const old=(await db.query('SELECT * FROM arm_app.event_orders WHERE event_id=$1 AND request_hash=$2',[event.id,requestHash])).rows[0];
   if(old)return old;
   if(!registrationsOpen(event))throw new BadRequestException('Las inscripciones no están abiertas en este momento');
   const d=event.details;
   const campus=(await db.query('SELECT c.id FROM arm_app.event_program_campuses ec JOIN arm_app.campuses c ON c.id=ec.campus_id WHERE ec.event_id=$1 AND c.id=$2 AND c."isActive"=true',[event.id,dto.campusId])).rows[0];
   if(!campus)throw new BadRequestException('Selecciona un campus participante');

   // Código de descuento o de acceso: bloqueado para contar sus usos sin carreras.
   let code:CodeRow|null=null;
   if(dto.code?.trim()){
    const found=(await db.query('SELECT * FROM arm_app.event_discount_codes WHERE event_id=$1 AND code=$2 FOR UPDATE',[event.id,dto.code.trim().toUpperCase()])).rows[0];
    const problem=codeProblem(found,found?await codeUses(db,found.id):0);
    if(problem)throw new BadRequestException(problem);
    code=found;
   }

   // Entradas: tipo válido, a la venta, dentro del máximo por compra y con cupo propio.
   const types:TicketRow[]=(await db.query('SELECT * FROM arm_app.event_ticket_types WHERE event_id=$1 AND NOT archived ORDER BY position',[event.id])).rows;
   const byId=new Map(types.map(t=>[t.id,t]));
   const items=dto.items.map((item,i)=>{
    const who=`la entrada ${i+1}`;
    let ticket:TicketRow|null=null;
    if(types.length){
     ticket=byId.get(item.ticketTypeId??'')??null;
     if(!ticket)throw new BadRequestException(`Elige el tipo de ${who}`);
     if(ticket.hidden&&!codeAppliesTo(code,ticket.id))throw new BadRequestException(`La entrada «${ticket.name}» requiere un código`);
     const sale=saleState(ticket);
     if(sale!=='on')throw new BadRequestException(sale==='soon'?`La entrada «${ticket.name}» todavía no está a la venta`:`La venta de «${ticket.name}» terminó`);
    }else if(item.ticketTypeId)throw new BadRequestException('Este evento no tiene tipos de entrada');
    if(d.pricing==='paid'&&ticket&&(ticket.currency!=='CLP'||!Number.isInteger(Number(ticket.price))))throw new BadRequestException('Selecciona una entrada válida en pesos chilenos');
    if(!item.firstName.trim()||!item.lastName.trim())throw new BadRequestException(`Completa nombre y apellido de ${who}`);
    if(d.minimumAge!=null&&(item.age==null||item.age<d.minimumAge))throw new BadRequestException(`La edad mínima es ${d.minimumAge} años (${who})`);
    return {item,ticket,answers:cleanAnswers(d.questions as Question[]|undefined,item.answers,who)};
   });
   const sold=await soldByTicket(db,event.id);
   for(const t of types){
    const wanted=items.filter(x=>x.ticket?.id===t.id).length;
    if(!wanted)continue;
    if(wanted>(t.max_per_order??10))throw new BadRequestException(`Puedes comprar hasta ${t.max_per_order} entradas «${t.name}» por compra`);
    const left=t.capacity==null?Infinity:Math.max(Number(t.capacity)-(sold.get(t.id)??0),0);
    if(wanted>left)throw new ConflictException(left?`Solo quedan ${left} entradas «${t.name}».`:`Se agotaron las entradas «${t.name}».`);
   }
   if(!types.length&&items.length>10)throw new BadRequestException('Puedes inscribir hasta 10 personas por compra');

   await db.query("UPDATE arm_app.event_orders SET status='expired',updated_at=now() WHERE event_id=$1 AND status='pending_payment' AND expires_at<=now()",[event.id]);
   await db.query("UPDATE arm_app.event_registrations SET status='expired',updated_at=now() WHERE event_id=$1 AND status='pending_payment' AND expires_at<=now()",[event.id]);
   const count=Number((await db.query("SELECT count(*) FROM arm_app.event_registrations WHERE event_id=$1 AND status IN ('confirmed','pending_payment')",[event.id])).rows[0].count);
   const left=event.capacity==null?Infinity:Math.max(event.capacity-count,0);
   const full=items.length>left;
   if(full&&!d.waitlist)throw new ConflictException(left?`Solo quedan ${left} cupos.`:'Los cupos se agotaron.');

   const price=priceOrder(items,code,d.pricing==='paid'?'Entrada':'Entrada gratuita');
   if(price.amount>0)this.assertConfigured('paid');
   const status=full?'waitlisted':price.amount>0?'pending_payment':'confirmed';
   const expires=status==='pending_payment'?new Date(Math.min(Date.now()+24*60*60*1000,new Date(event.ends_at).getTime(),d.paymentDueAt?Date.parse(d.paymentDueAt):Infinity)).toISOString():null;
   const paymentMode=price.amount>0?this.paymentMode():'free';
   const base={paymentMode,collectorId:paymentMode==='production'?this.config.get('MERCADOPAGO_COLLECTOR_ID'):null,title:event.title,slug:event.slug,startsAt:event.starts_at,timezone:d.timezone,conditions:d.conditions,cancellationPolicy:d.cancellationPolicy,eventVersion:event.version,consentAt:new Date().toISOString()};
   const summary=ticketSummary(price.lines);
   const orderId=randomUUID();
   const buyer={firstName:dto.firstName.trim(),lastName:dto.lastName.trim(),phone:dto.phone};
   const row=(await db.query(`INSERT INTO arm_app.event_orders(id,event_id,campus_id,request_hash,email,buyer,snapshot,status,subtotal,discount,amount,currency,discount_code_id,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'CLP',$12,$13) RETURNING *`,
    [orderId,event.id,dto.campusId,requestHash,email,JSON.stringify(buyer),JSON.stringify({...base,ticketSummary:summary,ticketName:summary,code:code?.code??null}),status,price.subtotal,price.discount,price.amount,code?.id??null,expires])).rows[0];
   for(const [i,{item,ticket,answers}] of items.entries()){
    const participant={firstName:item.firstName.trim(),lastName:item.lastName.trim(),phone:i===0?dto.phone:'',age:item.age??null};
    await db.query(`INSERT INTO arm_app.event_registrations(id,event_id,campus_id,request_hash,email,participant,snapshot,status,amount,currency,expires_at,order_id,ticket_type_id,answers)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'CLP',$10,$11,$12,$13)`,
     [randomUUID(),event.id,dto.campusId,createHash('sha256').update(`${requestHash}:${i}`).digest('hex'),item.email?.trim().toLowerCase()||email,JSON.stringify(participant),JSON.stringify({...base,ticketName:price.lines[i].ticketName}),status,price.lines[i].amount,expires,orderId,ticket?.id??null,JSON.stringify(answers)]);
   }
   return row;
  });}catch(e){if((e as any).code==='23505')throw new ConflictException('Ya recibimos esta inscripción. Revisa tu correo o vuelve a intentarlo en unos segundos.');throw e;}
  await this.notify(order);
  return this.view(await this.order(order.id),await this.tickets(order.id));
 }
 async get(id:string,token:string){
  this.authorize(id,token);const order=await this.reconcile(await this.order(id));
  const event=(await this.db.query('SELECT status,details,starts_at FROM arm_app.event_programs WHERE id=$1',[order.event_id])).rows[0];
  if(event?.status==='cancelled')order.status='cancelled';
  return this.view(order,await this.tickets(id),event?.status==='published'?event:undefined);
 }
 async checkout(id:string,token:string){
  this.authorize(id,token);
  return this.db.transaction(async db=>{
   const row=(await db.query('SELECT * FROM arm_app.event_orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!row||row.status!=='pending_payment'||Date.parse(row.expires_at)<=Date.now())throw new BadRequestException('Esta inscripción no tiene un pago pendiente vigente');
   const event=(await db.query('SELECT status FROM arm_app.event_programs WHERE id=$1',[row.event_id])).rows[0];
   if(event.status!=='published')throw new BadRequestException('El evento no admite pagos');
   this.payments.assertConfigured();
   this.payments.assertRegistrationMode(row);
   if(row.checkout_url)return {url:row.checkout_url};
   const checkout=await this.payments.checkout(row,this.settings().origin);
   await db.query('UPDATE arm_app.event_orders SET preference_id=$2,checkout_url=$3,updated_at=now() WHERE id=$1',[id,checkout.id,checkout.url]);
   return {url:checkout.url};
  });
 }
 /** Envía el correo del estado de la compra a quien compró. Sin `force` se envía una sola vez; devuelve si quedó enviado. */
 async notify(order:any,options:{force?:boolean;kind?:EmailKind}={}):Promise<boolean>{
  const confirmed=order.status==='confirmed';
  if(!options.force&&(confirmed?order.confirmation_sent_at:order.email_sent_at))return true;
  const reminder=options.kind==='reminder_week'||options.kind==='reminder_day';
  const link=`${this.settings().origin}/eventos/${encodeURIComponent(order.snapshot.slug)}/inscripcion#id=${order.id}&token=${this.token(order.id)}`;
  const testPayment=Number(order.amount)>0&&(order.snapshot.paymentMode??'test')==='test';
  try{
   // Datos vigentes del evento (portada, lugar, color y remitente); si falta algo, se usa la foto de la compra.
   const event=(await this.db.query('SELECT e.title,e.starts_at,e.ends_at,e.details,c.name AS campus_name FROM arm_app.event_programs e LEFT JOIN arm_app.campuses c ON c.id=e.campus_id WHERE e.id=$1',[order.event_id])).rows[0];
   const d=event?.details??{};
   const tickets=confirmed?(await this.tickets(order.id)).filter((t:any)=>t.status==='confirmed'):[];
   const kind:EmailKind=options.kind??(confirmed?'confirmed':order.status==='pending_payment'?'pending_payment':order.status==='waitlisted'?'waitlisted':order.status==='cancelled'?'cancelled':'registered');
   const shown=tickets.map((t:any,i:number)=>({name:fullName(t.participant),ticketName:t.snapshot?.ticketName??'Entrada',code:t.ticket_code??t.id,qrCid:`entrada-qr-${i+1}`,wallet:this.wallet?.links(t.id,t.ticket_code??t.id)}));
   const mail=renderEventEmail({
    kind,firstName:order.buyer?.firstName??'',link,origin:this.settings().origin,tickets:shown,
    amount:Number(order.amount),discount:Number(order.discount)||0,currency:order.currency,ticketName:order.snapshot.ticketSummary??order.snapshot.ticketName,expiresAt:order.expires_at?new Date(order.expires_at).toISOString():null,testPayment,senderName:d.senderName,
    event:{title:event?.title??order.snapshot.title,summary:d.summary,bannerUrl:d.bannerUrl,color:d.color,
     startsAt:new Date(event?.starts_at??order.snapshot.startsAt).toISOString(),endsAt:event?.ends_at?new Date(event.ends_at).toISOString():undefined,
     timezone:d.timezone??order.snapshot.timezone,modality:d.modality,location:d.location,address:d.address,campusName:event?.campus_name},
   });
   // Cada QR va como imagen adjunta (cid:) para no exponer los códigos en URLs públicas.
   const attachments=await Promise.all(shown.map(async(t:any)=>({filename:`${t.qrCid}.png`,content:(await QRCode.toBuffer(t.code,{type:'png',width:360,margin:1,errorCorrectionLevel:'M'})).toString('base64'),content_id:t.qrCid})));
   if(reminder&&!shown.length)return false;
   const key=`event-registration/${order.id}/${options.kind??(confirmed?'confirmed':'registered')}${options.force?`/${Date.now()}`:''}`;
   await this.mail.sendHtml({to:[order.email],subject:mail.subject,text:mail.text,html:mail.html,sender:{name:d.senderName,email:d.senderEmail},idempotencyKey:key,attachments:attachments.length?attachments:undefined});
   const column=options.kind==='reminder_week'?'reminder_week_sent_at':options.kind==='reminder_day'?'reminder_day_sent_at':options.kind==='cancelled'||options.kind==='refunded'?null:confirmed?'confirmation_sent_at':'email_sent_at';
   if(column)await this.db.query(`UPDATE arm_app.event_orders SET ${column}=now() WHERE id=$1`,[order.id]);
   return true;
  }catch{/* A failed email never undoes a committed booking; authenticated retry is available. */return false;}
 }
 async resend(id:string,token:string){this.authorize(id,token);await this.notify(await this.order(id));return this.get(id,token);}
 /** Reenvía el correo de la compra a la que pertenece una entrada (para el equipo organizador). */
 async resendOrder(orderId:string){return this.notify(await this.order(orderId),{force:true});}
 /**
  * Si el aviso de Mercado Pago no llegó, se le pregunta directamente por un pago aprobado de esta
  * compra. Pasa por las mismas comprobaciones que el webhook; si Mercado Pago no responde,
  * la compra queda como estaba.
  */
 private async reconcile(order:any){
  if(order.status!=='pending_payment'||!order.preference_id||Number(order.amount)<=0)return order;
  try{
   const approved=(await this.payments.findPayments(order.id)).find((p:any)=>p.status==='approved');
   if(!approved)return order;
   await this.applyPayment(approved);
   return await this.order(order.id);
  }catch{return order;}
 }
 async webhook(id:string,requestId:string,signature:string){
  // payment() ya comprobó que el pago consultado corresponde a este ID.
  return this.applyPayment({...(await this.payments.payment(id,requestId,signature)),id});
 }
 /** Aplica un pago ya verificado con Mercado Pago (llegue por webhook o por consulta directa) a la compra y sus entradas. */
 private async applyPayment(payment:any){
  const id=String(payment.id);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payment.external_reference??''))return {received:true};
  const found=(await this.db.query('SELECT event_id FROM arm_app.event_orders WHERE id=$1',[payment.external_reference])).rows[0];
  if(!found)return {received:true};
  await this.db.transaction(async db=>{
   const event=(await db.query('SELECT * FROM arm_app.event_programs WHERE id=$1 FOR UPDATE',[found.event_id])).rows[0];
   const row=(await db.query('SELECT * FROM arm_app.event_orders WHERE id=$1 FOR UPDATE',[payment.external_reference])).rows[0];
   this.payments.assertRegistrationMode(row);
   if(Number(row.amount)!==Number(payment.transaction_amount)||payment.currency_id!==row.currency||!row.preference_id||Number(row.amount)<=0)throw new BadRequestException('El importe no coincide con la inscripción');
   if(row.payment_id&&row.payment_id!==id)throw new ConflictException('La inscripción ya tiene otro pago asociado');
   const setStatus=async(status:string)=>{
    await db.query('UPDATE arm_app.event_orders SET status=$2,payment_id=$3,updated_at=now() WHERE id=$1',[row.id,status,id]);
    await db.query("UPDATE arm_app.event_registrations SET status=$2,updated_at=now() WHERE order_id=$1 AND status<>'cancelled'",[row.id,status]);
   };
   if(['refunded','charged_back'].includes(payment.status)||Number(payment.transaction_amount_refunded)>0){
    // Una devolución hecha desde el panel ya quedó registrada: solo un contracargo o una devolución
    // mayor a la registrada (hecha fuera del panel) deja la compra para revisión.
    const ours=payment.status!=='charged_back'&&Number(payment.transaction_amount_refunded??row.amount)<=Number(row.refunded_amount??0);
    if(row.payment_id===id&&!ours)await setStatus('payment_review');
    return;
   }
   if(payment.status!=='approved'||row.payment_id===id)return;
   // Late payments require review; never silently grant a cupo after its reservation expired.
   const valid=row.status==='pending_payment'&&Date.parse(row.expires_at)>Date.now()&&event.status==='published';
   await setStatus(valid?'confirmed':'payment_review');
  });
  const row=await this.order(payment.external_reference);
  if(row.status==='confirmed')await this.notify(row);
  return {received:true};
 }
 /** Para el organizador: consulta el pago de la compra de una entrada en Mercado Pago, lo aplica si corresponde y explica el resultado. */
 async verifyPayment(user:EventActor,eventId:string,registrationId:string){
  const event=(await this.db.query('SELECT * FROM arm_app.event_programs WHERE id=$1',[eventId])).rows[0];
  if(!event)throw new NotFoundException('Evento no encontrado');assertEventScope(user,{campus_id:event.campus_id,organizer_id:event.organizer_id});
  const ticket=(await this.db.query('SELECT order_id,event_id FROM arm_app.event_registrations WHERE id=$1',[registrationId])).rows[0];
  if(!ticket||ticket.event_id!==eventId)throw new NotFoundException('Inscripción no encontrada');
  const before=await this.order(ticket.order_id);
  if(Number(before.amount)<=0)return {status:before.status,message:'Esta inscripción no tiene pago.',payments:[]};
  const found:InspectedPayment[]=await this.payments.inspectPayments(before.id);
  const payments=found.map(({payment:_p,...rest}:InspectedPayment)=>rest);
  let after=before;
  const approved=found.find((p:InspectedPayment)=>p.status==='approved'&&p.sameReference&&p.sameMode&&p.sameSeller);
  if(approved&&before.status==='pending_payment'){await this.applyPayment(approved.payment);after=await this.order(before.id);}
  const message=!found.length?'Mercado Pago no tiene pagos con la referencia de esta inscripción. Revisa que el pago se haya hecho desde su botón «Pagar con Mercado Pago».'
   :after.status==='confirmed'?'Pago aprobado verificado con Mercado Pago. La inscripción quedó confirmada.'
   :approved&&after.status==='payment_review'?'El pago está aprobado, pero llegó después de vencer la reserva: queda para revisión.'
   :approved?'El pago aprobado ya estaba aplicado.'
   :found.some((p:InspectedPayment)=>p.status==='approved')?'Hay un pago aprobado, pero no corresponde a esta cuenta o entorno de pagos.'
   :`Mercado Pago informa el pago como «${found[0].status}${found[0].statusDetail?` · ${found[0].statusDetail}`:''}».`;
  return {status:after.status,message,payments};
 }

 // ── Autogestión de quien compró (con el enlace firmado de su compra) ──

 /** Cambia el titular de una entrada confirmada. El QR anterior deja de servir y el nuevo llega a quien la recibe. */
 async transfer(orderId:string,token:string,ticketId:string,dto:{firstName:string;lastName:string;email?:string}){
  this.authorize(orderId,token);
  if(!dto.firstName.trim()||!dto.lastName.trim())throw new BadRequestException('Escribe nombre y apellido de quien recibe la entrada');
  const result=await this.db.transaction(async db=>{
   const order=(await db.query('SELECT * FROM arm_app.event_orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
   if(!order)throw new NotFoundException('Inscripción no encontrada');
   const event=(await db.query('SELECT * FROM arm_app.event_programs WHERE id=$1',[order.event_id])).rows[0];
   const ticket=(await db.query('SELECT * FROM arm_app.event_registrations WHERE id=$1 AND order_id=$2 FOR UPDATE',[ticketId,orderId])).rows[0];
   if(!ticket)throw new NotFoundException('Entrada no encontrada');
   const policy=selfService(event.details,event.starts_at);
   if(event.status!=='published')throw new BadRequestException('El evento no admite cambios');
   if(!policy.transfer)throw new ForbiddenException('Este evento no permite transferir entradas. Escribe al equipo organizador.');
   if(!policy.open)throw new BadRequestException('El plazo para transferir entradas ya terminó.');
   if(order.status!=='confirmed'||ticket.status!=='confirmed')throw new BadRequestException('Solo puedes transferir entradas confirmadas.');
   if(ticket.checked_in_at)throw new BadRequestException('Esta entrada ya se usó para ingresar.');
   const participant={firstName:dto.firstName.trim(),lastName:dto.lastName.trim(),phone:'',age:null,transferredFrom:fullName(ticket.participant)};
   const updated=(await db.query(`UPDATE arm_app.event_registrations SET participant=$2,email=$3,ticket_code=gen_random_uuid(),transferred_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,
    [ticketId,JSON.stringify(participant),dto.email?.trim().toLowerCase()||ticket.email])).rows[0];
   return {updated,event,from:fullName(ticket.participant)};
  });
  if(dto.email?.trim())await this.notifyTransfer(result.updated,result.event,result.from);
  return this.get(orderId,token);
 }
 private async notifyTransfer(ticket:any,event:any,from:string){
  const d=event.details??{};
  try{
   const mail=renderEventEmail({kind:'transferred',firstName:ticket.participant?.firstName??'',link:`${this.settings().origin}/eventos/${encodeURIComponent(event.slug)}`,origin:this.settings().origin,
    tickets:[{name:fullName(ticket.participant),ticketName:ticket.snapshot?.ticketName??'Entrada',code:ticket.ticket_code,qrCid:'entrada-qr-1'}],amount:0,currency:'CLP',ticketName:`${ticket.snapshot?.ticketName??'Entrada'} · de ${from}`,senderName:d.senderName,
    event:{title:event.title,summary:d.summary,bannerUrl:d.bannerUrl,color:d.color,startsAt:new Date(event.starts_at).toISOString(),endsAt:new Date(event.ends_at).toISOString(),timezone:d.timezone,modality:d.modality,location:d.location,address:d.address}});
   const content=(await QRCode.toBuffer(ticket.ticket_code,{type:'png',width:360,margin:1,errorCorrectionLevel:'M'})).toString('base64');
   await this.mail.sendHtml({to:[ticket.email],subject:mail.subject,text:mail.text,html:mail.html,sender:{name:d.senderName,email:d.senderEmail},idempotencyKey:`event-ticket/${ticket.id}/transfer/${ticket.ticket_code}`,attachments:[{filename:'entrada-qr-1.png',content,content_id:'entrada-qr-1'}]});
   return true;
  }catch{return false;}
 }

 /**
  * Cancela una entrada confirmada (si el evento lo permite y está dentro del plazo) o, sin entrada,
  * una reserva pendiente o en espera completa. El cupo liberado pasa a la lista de espera.
  */
 async cancelBySelf(orderId:string,token:string,ticketId?:string){
  this.authorize(orderId,token);
  const eventId=await this.db.transaction(async db=>{
   const order=(await db.query('SELECT * FROM arm_app.event_orders WHERE id=$1 FOR UPDATE',[orderId])).rows[0];
   if(!order)throw new NotFoundException('Inscripción no encontrada');
   const event=(await db.query('SELECT * FROM arm_app.event_programs WHERE id=$1',[order.event_id])).rows[0];
   const policy=selfService(event.details,event.starts_at);
   if(order.status==='cancelled')throw new ConflictException('Esta inscripción ya estaba cancelada.');
   if(order.status==='confirmed'){
    if(!ticketId)throw new BadRequestException('Elige la entrada que quieres cancelar.');
    if(!policy.cancel)throw new ForbiddenException('Este evento no permite cancelar entradas desde aquí. Escribe al equipo organizador.');
    if(!policy.open)throw new BadRequestException('El plazo para cancelar entradas ya terminó.');
    const t=(await db.query("UPDATE arm_app.event_registrations SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE id=$1 AND order_id=$2 AND status='confirmed' AND checked_in_at IS NULL RETURNING id",[ticketId,orderId])).rows[0];
    if(!t)throw new BadRequestException('Esta entrada no se puede cancelar (ya se usó o ya estaba cancelada).');
    await db.query("UPDATE arm_app.event_orders o SET status='cancelled',updated_at=now() WHERE o.id=$1 AND NOT EXISTS(SELECT 1 FROM arm_app.event_registrations r WHERE r.order_id=o.id AND r.status<>'cancelled')",[orderId]);
   }else if(['pending_payment','waitlisted','expired'].includes(order.status)){
    // Una reserva sin pagar se cancela completa: su total corresponde a todas sus entradas.
    await db.query("UPDATE arm_app.event_orders SET status='cancelled',updated_at=now() WHERE id=$1",[orderId]);
    await db.query("UPDATE arm_app.event_registrations SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE order_id=$1 AND status<>'cancelled'",[orderId]);
   }else throw new BadRequestException('Esta inscripción está en revisión: escribe al equipo organizador.');
   return order.event_id as string;
  });
  const order=await this.order(orderId);
  if(order.status==='cancelled')await this.notify(order,{force:true,kind:'cancelled'});
  await this.promoteWaitlist(eventId).catch(()=>[]);
  return this.get(orderId,token);
 }

 /**
  * Pasa compras de la lista de espera (por orden de llegada) a los cupos libres: las gratuitas quedan
  * confirmadas y las pagadas con una reserva nueva para pagar. Avisa por correo a cada una.
  */
 async promoteWaitlist(eventId:string){
  const promoted:string[]=await this.db.transaction(async db=>{
   const event=(await db.query('SELECT * FROM arm_app.event_programs WHERE id=$1 FOR UPDATE',[eventId])).rows[0];
   if(!event||event.status!=='published'||Date.now()>=new Date(event.ends_at).getTime())return [];
   const waiting=(await db.query("SELECT * FROM arm_app.event_orders WHERE event_id=$1 AND status='waitlisted' ORDER BY created_at,id FOR UPDATE",[eventId])).rows;
   if(!waiting.length)return [];
   const d=event.details??{};
   await db.query("UPDATE arm_app.event_orders SET status='expired',updated_at=now() WHERE event_id=$1 AND status='pending_payment' AND expires_at<=now()",[eventId]);
   await db.query("UPDATE arm_app.event_registrations SET status='expired',updated_at=now() WHERE event_id=$1 AND status='pending_payment' AND expires_at<=now()",[eventId]);
   const used=Number((await db.query("SELECT count(*) FROM arm_app.event_registrations WHERE event_id=$1 AND status IN ('confirmed','pending_payment')",[eventId])).rows[0].count);
   let left=event.capacity==null?Infinity:Number(event.capacity)-used;
   const types=new Map<string,any>((await db.query('SELECT * FROM arm_app.event_ticket_types WHERE event_id=$1',[eventId])).rows.map((t:any)=>[t.id,t]));
   const sold=await soldByTicket(db,eventId);
   const paymentClosed=d.paymentDueAt&&Date.now()>=Date.parse(d.paymentDueAt);
   const done:string[]=[];
   for(const order of waiting){
    if(left<=0)break;
    const tickets=(await db.query("SELECT * FROM arm_app.event_registrations WHERE order_id=$1 AND status='waitlisted'",[order.id])).rows;
    if(!tickets.length)continue;
    if(tickets.length>left)break; // por orden de llegada: nadie se salta a quien espera antes
    const need=new Map<string,number>();for(const t of tickets)if(t.ticket_type_id)need.set(t.ticket_type_id,(need.get(t.ticket_type_id)??0)+1);
    const fits=[...need].every(([id,n])=>{const t=types.get(id);return !t?.capacity||(sold.get(id)??0)+n<=Number(t.capacity);});
    if(!fits)break;
    const paid=Number(order.amount)>0;
    if(paid&&(paymentClosed||!['test','production'].includes(order.snapshot?.paymentMode)))continue;
    const status=paid?'pending_payment':'confirmed';
    const expires=paid?new Date(Math.min(Date.now()+24*60*60*1000,new Date(event.ends_at).getTime(),d.paymentDueAt?Date.parse(d.paymentDueAt):Infinity)).toISOString():null;
    await db.query('UPDATE arm_app.event_orders SET status=$2,expires_at=$3,promoted_at=now(),updated_at=now() WHERE id=$1',[order.id,status,expires]);
    await db.query("UPDATE arm_app.event_registrations SET status=$2,expires_at=$3,updated_at=now() WHERE order_id=$1 AND status='waitlisted'",[order.id,status,expires]);
    left-=tickets.length;for(const [id,n] of need)sold.set(id,(sold.get(id)??0)+n);
    done.push(order.id);
   }
   return done;
  });
  for(const id of promoted){const o=await this.order(id);await this.notify(o,o.status==='pending_payment'?{force:true,kind:'spot_opened'}:{});}
  return promoted;
 }

 // ── «Mis entradas»: enlace firmado por correo, sin cuenta ──
 private ticketsToken(email:string,expires:number){
  const payload=`${Buffer.from(email).toString('base64url')}.${expires}`;
  return `${payload}.${createHmac('sha256',this.settings().secret).update(`my-tickets:${payload}`).digest('base64url')}`;
 }
 private ticketsEmail(token:string){
  const [b64,exp,sig]=(token??'').split('.');
  if(!b64||!/^\d+$/.test(exp??'')||!sig)throw new UnauthorizedException('El enlace no es válido. Pide uno nuevo.');
  const expected=createHmac('sha256',this.settings().secret).update(`my-tickets:${b64}.${exp}`).digest();
  const given=Buffer.from(sig,'base64url');
  if(given.length!==expected.length||!timingSafeEqual(given,expected))throw new UnauthorizedException('El enlace no es válido. Pide uno nuevo.');
  if(Date.now()>Number(exp))throw new UnauthorizedException('El enlace venció. Pide uno nuevo.');
  return Buffer.from(b64,'base64url').toString();
 }
 /** Envía el enlace solo si el correo tiene compras; la respuesta es igual en ambos casos. */
 async sendTicketsLink(rawEmail:string){
  const email=rawEmail.trim().toLowerCase();
  const has=(await this.db.query('SELECT 1 FROM arm_app.event_orders WHERE lower(email)=$1 LIMIT 1',[email])).rows.length>0;
  if(has){
   const origin=this.settings().origin;
   const link=`${origin}/mis-entradas#token=${this.ticketsToken(email,Date.now()+24*60*60*1000)}`;
   const mail=renderTicketsLinkEmail({link,origin});
   const minute=Math.floor(Date.now()/60000);
   try{await this.mail.sendHtml({to:[email],subject:mail.subject,html:mail.html,text:mail.text,idempotencyKey:`my-tickets/${createHash('sha256').update(email).digest('hex').slice(0,24)}/${minute}`});}catch{/* misma respuesta */}
  }
  return {message:'Si ese correo tiene inscripciones, te enviamos un enlace para verlas. Revisa tu bandeja de entrada.'};
 }
 async myTickets(token:string){
  const email=this.ticketsEmail(token);
  const rows=(await this.db.query(`SELECT o.*,e.title,e.slug,e.starts_at,e.ends_at,e.status AS event_status,e.details AS event_details,
   (SELECT count(*)::int FROM arm_app.event_registrations r WHERE r.order_id=o.id AND r.status<>'cancelled') AS active_tickets
   FROM arm_app.event_orders o JOIN arm_app.event_programs e ON e.id=o.event_id
   WHERE lower(o.email)=$1 AND e.ends_at>now()-interval '180 days' ORDER BY e.starts_at DESC,o.created_at DESC LIMIT 60`,[email])).rows;
  return {email,orders:rows.map((o:any)=>{
   const d=o.event_details??{};
   const status=o.event_status==='cancelled'?'cancelled':o.status==='pending_payment'&&Date.parse(o.expires_at)<=Date.now()?'expired':o.status;
   return {id:o.id,token:this.token(o.id),status,tickets:Number(o.active_tickets),summary:o.snapshot?.ticketSummary??o.snapshot?.ticketName??null,amount:Number(o.amount),currency:o.currency,
    upcoming:new Date(o.ends_at).getTime()>Date.now(),
    event:{title:o.title,slug:o.slug,startsAt:o.starts_at,endsAt:o.ends_at,timezone:d.timezone,bannerUrl:d.bannerUrl,color:d.color,location:d.modality==='online'?'Evento online':d.location}};
  })};
 }

 // ── Tarea diaria: lista de espera y recordatorios ──
 async runDaily(){
  const events=(await this.db.query(`SELECT DISTINCT event_id FROM arm_app.event_orders o JOIN arm_app.event_programs e ON e.id=o.event_id WHERE o.status='waitlisted' AND e.status='published' AND e.ends_at>now()`)).rows;
  let promoted=0;for(const e of events)promoted+=(await this.promoteWaitlist(e.event_id).catch(()=>[])).length;
  const base=`FROM arm_app.event_orders o JOIN arm_app.event_programs e ON e.id=o.event_id WHERE o.status='confirmed' AND e.status='published' AND coalesce((e.details->>'reminders')::boolean,true)`;
  const day=(await this.db.query(`SELECT o.* ${base} AND o.reminder_day_sent_at IS NULL AND e.starts_at>now() AND e.starts_at<=now()+interval '30 hours' LIMIT 300`)).rows;
  const week=(await this.db.query(`SELECT o.* ${base} AND o.reminder_week_sent_at IS NULL AND o.reminder_day_sent_at IS NULL AND e.starts_at>now()+interval '30 hours' AND e.starts_at<=now()+interval '7 days' AND o.created_at<now()-interval '2 days' LIMIT 300`)).rows;
  let sent=0;
  for(const o of day)if(await this.notify(o,{force:true,kind:'reminder_day'}))sent++;
  for(const o of week)if(await this.notify(o,{force:true,kind:'reminder_week'}))sent++;
  return {promoted,reminders:sent,dayCandidates:day.length,weekCandidates:week.length};
 }
 /** La tarea diaria solo corre con el secreto de Vercel Cron (CRON_SECRET). */
 assertCron(authorization:string|undefined){
  const secret=this.config.get<string>('CRON_SECRET')??'';
  if(secret.length<16)throw new ServiceUnavailableException('La tarea diaria no está configurada.');
  const expected=Buffer.from(`Bearer ${secret}`);const given=Buffer.from(authorization??'');
  if(given.length!==expected.length||!timingSafeEqual(given,expected))throw new UnauthorizedException();
 }
}
