import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { EventInsightsService, npsScore } from './event-insights.service';
import { EventMessageDto, SurveyAnswerDto } from './event-insights.dto';
import { EventRegistrationService } from './event-registration.service';
import { EventPaymentService } from './event-payment.service';

const EVENT='11111111-1111-4111-8111-111111111111',ORDER='22222222-2222-4222-8222-222222222222',T1='33333333-3333-4333-8333-333333333333',T2='44444444-4444-4444-8444-444444444444';
const SECRET='x'.repeat(40);
const config={get:(k:string)=>({EVENT_REGISTRATION_SECRET:SECRET,FRONTEND_URL:'https://example.com',EVENT_PAYMENTS_MODE:'test',MERCADOPAGO_TEST_ACCESS_TOKEN:'mock',MERCADOPAGO_WEBHOOK_SECRET:'s'} as any)[k]};
const admin={sub:1,campusId:10,permissions:['eventos:manageAll','eventos:refund']};
const past=new Date(Date.now()-86400_000).toISOString();

function world(o:{refundPermission?:boolean;paymentId?:string|null;refunded?:number;ended?:boolean;surveySent?:boolean;emails?:string[];checkedIn?:boolean}={}){
 const event:any={id:EVENT,slug:'retiro',title:'Retiro',campus_id:10,organizer_id:1,status:'published',published_at:new Date(),starts_at:past,ends_at:o.ended===false?new Date(Date.now()+86400_000).toISOString():past,survey_sent_at:o.surveySent?new Date():null,details:{timezone:'America/Santiago',color:'#102b40'}};
 const order:any={id:ORDER,event_id:EVENT,status:'confirmed',amount:20000,refunded_amount:o.refunded??0,payment_id:o.paymentId===undefined?'987654':o.paymentId,currency:'CLP',email:'ana@example.com',buyer:{firstName:'Ana',lastName:'Soto'},snapshot:{paymentMode:'test',title:'Retiro',slug:'retiro'}};
 const tickets:any[]=[{id:T1,order_id:ORDER,event_id:EVENT,status:'confirmed',amount:15000,refunded_at:null},{id:T2,order_id:ORDER,event_id:EVENT,status:'confirmed',amount:5000,refunded_at:null}];
 const responses:any[]=[];const updates:string[]=[];
 const query=vi.fn(async(sql:string,v:any[]=[])=>{
  sql=sql.trim();
  if(sql.startsWith('SELECT * FROM arm_app.event_programs WHERE id'))return {rows:[event]};
  if(sql.startsWith('SELECT * FROM arm_app.event_programs WHERE slug'))return {rows:[event]};
  if(sql.startsWith('SELECT * FROM arm_app.event_registrations WHERE id=$1 AND event_id'))return {rows:tickets.filter(t=>t.id===v[0])};
  if(sql.startsWith('SELECT * FROM arm_app.event_registrations WHERE order_id'))return {rows:tickets.filter(t=>!t.refunded_at)};
  if(sql.startsWith('SELECT * FROM arm_app.event_orders WHERE id'))return {rows:[order]};
  if(sql.startsWith('UPDATE arm_app.event_orders SET refunded_amount')){order.refunded_amount+=v[1];updates.push('order');return {rows:[]};}
  if(sql.startsWith("UPDATE arm_app.event_registrations SET status='cancelled'")){for(const t of tickets)if(v[0].includes(t.id)){t.status='cancelled';t.refunded_at=new Date();}return {rows:[]};}
  if(sql.startsWith("UPDATE arm_app.event_orders o SET status='cancelled'")){if(tickets.every(t=>t.status==='cancelled'))order.status='cancelled';return {rows:[]};}
  if(sql.startsWith('SELECT lower(r.email)'))return {rows:(o.emails??['ana@example.com','luis@example.com']).map(email=>({email}))};
  if(sql.startsWith('SELECT email FROM arm_app.users'))return {rows:[{email:'equipo@armglobal.org'}]};
  if(sql.startsWith('INSERT INTO arm_app.event_messages'))return {rows:[{id:'msg-1'}]};
  if(sql.startsWith('SELECT 1 FROM arm_app.event_registrations WHERE event_id=$1 AND checked_in_at'))return {rows:o.checkedIn?[{x:1}]:[]};
  if(sql.startsWith('SELECT DISTINCT lower(email)'))return {rows:(o.emails??['ana@example.com','luis@example.com']).map(email=>({email}))};
  if(sql.startsWith('UPDATE arm_app.event_programs SET survey_sent_at')){event.survey_sent_at=new Date();return {rows:[]};}
  if(sql.startsWith('SELECT 1 FROM arm_app.event_survey_responses'))return {rows:responses.some(r=>r.hash===v[1])?[{x:1}]:[]};
  if(sql.startsWith('INSERT INTO arm_app.event_survey_responses')){if(responses.some(r=>r.hash===v[1]))return {rows:[]};responses.push({hash:v[1],rating:v[2],nps:v[3],liked:v[4]});return {rows:[{id:'r'}]};}
  if(sql.startsWith('SELECT rating,nps'))return {rows:responses.map(r=>({rating:r.rating,nps:r.nps,liked:r.liked}))};
  return {rows:[]};
 });
 const mail={sendHtml:vi.fn().mockResolvedValue({id:'m'}),sendBatch:vi.fn(async(m:any[])=>({sent:m.length,failed:0}))};
 const payments=new EventPaymentService(config as any);
 const refund=vi.spyOn(payments,'refund').mockImplementation(async(_id:string,amount:number)=>({id:`rf-${amount}`,amount,status:'approved'}));
 const registrations=new EventRegistrationService({query,transaction:async(fn:any)=>fn({query})} as any,config as any,payments,mail as any);
 const notify=vi.spyOn(registrations,'notify').mockResolvedValue(true);
 const promote=vi.spyOn(registrations,'promoteWaitlist').mockResolvedValue([]);
 const service=new EventInsightsService({query,transaction:async(fn:any)=>fn({query})} as any,registrations,payments,mail as any);
 return {service,query,mail,refund,notify,promote,order,tickets,event,responses,registrations};
}

