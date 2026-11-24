import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { EventRegistrationService } from './event-registration.service';
import { EventPaymentService } from './event-payment.service';
import { EventProgramService } from './event-program.service';
import { selfService } from './event-order.rules';

const ORDER='11111111-1111-4111-8111-111111111111',T1='22222222-2222-4222-8222-222222222222',T2='33333333-3333-4333-8333-333333333333',EVENT='44444444-4444-4444-8444-444444444444';
const SECRET='x'.repeat(40);
const config={get:(k:string)=>({EVENT_REGISTRATION_SECRET:SECRET,FRONTEND_URL:'https://example.com',EVENT_PAYMENTS_MODE:'test',MERCADOPAGO_TEST_ACCESS_TOKEN:'mock',MERCADOPAGO_WEBHOOK_SECRET:'s',CRON_SECRET:'cron-secret-1234567890'} as any)[k]};
const token=(id:string)=>createHmac('sha256',SECRET).update(`event-registration:${id}`).digest('hex');
const future=new Date(Date.now()+10*86400_000).toISOString();

/** Base de datos simulada con una compra de dos entradas. */
function world(o:{details?:any;orderStatus?:string;checkedIn?:boolean;startsAt?:string;amount?:number}={}){
 const event:any={id:EVENT,slug:'retiro',title:'Retiro',status:'published',starts_at:o.startsAt??future,ends_at:o.startsAt??future,capacity:null,details:{pricing:(o.amount??0)>0?'paid':'free',timezone:'America/Santiago',...o.details}};
 const order:any={id:ORDER,event_id:EVENT,status:o.orderStatus??'confirmed',email:'buyer@example.com',buyer:{firstName:'Ana',lastName:'Soto'},snapshot:{title:'Retiro',slug:'retiro'},amount:o.amount??0,subtotal:o.amount??0,discount:0,currency:'CLP',confirmation_sent_at:new Date()};
 const tickets:any[]=[T1,T2].map((id,i)=>({id,order_id:ORDER,event_id:EVENT,status:order.status,ticket_code:id,participant:{firstName:i?'Tomás':'Ana',lastName:'Soto'},snapshot:{ticketName:'General'},email:'buyer@example.com',checked_in_at:o.checkedIn&&!i?new Date():null,amount:0}));
 const mail={sendHtml:vi.fn().mockResolvedValue({id:'m'})};
 const query=vi.fn(async(sql:string,v:any[]=[])=>{
  sql=sql.trim();
  if(sql.startsWith('SELECT * FROM arm_app.event_orders WHERE id'))return {rows:[order]};
  if(sql.startsWith('SELECT * FROM arm_app.event_programs')||sql.startsWith('SELECT status,details,starts_at'))return {rows:[event]};
  if(sql.startsWith('SELECT * FROM arm_app.event_registrations WHERE id=$1 AND order_id'))return {rows:tickets.filter(t=>t.id===v[0])};
  if(sql.startsWith('SELECT * FROM arm_app.event_registrations WHERE order_id'))return {rows:tickets};
  if(sql.startsWith('UPDATE arm_app.event_registrations SET participant')){const t=tickets.find(x=>x.id===v[0]);Object.assign(t,{participant:JSON.parse(v[1]),email:v[2],ticket_code:'55555555-5555-4555-8555-555555555555',transferred_at:new Date()});return {rows:[t]};}
  if(sql.startsWith("UPDATE arm_app.event_registrations SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE id=$1")){const t=tickets.find(x=>x.id===v[0]&&x.status==='confirmed'&&!x.checked_in_at);if(t)t.status='cancelled';return {rows:t?[{id:t.id}]:[]};}
  if(sql.startsWith("UPDATE arm_app.event_orders o SET status='cancelled'")){if(tickets.every(t=>t.status==='cancelled'))order.status='cancelled';return {rows:[]};}
  if(sql.startsWith("UPDATE arm_app.event_orders SET status='cancelled'")){order.status='cancelled';return {rows:[]};}
  if(sql.startsWith("UPDATE arm_app.event_registrations SET status='cancelled',cancelled_at=now(),updated_at=now() WHERE order_id")){tickets.forEach(t=>t.status='cancelled');return {rows:[]};}
  if(sql.includes("status='waitlisted' ORDER BY"))return {rows:[]};
  if(sql.startsWith('SELECT e.title'))return {rows:[event]};
  return {rows:[]};
 });
 const service=new EventRegistrationService({query,transaction:async(fn:any)=>fn({query})} as any,config as any,new EventPaymentService(config as any),mail as any);
 return {service,query,mail,order,tickets,event};
}

