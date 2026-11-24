import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import * as QRCode from 'qrcode';
import { DatabaseService } from '../common/database/database.service';
import { ResendMailerService } from '../auth/resend-mailer.service';
import { EventPaymentService, InspectedPayment } from './event-payment.service';
import { renderEventEmail, EmailKind } from './event-email';
import { RegistrationDto } from './event-registration.dto';
import { assertEventScope, EventActor, eventAccess } from './event-program.rules';
import { CodeRow, Question, TicketRow, cleanAnswers, codeAppliesTo, codeProblem, priceOrder, saleState, ticketSummary } from './event-order.rules';

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
 /** El enlace de seguimiento firma el ID de la compra (antes, de la inscripción: es el mismo ID). */
 token(id:string){return createHmac('sha256',this.settings().secret).update(`event-registration:${id}`).digest('hex');}
 private async order(id:string,db:Db=this.db){const r=(await db.query('SELECT * FROM arm_app.event_orders WHERE id=$1',[id])).rows[0];if(!r)throw new NotFoundException('Inscripción no encontrada');return r;}
 private async tickets(orderId:string,db:Db=this.db){return (await db.query('SELECT * FROM arm_app.event_registrations WHERE order_id=$1 ORDER BY created_at,id',[orderId])).rows;}
 private authorize(id:string,token:string){const expected=this.token(id);if(!/^[a-f0-9]{64}$/.test(token)||!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(token,'hex')))throw new NotFoundException('Inscripción no encontrada');}
 private view(order:any,tickets:any[]){
  const expired=order.status==='pending_payment'&&Date.parse(order.expires_at)<=Date.now();
  const status=expired?'expired':order.status;
  return {id:order.id,token:this.token(order.id),status,buyerName:fullName(order.buyer),title:order.snapshot.title,startsAt:order.snapshot.startsAt,timezone:order.snapshot.timezone,
   subtotal:Number(order.subtotal),discount:Number(order.discount),amount:Number(order.amount),currency:order.currency,code:order.snapshot.code??null,summary:order.snapshot.ticketSummary??order.snapshot.ticketName??null,
   expiresAt:order.expires_at,emailSent:!!(order.status==='confirmed'?order.confirmation_sent_at:order.email_sent_at),testPayment:Number(order.amount)>0&&(order.snapshot.paymentMode??'test')==='test',
   tickets:tickets.map(t=>{const st=t.status==='cancelled'?'cancelled':status;return {id:t.id,name:fullName(t.participant),ticketName:t.snapshot?.ticketName??'Entrada',amount:Number(t.amount),status:st,code:st==='confirmed'?t.id:null};})};
 }

 async register(slug:string,dto:RegistrationDto){
  this.settings();
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
  const event=(await this.db.query('SELECT status FROM arm_app.event_programs WHERE id=$1',[order.event_id])).rows[0];
  if(event?.status==='cancelled')order.status='cancelled';
  return this.view(order,await this.tickets(id));
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
 async notify(order:any,options:{force?:boolean}={}):Promise<boolean>{
  const confirmed=order.status==='confirmed';
  if(!options.force&&(confirmed?order.confirmation_sent_at:order.email_sent_at))return true;
  const link=`${this.settings().origin}/eventos/${encodeURIComponent(order.snapshot.slug)}/inscripcion#id=${order.id}&token=${this.token(order.id)}`;
  const testPayment=Number(order.amount)>0&&(order.snapshot.paymentMode??'test')==='test';
  try{
   // Datos vigentes del evento (portada, lugar, color y remitente); si falta algo, se usa la foto de la compra.
   const event=(await this.db.query('SELECT e.title,e.starts_at,e.ends_at,e.details,c.name AS campus_name FROM arm_app.event_programs e LEFT JOIN arm_app.campuses c ON c.id=e.campus_id WHERE e.id=$1',[order.event_id])).rows[0];
   const d=event?.details??{};
   const tickets=confirmed?(await this.tickets(order.id)).filter((t:any)=>t.status==='confirmed'):[];
   const kind:EmailKind=confirmed?'confirmed':order.status==='pending_payment'?'pending_payment':order.status==='waitlisted'?'waitlisted':'registered';
   const shown=tickets.map((t:any,i:number)=>({name:fullName(t.participant),ticketName:t.snapshot?.ticketName??'Entrada',code:t.id,qrCid:`entrada-qr-${i+1}`}));
   const mail=renderEventEmail({
    kind,firstName:order.buyer?.firstName??'',link,origin:this.settings().origin,tickets:shown,
    amount:Number(order.amount),discount:Number(order.discount)||0,currency:order.currency,ticketName:order.snapshot.ticketSummary??order.snapshot.ticketName,expiresAt:order.expires_at?new Date(order.expires_at).toISOString():null,testPayment,senderName:d.senderName,
    event:{title:event?.title??order.snapshot.title,summary:d.summary,bannerUrl:d.bannerUrl,color:d.color,
     startsAt:new Date(event?.starts_at??order.snapshot.startsAt).toISOString(),endsAt:event?.ends_at?new Date(event.ends_at).toISOString():undefined,
     timezone:d.timezone??order.snapshot.timezone,modality:d.modality,location:d.location,address:d.address,campusName:event?.campus_name},
   });
   // Cada QR va como imagen adjunta (cid:) para no exponer los códigos en URLs públicas.
   const attachments=await Promise.all(shown.map(async(t:any)=>({filename:`${t.qrCid}.png`,content:(await QRCode.toBuffer(t.code,{type:'png',width:360,margin:1,errorCorrectionLevel:'M'})).toString('base64'),content_id:t.qrCid})));
   const key=`event-registration/${order.id}/${confirmed?'confirmed':'registered'}${options.force?`/${Date.now()}`:''}`;
   await this.mail.sendHtml({to:[order.email],subject:mail.subject,text:mail.text,html:mail.html,sender:{name:d.senderName,email:d.senderEmail},idempotencyKey:key,attachments:attachments.length?attachments:undefined});
   await this.db.query(`UPDATE arm_app.event_orders SET ${confirmed?'confirmation_sent_at':'email_sent_at'}=now() WHERE id=$1`,[order.id]);
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
    if(row.payment_id===id)await setStatus('payment_review');
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
}