describe('Devoluciones con Mercado Pago',()=>{
 it('devuelve una entrada por su monto, la anula y avisa a quien compró',async()=>{
  const x=world();
  const r=await x.service.refund(admin,EVENT,T2,false);
  expect(x.refund).toHaveBeenCalledWith('987654',5000,`event-refund/${ORDER}/${T2}/0`);
  expect(x.order.refunded_amount).toBe(5000);expect(x.tickets[1].status).toBe('cancelled');expect(x.tickets[0].status).toBe('confirmed');
  expect(x.order.status).toBe('confirmed');
  expect(x.notify).toHaveBeenCalledWith(expect.objectContaining({amount:5000}),{force:true,kind:'refunded'});
  expect(x.promote).toHaveBeenCalledWith(EVENT);
  expect(r.message).toContain('Devolvimos $5.000 a Ana Soto');
  await expect(x.service.refund(admin,EVENT,T2,false)).rejects.toThrow(/ya fue devuelta/);
 });
 it('devuelve lo que queda de la compra y la anula completa',async()=>{
  const x=world({refunded:5000});x.tickets[1].refunded_at=new Date();x.tickets[1].status='cancelled';
  await x.service.refund(admin,EVENT,T1,true);
  expect(x.refund).toHaveBeenCalledWith('987654',15000,`event-refund/${ORDER}/all/5000`);
  expect(x.order.status).toBe('cancelled');
  await expect(x.service.refund(admin,EVENT,T1,true)).rejects.toThrow(/No queda monto/);
 });
 it('exige el permiso de devolución y un pago de Mercado Pago',async()=>{
  await expect(world().service.refund({...admin,permissions:['eventos:manageAll']},EVENT,T1,false)).rejects.toThrow(/permiso/);
  await expect(world({paymentId:null}).service.refund(admin,EVENT,T1,false)).rejects.toThrow(/no tiene un pago/);
  const x=world();await expect(x.service.refund({sub:9,campusId:99,permissions:['eventos:refund','eventos:manageCampus']},EVENT,T1,false)).rejects.toThrow();
  expect(x.refund).not.toHaveBeenCalled();
 });
 it('si Mercado Pago rechaza la devolución no cambia nada',async()=>{
  const x=world();x.refund.mockRejectedValueOnce(new Error('Mercado Pago indica que este pago ya fue devuelto.'));
  await expect(x.service.refund(admin,EVENT,T1,false)).rejects.toThrow(/ya fue devuelto/);
  expect(x.order.refunded_amount).toBe(0);expect(x.tickets[0].status).toBe('confirmed');expect(x.notify).not.toHaveBeenCalled();
 });
 it('el aviso de Mercado Pago de una devolución ya registrada no deja la compra en revisión',async()=>{
  const row:any={id:ORDER,event_id:EVENT,amount:20000,refunded_amount:5000,currency:'CLP',preference_id:'p',payment_id:'987654',status:'confirmed',expires_at:'2030-01-01T00:00:00Z',snapshot:{paymentMode:'test'},buyer:{firstName:'Ana'},confirmation_sent_at:new Date()};
  const statuses:string[]=[];
  const query=vi.fn(async(sql:string,v:any[]=[])=>{
   if(sql.startsWith('SELECT event_id'))return {rows:[{event_id:EVENT}]};
   if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[{status:'published'}]};
   if(sql.startsWith('SELECT * FROM arm_app.event_orders'))return {rows:[row]};
   if(sql.startsWith('UPDATE arm_app.event_orders SET status=$2'))statuses.push(v[1]);
   return {rows:[]};
  });
  const payments={payment:vi.fn(),assertRegistrationMode:()=>undefined};
  const service=new EventRegistrationService({query,transaction:async(fn:any)=>fn({query})} as any,config as any,payments as any,{sendHtml:vi.fn()} as any);
  payments.payment.mockResolvedValue({external_reference:ORDER,status:'approved',transaction_amount:20000,transaction_amount_refunded:5000,currency_id:'CLP'});
  await service.webhook('987654','req','sig');expect(statuses).toEqual([]);
  payments.payment.mockResolvedValue({external_reference:ORDER,status:'approved',transaction_amount:20000,transaction_amount_refunded:9000,currency_id:'CLP'});
  await service.webhook('987654','req','sig');expect(statuses).toEqual(['payment_review']);
 });
});