describe('Autogestión: reglas',()=>{
 it('por defecto se puede transferir; cancelar solo en eventos gratuitos; hasta 24 h antes',()=>{
  const start='2027-01-10T12:00:00Z';
  expect(selfService({pricing:'free'},start,Date.parse('2027-01-09T11:00:00Z'))).toMatchObject({transfer:true,cancel:true,open:true});
  expect(selfService({pricing:'paid'},start,Date.parse('2027-01-09T11:00:00Z'))).toMatchObject({cancel:false});
  expect(selfService({pricing:'free'},start,Date.parse('2027-01-09T13:00:00Z')).open).toBe(false);
  expect(selfService({pricing:'paid',selfCancel:true,selfTransfer:false,selfServiceHours:2},start,Date.parse('2027-01-10T09:00:00Z'))).toMatchObject({transfer:false,cancel:true,open:true});
 });
});

describe('Transferir una entrada',()=>{
 it('cambia el titular, renueva el QR y envía la entrada a quien la recibe',async()=>{
  const x=world();
  const r=await x.service.transfer(ORDER,token(ORDER),T2,{firstName:'Luis',lastName:'Rojas',email:'LUIS@example.com'});
  const sql=x.query.mock.calls.find(([q])=>q.startsWith('UPDATE arm_app.event_registrations SET participant'))!;
  expect(sql[0]).toContain('ticket_code=gen_random_uuid()');
  expect(x.tickets[1]).toMatchObject({email:'luis@example.com',participant:{firstName:'Luis',transferredFrom:'Tomás Soto'}});
  const sent=x.mail.sendHtml.mock.calls[0][0];
  expect(sent.to).toEqual(['luis@example.com']);expect(sent.subject).toContain('Te transfirieron una entrada');
  expect(sent.html).toContain('Luis Rojas · General');expect(sent.attachments[0].content_id).toBe('entrada-qr-1');
  expect(r.tickets.find((t:any)=>t.id===T2)).toMatchObject({name:'Luis Rojas',transferred:true,code:'55555555-5555-4555-8555-555555555555'});
 });
 it('respeta la configuración del evento, el plazo y las entradas ya usadas',async()=>{
  await expect(world({details:{selfTransfer:false}}).service.transfer(ORDER,token(ORDER),T2,{firstName:'L',lastName:'R'})).rejects.toThrow(/no permite transferir/);
  await expect(world({startsAt:new Date(Date.now()+3600_000).toISOString()}).service.transfer(ORDER,token(ORDER),T2,{firstName:'L',lastName:'R'})).rejects.toThrow(/plazo/);
  await expect(world({checkedIn:true}).service.transfer(ORDER,token(ORDER),T1,{firstName:'L',lastName:'R'})).rejects.toThrow(/ya se usó/);
  await expect(world({orderStatus:'pending_payment'}).service.transfer(ORDER,token(ORDER),T1,{firstName:'L',lastName:'R'})).rejects.toThrow(/confirmadas/);
  await expect(world().service.transfer(ORDER,'f'.repeat(64),T1,{firstName:'L',lastName:'R'})).rejects.toThrow(/no encontrada/);
 });
});

describe('Cancelar desde el comprobante',()=>{
 it('en un evento gratuito cancela una entrada; con la última se cancela la compra y se avisa',async()=>{
  const x=world();const promote=vi.spyOn(x.service,'promoteWaitlist').mockResolvedValue([]);
  await x.service.cancelBySelf(ORDER,token(ORDER),T1);
  expect(x.tickets.map(t=>t.status)).toEqual(['cancelled','confirmed']);expect(x.order.status).toBe('confirmed');
  await x.service.cancelBySelf(ORDER,token(ORDER),T2);
  expect(x.order.status).toBe('cancelled');expect(promote).toHaveBeenCalledWith(EVENT);
  expect(x.mail.sendHtml.mock.calls.at(-1)[0].subject).toContain('Cancelaste tu entrada');
 });
 it('un evento pagado no permite cancelar por defecto, pero una reserva sin pagar sí se cancela completa',async()=>{
  await expect(world({amount:1000}).service.cancelBySelf(ORDER,token(ORDER),T1)).rejects.toThrow(/no permite cancelar/);
  const x=world({amount:1000,orderStatus:'pending_payment'});vi.spyOn(x.service,'promoteWaitlist').mockResolvedValue([]);
  await x.service.cancelBySelf(ORDER,token(ORDER));
  expect(x.order.status).toBe('cancelled');expect(x.tickets.every(t=>t.status==='cancelled')).toBe(true);
 });
});

