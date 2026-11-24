import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { EventAttendanceService } from './event-attendance.service';
import { CheckInDto, ManualRegistrationDto } from './event-attendance.dto';
import { EventRegistrationService } from './event-registration.service';
import { EventPaymentService } from './event-payment.service';

const EVENT='11111111-1111-4111-8111-111111111111';
const TICKET='22222222-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
const admin={sub:1,campusId:10,permissions:['eventos:manageAll']};
const door={sub:5,campusId:20,permissions:['eventos:checkin']};

function setup(opts:{status?:string;checkedIn?:boolean;participating?:boolean;eventStatus?:string;conflict?:boolean}={}){
 const reg:any={id:TICKET,event_id:EVENT,status:opts.status??'confirmed',checked_in_at:opts.checkedIn?new Date():null,participant:{firstName:'Ana',lastName:'Pérez'},email:'ana@example.com',amount:'5000',payment_id:'999',campus_id:10};
 const event={id:EVENT,campus_id:10,organizer_id:1,status:opts.eventStatus??'published',title:'Retiro',slug:'retiro',details:{pricing:'paid',timezone:'America/Santiago'}};
 const notify=vi.fn().mockResolvedValue(true);
 const query=vi.fn(async(sql:string,v:any[]=[])=>{
  if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[event]};
  if(sql.startsWith('SELECT 1 FROM arm_app.event_program_campuses'))return {rows:opts.participating?[{x:1}]:[]};
  if(sql.startsWith('UPDATE arm_app.event_registrations SET checked_in_at=now()')){
   if(v[0]===reg.id&&reg.status==='confirmed'&&!reg.checked_in_at){reg.checked_in_at=new Date();reg.checked_in_by=v[2];return {rows:[{id:reg.id}]};}
   return {rows:[]};
  }
  if(sql.startsWith('UPDATE arm_app.event_registrations SET checked_in_at=NULL')){if(reg.checked_in_at){reg.checked_in_at=null;return {rows:[{id:reg.id}]};}return {rows:[]};}
  if(sql.startsWith("UPDATE arm_app.event_registrations SET status='cancelled'")){if(reg.status!=='cancelled'){reg.status='cancelled';return {rows:[{id:reg.id,order_id:'order-1',amount:reg.amount}]};}return {rows:[]};}
  // La compra queda anulada cuando ya no le quedan entradas vigentes.
  if(sql.startsWith("UPDATE arm_app.event_orders o SET status='cancelled'"))return {rows:[{payment_id:reg.payment_id}]};
  if(sql.startsWith('SELECT o.* FROM arm_app.event_registrations r JOIN'))return {rows:v[0]===reg.id?[{id:'order-1',status:reg.status,email:reg.email,expires_at:null}]:[]};
  if(sql.includes('WHERE r.event_id=$1 AND r.ticket_code=$2'))return {rows:v[1]===(reg.ticket_code??reg.id)?[{...reg,participant:reg.participant,checkedInAt:reg.checked_in_at,status:reg.status}]:[]};
  if(sql.includes('WHERE r.event_id=$1 AND r.id=$2'))return {rows:v[1]===reg.id?[{...reg,participant:reg.participant,checkedInAt:reg.checked_in_at,status:reg.status}]:[]};
  if(sql.startsWith('SELECT * FROM arm_app.event_registrations WHERE id=$1 AND event_id=$2'))return {rows:v[0]===reg.id?[reg]:[]};
  if(sql.startsWith('SELECT count(*) FILTER'))return {rows:[{confirmed:3,checkedIn:reg.checked_in_at?1:0}]};
  if(sql.startsWith('SELECT name FROM arm_app.event_ticket_types'))return {rows:[{name:'General'}]};
  if(sql.trim().startsWith('INSERT INTO arm_app.event_orders'))return {rows:[{id:v[0],status:'confirmed',email:v[4]}]};
  if(sql.trim().startsWith('INSERT INTO arm_app.event_registrations')){
   Object.assign(reg,{id:v[0],status:'confirmed',email:v[4],participant:JSON.parse(v[5]),snapshot:JSON.parse(v[6])});return {rows:[{...reg}]};
  }
  return {rows:[]};
 });
 const db={query,transaction:async(fn:any)=>fn({query})};
 const resendOrder=vi.fn().mockResolvedValue(true);
 const promoteWaitlist=vi.fn().mockResolvedValue([]);
 const registrations={notify,resendOrder,promoteWaitlist} as unknown as EventRegistrationService;
 return {service:new EventAttendanceService(db as any,registrations),query,notify,resendOrder,promoteWaitlist,reg};
}