describe('Mensajes a los inscritos',()=>{
 const msg={subject:'Cambio de horario',body:'Hola:\n\nEmpezamos a las 10:00.',audience:'confirmed' as const};
 it('cuenta destinatarios, envía una prueba y luego a todos por lotes',async()=>{
  const x=world();
  expect(await x.service.sendMessage(admin,EVENT,{...msg,dryRun:true})).toEqual({recipients:2});
  const test=await x.service.sendMessage(admin,EVENT,{...msg,test:true});
  expect(test).toMatchObject({to:'equipo@armglobal.org'});
  expect(x.mail.sendHtml.mock.calls[0][0].subject).toBe('[Prueba] Cambio de horario · Retiro');
  const r=await x.service.sendMessage(admin,EVENT,msg);
  expect(r).toMatchObject({recipients:2,sent:2,failed:0});
  const [mails,opts]=x.mail.sendBatch.mock.calls[0];
  expect(mails.map((m:any)=>m.to)).toEqual(['ana@example.com','luis@example.com']);
  expect(mails[0].html).toContain('Empezamos a las 10:00.');expect(opts.idempotencyKey).toBe('event-message/msg-1');
  const sql=x.query.mock.calls.find(([q])=>q.trim().startsWith('SELECT lower(r.email)'))![0];
  expect(sql).toContain("r.status='confirmed'");
 });
 it('el texto del organizador se escapa y no se envía a más de 2000 personas',async()=>{
  const x=world();
  await x.service.sendMessage(admin,EVENT,{...msg,body:'<script>alert(1)</script>'});
  expect(x.mail.sendBatch.mock.calls[0][0][0].html).toContain('&lt;script&gt;');
  await expect(world({emails:Array.from({length:2001},(_,i)=>`p${i}@example.com`)}).service.sendMessage(admin,EVENT,msg)).rejects.toThrow(/máximo/);
  await expect(world({emails:[]}).service.sendMessage(admin,EVENT,msg)).rejects.toThrow(/No hay personas/);
 });
 it('valida audiencia y largo',async()=>{
  const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
  await expect(pipe.transform(msg,{type:'body',metatype:EventMessageDto})).resolves.toBeTruthy();
  for(const body of [{...msg,audience:'todos'},{...msg,subject:''},{...msg,body:'x'.repeat(5001)},{...msg,html:'<b>'}])await expect(pipe.transform(body,{type:'body',metatype:EventMessageDto})).rejects.toThrow();
 });
});