describe('Lista de espera automática',()=>{
 function waitlist(capacity:number,used:number,orders:any[],tickets:Record<string,any[]>){
  const updates:any[]=[];const mail={sendHtml:vi.fn().mockResolvedValue({id:'m'})};
  const event={id:EVENT,slug:'retiro',title:'Retiro',status:'published',starts_at:future,ends_at:future,capacity,details:{pricing:'paid',timezone:'America/Santiago'}};
  const query=vi.fn(async(sql:string,v:any[]=[])=>{
   sql=sql.trim();
   if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[event]};
   if(sql.includes("status='waitlisted' ORDER BY"))return {rows:orders};
   if(sql.startsWith('SELECT count(*) FROM arm_app.event_registrations'))return {rows:[{count:used}]};
   if(sql.startsWith('SELECT * FROM arm_app.event_ticket_types'))return {rows:[]};
   if(sql.startsWith("SELECT * FROM arm_app.event_registrations WHERE order_id=$1 AND status='waitlisted'"))return {rows:tickets[v[0]]??[]};
   if(sql.startsWith('UPDATE arm_app.event_orders SET status=$2,expires_at=$3,promoted_at')){updates.push(v);const o=orders.find(x=>x.id===v[0]);Object.assign(o,{status:v[1],expires_at:v[2]});return {rows:[]};}
   if(sql.startsWith('SELECT * FROM arm_app.event_orders WHERE id'))return {rows:[orders.find(x=>x.id===v[0])]};
   if(sql.startsWith('SELECT * FROM arm_app.event_registrations WHERE order_id'))return {rows:[]};
   if(sql.startsWith('SELECT e.title'))return {rows:[event]};
   return {rows:[]};
  });
  const service=new EventRegistrationService({query,transaction:async(fn:any)=>fn({query})} as any,config as any,new EventPaymentService(config as any),mail as any);
  return {service,updates,mail};
 }
 const order=(id:string,amount:number)=>({id,event_id:EVENT,status:'waitlisted',amount,subtotal:amount,discount:0,currency:'CLP',email:`${id}@example.com`,buyer:{firstName:id},snapshot:{title:'Retiro',slug:'retiro',paymentMode:amount?'test':'free'}});
 it('por orden de llegada: confirma la gratuita, reserva la pagada y nadie se salta la fila',async()=>{
  const a=order('a',0),b=order('b',5000),c=order('c',0);
  const x=waitlist(5,2,[a,b,c],{a:[{}],b:[{},{}],c:[{},{}]});
  const done=await x.service.promoteWaitlist(EVENT);
  expect(done).toEqual(['a','b']);
  expect(x.updates.map(u=>[u[0],u[1]])).toEqual([['a','confirmed'],['b','pending_payment']]);
  expect(x.updates[1][2]).toBeTruthy();expect(c.status).toBe('waitlisted');
  expect(x.mail.sendHtml.mock.calls.map((m:any)=>m[0].subject)).toEqual([expect.stringContaining('Tu entrada está confirmada'),expect.stringContaining('Se liberó un cupo para ti')]);
 });
 it('sin cupos libres no mueve a nadie',async()=>{
  const x=waitlist(2,2,[order('a',0)],{a:[{}]});
  expect(await x.service.promoteWaitlist(EVENT)).toEqual([]);
 });
});