describe('Control de ingreso',()=>{
 it('registra el ingreso una sola vez y avisa si la entrada ya se usó',async()=>{
  const x=setup();
  const first=await x.service.checkIn(admin,EVENT,TICKET);
  expect(first.result).toBe('ok');expect(first.message).toContain('Ana');expect(first.counts.checkedIn).toBe(1);
  const again=await x.service.checkIn(admin,EVENT,`ARM ${TICKET.toUpperCase()}`);
  expect(again.result).toBe('already');
 });
 it('rechaza entradas sin pago confirmado, anuladas o en lista de espera',async()=>{
  for(const [status,text] of [['pending_payment','pago'],['cancelled','anulada'],['waitlisted','espera']]){
   const r=await setup({status}).service.checkIn(admin,EVENT,TICKET);
   expect(r.result).toBe('invalid');expect(r.message).toContain(text);
  }
 });
 it('no acepta códigos de otro evento ni texto sin código',async()=>{
  const x=setup();
  expect((await x.service.checkIn(admin,EVENT,OTHER)).result).toBe('not_found');
  expect((await x.service.checkIn(admin,EVENT,'hola')).result).toBe('not_found');
 });
 it('no registra ingresos en un evento cancelado',async()=>{
  expect((await setup({eventStatus:'cancelled'}).service.checkIn(admin,EVENT,TICKET)).result).toBe('invalid');
 });
 it('quien está en la puerta solo trabaja en eventos de su campus y no modifica inscripciones',async()=>{
  await expect(setup().service.checkIn(door,EVENT,TICKET)).rejects.toThrow(/tu campus/);
  const x=setup({participating:true});
  expect((await x.service.checkIn(door,EVENT,TICKET)).result).toBe('ok');
  expect((await x.service.attendees(door,EVENT)).manage).toBe(false);
  await expect(x.service.cancel(door,EVENT,TICKET)).rejects.toThrow();
  await expect(x.service.resend(door,EVENT,TICKET)).rejects.toThrow();
  await expect(x.service.checkIn({sub:9,campusId:20,permissions:[]},EVENT,TICKET)).rejects.toThrow();
 });
 it('deshace un ingreso registrado por error',async()=>{
  const x=setup({checkedIn:true});
  const r=await x.service.undoCheckIn(admin,EVENT,TICKET);
  expect(r.counts.checkedIn).toBe(0);
  await expect(x.service.undoCheckIn(admin,EVENT,TICKET)).rejects.toThrow(/no tenía/);
 });
});

describe('Acciones del equipo organizador',()=>{
 it('agrega una cortesía confirmada, sin cobro, y envía la entrada si se pide',async()=>{
  const x=setup({participating:true});
  const r=await x.service.addManual(admin,EVENT,{firstName:' Luis ',lastName:'Soto',email:'LUIS@example.com',campusId:20,ticketTypeId:TICKET,sendEmail:true,note:'Staff'});
  // Una compra sin cobro hecha por el equipo, con una sola entrada.
  const order=x.query.mock.calls.find(([sql])=>sql.trim().startsWith('INSERT INTO arm_app.event_orders'))!;
  expect(order[0]).toContain("'confirmed',0,0,0,'CLP','manual'");
  const insert=x.query.mock.calls.find(([sql])=>sql.trim().startsWith('INSERT INTO arm_app.event_registrations'))!;
  expect(insert[0]).toContain("'confirmed',0,'CLP','manual'");
  expect(insert[1][4]).toBe('luis@example.com');expect(JSON.parse(insert[1][6]).ticketName).toBe('General');
  expect(insert[1][9]).toBe(order[1][0]);expect(insert[1][10]).toBe(TICKET);
  expect(x.notify).toHaveBeenCalledTimes(1);expect(r.emailSent).toBe(true);
 });
 it('no agrega personas a un evento cancelado',async()=>{
  await expect(setup({eventStatus:'cancelled'}).service.addManual(admin,EVENT,{firstName:'A',lastName:'B',email:'a@b.cl',campusId:10,sendEmail:false})).rejects.toThrow(/cancelado/);
 });
 it('anula, libera el cupo y recuerda devolver el pago en Mercado Pago',async()=>{
  const x=setup();
  const r=await x.service.cancel(admin,EVENT,TICKET);
  expect(r.message).toContain('Mercado Pago');expect(x.reg.status).toBe('cancelled');
  expect(x.promoteWaitlist).toHaveBeenCalledWith(EVENT);
  await expect(x.service.cancel(admin,EVENT,TICKET)).rejects.toThrow(/ya estaba anulada/);
 });
 it('reenvía la entrada aunque ya se haya enviado antes',async()=>{
  const x=setup();
  const r=await x.service.resend(admin,EVENT,TICKET);
  expect(x.resendOrder).toHaveBeenCalledWith('order-1');expect(r.message).toContain('ana@example.com');
 });
 it('valida los datos que llegan desde el panel',async()=>{
  const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
  const ok={firstName:'A',lastName:'B',email:'a@b.cl',campusId:1,sendEmail:false};
  await expect(pipe.transform(ok,{type:'body',metatype:ManualRegistrationDto})).resolves.toBeTruthy();
  for(const body of [{...ok,amount:1000},{...ok,status:'cancelled'},{...ok,email:'x'},{...ok,sendEmail:'yes'}])await expect(pipe.transform(body,{type:'body',metatype:ManualRegistrationDto})).rejects.toThrow();
  await expect(pipe.transform({code:''},{type:'body',metatype:CheckInDto})).rejects.toThrow();
 });
});