describe('Encuesta posterior al evento',()=>{
 const link=(html:string)=>{const m=/#e=([^&"]+)&amp;t=([^"&]+)"/.exec(html)!;return {e:m[1],t:m[2]};};
 it('se envía una vez al terminar, con un enlace personal y anónimo',async()=>{
  await expect(world({ended:false}).service.sendSurvey(EVENT,admin)).rejects.toThrow(/cuando el evento termina/);
  await expect(world({surveySent:true}).service.sendSurvey(EVENT,admin)).rejects.toThrow(/ya se envió/);
  const x=world({checkedIn:true});
  const r=await x.service.sendSurvey(EVENT,admin);
  expect(r).toMatchObject({recipients:2,sent:2});
  expect(x.query.mock.calls.some(([q])=>q.includes('AND checked_in_at IS NOT NULL'))).toBe(true);
  const mails=x.mail.sendBatch.mock.calls[0][0];
  expect(mails[0].subject).toBe('¿Cómo te fue en Retiro? · Retiro');
  expect(link(mails[0].html)).not.toEqual(link(mails[1].html));
 });
 it('acepta una respuesta por persona y rechaza enlaces alterados',async()=>{
  const x=world();await x.service.sendSurvey(EVENT,admin);
  const {e,t}=link(x.mail.sendBatch.mock.calls[0][0][0].html);
  expect(await x.service.surveyInfo('retiro',e,t)).toMatchObject({title:'Retiro',answered:false});
  await x.service.answerSurvey('retiro',{e,t,rating:5,nps:10,liked:' La alabanza '});
  expect(x.responses[0]).toMatchObject({rating:5,nps:10,liked:'La alabanza'});
  expect(x.responses[0].hash).not.toContain('ana');
  await expect(x.service.answerSurvey('retiro',{e,t,rating:3})).rejects.toThrow(/Ya respondiste/);
  expect((await x.service.surveyInfo('retiro',e,t)).answered).toBe(true);
  const other=Buffer.from('luis@example.com').toString('base64url');
  await expect(x.service.surveyInfo('retiro',other,t)).rejects.toThrow(/no es válido/);
 });
 it('resume calificación, NPS y comentarios',async()=>{
  const x=world();
  for(const [rating,nps] of [[5,10],[4,9],[2,3],[5,8]])x.responses.push({hash:`h${rating}${nps}`,rating,nps,liked:rating===5?'Todo':null});
  const r=await x.service.surveyResults(admin,EVENT);
  expect(r).toMatchObject({responses:4,rating:4,distribution:[0,1,0,1,2]});
  expect(r.nps).toEqual({score:25,promoters:2,passives:1,detractors:1,answered:4});
  expect(r.comments).toHaveLength(2);
  expect(npsScore([])).toBeNull();
 });
 it('valida la respuesta pública',async()=>{
  const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
  const ok={e:'YW5h',t:'a'.repeat(43),rating:4};
  await expect(pipe.transform(ok,{type:'body',metatype:SurveyAnswerDto})).resolves.toBeTruthy();
  for(const body of [{...ok,rating:6},{...ok,nps:11},{...ok,t:'corto'},{...ok,email:'x@y.z'}])await expect(pipe.transform(body,{type:'body',metatype:SurveyAnswerDto})).rejects.toThrow();
 });
});

describe('Panel de ventas',()=>{
 it('reúne totales, ventas por día, por entrada, por campus y códigos',async()=>{
  const event={id:EVENT,campus_id:10,organizer_id:1,title:'Retiro',starts_at:past,capacity:100,details:{timezone:'America/Santiago',pricing:'paid'}};
  const rows:Record<string,any[]>={
   orders:[{confirmed:3,collected:'45000',testCollected:'1000',discounts:'5000',refunded:'5000',pendingOrders:1,pendingAmount:'10000',waitlistedOrders:0,reviewOrders:0}],
   tickets:[{confirmed:5,checkedIn:2,pending:1,waitlisted:0,cancelled:1,courtesy:1}],
   day:[{day:'2026-11-20',tickets:2,amount:'20000'},{day:'2026-11-21',tickets:3,amount:'25000'}],
   types:[{id:'g',name:'General',capacity:80,price:'10000',archived:false},{id:'old',name:'Preventa',capacity:null,price:'8000',archived:true}],
   sold:[{ticket_type_id:'g',name:'General',sold:4,pending:1,revenue:'40000'},{ticket_type_id:null,name:'Cortesía',sold:1,pending:0,revenue:'0'}],
   campus:[{name:'Santiago',tickets:5,revenue:'45000'}],
   codes:[{code:'FAMILIA',kind:'percent',value:'25',active:true,uses:2,given:'5000'}],
  };
  const query=vi.fn(async(sql:string)=>{
   if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[event]};
   if(sql.includes('FROM arm_app.event_orders WHERE event_id'))return {rows:rows.orders};
   if(sql.includes('AS courtesy'))return {rows:rows.tickets};
   if(sql.includes("to_char("))return {rows:rows.day};
   if(sql.includes('FROM arm_app.event_ticket_types'))return {rows:rows.types};
   if(sql.includes('GROUP BY ticket_type_id'))return {rows:rows.sold};
   if(sql.includes('JOIN arm_app.campuses'))return {rows:rows.campus};
   if(sql.includes('event_discount_codes'))return {rows:rows.codes};
   return {rows:[]};
  });
  const r=await new EventInsightsService({query} as any,{} as any,{} as any,{} as any).sales(admin,EVENT);
  expect(r.totals).toMatchObject({collected:45000,testCollected:1000,refunded:5000,tickets:5,checkedIn:2,pendingAmount:10000,courtesy:1});
  expect(r.byDay).toEqual([{day:'2026-11-20',tickets:2,amount:20000},{day:'2026-11-21',tickets:3,amount:25000}]);
  expect(r.byTicket).toEqual([{name:'General',capacity:80,price:10000,sold:4,pending:1,revenue:40000},{name:'Cortesías y otras',capacity:null,price:0,sold:1,pending:0,revenue:0}]);
  expect(r.codes[0]).toEqual({code:'FAMILIA',kind:'percent',value:25,active:true,uses:2,given:5000});
 });
});