describe('Mis entradas',()=>{
 function mine(found:boolean){
  const mail={sendHtml:vi.fn().mockResolvedValue({id:'m'})};
  const query=vi.fn(async(sql:string,v:any[]=[])=>{
   if(sql.startsWith('SELECT 1 FROM arm_app.event_orders'))return {rows:found?[{x:1}]:[]};
   if(sql.trim().startsWith('SELECT o.*,e.title'))return {rows:[{id:ORDER,status:'confirmed',amount:0,currency:'CLP',snapshot:{ticketSummary:'2 × General'},title:'Retiro',slug:'retiro',starts_at:future,ends_at:future,event_status:'published',event_details:{timezone:'America/Santiago'},active_tickets:2,email:v[0]}]};
   return {rows:[]};
  });
  return {service:new EventRegistrationService({query} as any,config as any,new EventPaymentService(config as any),mail as any),mail,query};
 }
 it('envía el enlace solo si hay compras y responde igual en ambos casos',async()=>{
  const yes=mine(true),no=mine(false);
  const a=await yes.service.sendTicketsLink(' Ana@Example.com ');const b=await no.service.sendTicketsLink('otra@example.com');
  expect(a).toEqual(b);
  expect(no.mail.sendHtml).not.toHaveBeenCalled();
  const sent=yes.mail.sendHtml.mock.calls[0][0];expect(sent.to).toEqual(['ana@example.com']);
  expect(sent.html).toMatch(/\/mis-entradas#token=/);
 });
 it('el enlace firmado muestra las compras; uno alterado o vencido no',async()=>{
  const x=mine(true);await x.service.sendTicketsLink('ana@example.com');
  const link=/#token=([^"&]+)"/.exec(x.mail.sendHtml.mock.calls[0][0].html)![1];
  const r=await x.service.myTickets(link);
  expect(r.email).toBe('ana@example.com');expect(r.orders[0]).toMatchObject({id:ORDER,tickets:2,summary:'2 × General',token:token(ORDER),upcoming:true});
  const [b64,exp,sig]=link.split('.');
  await expect(x.service.myTickets(`${Buffer.from('otra@example.com').toString('base64url')}.${exp}.${sig}`)).rejects.toThrow(/no es válido/);
  const old=`${b64}.${Date.now()-1000}`;const oldSig=createHmac('sha256',SECRET).update(`my-tickets:${old}`).digest('base64url');
  await expect(x.service.myTickets(`${old}.${oldSig}`)).rejects.toThrow(/venció/);
 });
});

describe('Tarea diaria',()=>{
 it('solo corre con el secreto de Vercel Cron',()=>{
  const s=world().service;
  expect(()=>s.assertCron('Bearer cron-secret-1234567890')).not.toThrow();
  expect(()=>s.assertCron('Bearer otro')).toThrow();expect(()=>s.assertCron(undefined)).toThrow();
  const missing=new EventRegistrationService({} as any,{get:()=>undefined} as any,{} as any,{} as any);
  expect(()=>missing.assertCron('Bearer x')).toThrow(/no está configurada/);
 });
 it('envía el recordatorio del día anterior una sola vez, con las entradas',async()=>{
  const x=world();
  x.query.mockImplementation(async(sql:string)=>{
   sql=sql.trim();
   if(sql.startsWith('SELECT DISTINCT event_id'))return {rows:[]};
   if(sql.includes("interval '30 hours' LIMIT"))return {rows:[x.order]};
   if(sql.includes("interval '7 days'"))return {rows:[]};
   if(sql.startsWith('SELECT * FROM arm_app.event_registrations WHERE order_id'))return {rows:x.tickets};
   if(sql.startsWith('SELECT e.title'))return {rows:[x.event]};
   return {rows:[]};
  });
  const r=await x.service.runDaily();
  expect(r).toMatchObject({reminders:1,dayCandidates:1});
  const sent=x.mail.sendHtml.mock.calls[0][0];expect(sent.subject).toContain('¡Mañana es el día!');expect(sent.attachments).toHaveLength(2);
  expect(x.query.mock.calls.some(([q])=>q.includes('SET reminder_day_sent_at=now()'))).toBe(true);
 });
});

describe('Catálogo público',()=>{
 it('muestra el rango de precios y si quedan cupos',async()=>{
  const query=vi.fn(async()=>({rows:[{slug:'retiro',title:'Retiro',starts_at:future,ends_at:future,capacity:10,occupied:10,status:'published',published_at:new Date(),registration_status:'open',details:{pricing:'paid',waitlist:false,timezone:'America/Santiago'},campus_name:'Santiago',category_name:'Retiros',campuses:['Santiago','Viña'],min_price:'8000',max_price:'12000'}]}));
  const [e]=await new EventProgramService({query} as any).publicList();
  expect(e).toMatchObject({slug:'retiro',minPrice:8000,maxPrice:12000,soldOut:true,capacityLeft:0,campuses:['Santiago','Viña'],registrationEnabled:true});
 });
});