describe('Correo de la entrada',()=>{
 it('adjunta el QR de la entrada confirmada como imagen incrustada',async()=>{
  const config={get:(k:string)=>({EVENT_REGISTRATION_SECRET:'x'.repeat(40),FRONTEND_URL:'https://example.com'}[k])};
  const mail={sendHtml:vi.fn().mockResolvedValue({id:'m'})};
  const ticket={id:TICKET,status:'confirmed',participant:{firstName:'Ana',lastName:'Pérez'},snapshot:{ticketName:'General'}};
  const query=vi.fn(async(sql:string)=>({rows:sql.includes('WHERE order_id')?[ticket]:[{title:'Retiro',starts_at:new Date(),details:{}}]}));
  const service=new EventRegistrationService({query} as any,config as any,new EventPaymentService(config as any),mail as any);
  const order={id:'order-1',event_id:EVENT,status:'confirmed',email:'ana@example.com',buyer:{firstName:'Ana'},snapshot:{slug:'retiro',title:'Retiro',startsAt:new Date().toISOString()},amount:0,discount:0,currency:'CLP',confirmation_sent_at:new Date()};
  expect(await service.notify(order)).toBe(true);expect(mail.sendHtml).not.toHaveBeenCalled();
  expect(await service.notify(order,{force:true})).toBe(true);
  const sent=mail.sendHtml.mock.calls[0][0];
  expect(sent.html).toContain('cid:entrada-qr-1');
  expect(sent.html).toContain('Ana Pérez · General');
  expect(sent.attachments[0]).toMatchObject({filename:'entrada-qr-1.png',content_id:'entrada-qr-1'});
  expect(Buffer.from(sent.attachments[0].content,'base64').subarray(1,4).toString()).toBe('PNG');
  expect(sent.idempotencyKey).toMatch(/confirmed\/\d+$/);
 });
});

describe('Entradas transferidas',()=>{
 it('el QR anterior a la transferencia ya no permite entrar',async()=>{
  const NEW='66666666-6666-4666-8666-666666666666';
  const row={id:TICKET,participant:{firstName:'Luis',lastName:'Rojas'},status:'confirmed',amount:'0',transferredAt:new Date(),ticketCode:NEW};
  const query=vi.fn(async(sql:string,v:any[]=[])=>{
   if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[{id:EVENT,campus_id:10,organizer_id:1,status:'published',details:{}}]};
   if(sql.includes('r.ticket_code=$2'))return {rows:v[1]===NEW?[row]:[]};
   if(sql.includes('r.id=$2'))return {rows:v[1]===TICKET?[row]:[]};
   if(sql.startsWith('SELECT count(*) FILTER'))return {rows:[{confirmed:1,checkedIn:0}]};
   return {rows:[]};
  });
  const service=new EventAttendanceService({query,transaction:async(fn:any)=>fn({query})} as any,{} as any);
  const r=await service.checkIn(admin,EVENT,TICKET);
  expect(r.result).toBe('invalid');expect(r.message).toContain('transferida a Luis Rojas');
 });
});
