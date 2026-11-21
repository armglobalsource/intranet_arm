import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { ValidationPipe } from '@nestjs/common';
import { RegistrationDto } from './event-registration.dto';
import { EventRegistrationService, registrationsOpen } from './event-registration.service';
import { EventPaymentService, verifyPaymentSignature } from './event-payment.service';
const event={id:'event',status:'published',published_at:new Date(),registration_status:'open',ends_at:'2030-01-02T00:00:00Z',details:{pricing:'free',waitlist:false},capacity:1};
const dto={firstName:'Prueba',lastName:'ARM',email:'test@example.com',phone:'+56912345678',campusId:1,consent:true,requestKey:'a'.repeat(64)};
const config={get:(key:string)=>({EVENT_REGISTRATION_SECRET:'x'.repeat(40),FRONTEND_URL:'https://example.com',EVENT_PAYMENTS_MODE:'test',MERCADOPAGO_TEST_ACCESS_TOKEN:'mock',MERCADOPAGO_WEBHOOK_SECRET:'secret'}[key])};
afterEach(()=>vi.unstubAllGlobals());
function setup(options:{count?:number;waitlist?:boolean;old?:any;paid?:boolean}={}){
 let stored:any;const mail={sendHtml:vi.fn().mockResolvedValue({id:'mail'})};
 const query=vi.fn(async(sql:string,v:any[]=[])=>{
  if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[{...event,details:{...event.details,waitlist:options.waitlist??false,pricing:options.paid?'paid':'free'}}]};
  if(sql.includes('AND request_hash'))return {rows:options.old?[options.old]:[]};
  if(sql.startsWith('SELECT c.id'))return {rows:[{id:1}]};
  if(sql.startsWith('SELECT count'))return {rows:[{count:options.count??0}]};
  if(sql.startsWith('SELECT * FROM arm_app.event_ticket_types'))return {rows:[{price:1000,currency:'CLP',name:'General'}]};
  if(sql.startsWith('INSERT INTO arm_app.event_registrations')){stored={id:v[0],event_id:v[1],campus_id:v[2],email:v[4],participant:JSON.parse(v[5]),snapshot:JSON.parse(v[6]),status:v[7],amount:v[8],currency:'CLP',expires_at:v[9]};return {rows:[stored]};}
  if(sql.startsWith('SELECT * FROM arm_app.event_registrations'))return {rows:[stored??options.old]};
  if(sql.includes('SET email_sent_at')){if(stored)stored.email_sent_at=new Date();}
  return {rows:[]};
 });
 const db={query,transaction:async(fn:any)=>fn({query})};return {service:new EventRegistrationService(db as any,config as any,new EventPaymentService(config as any),mail as any),query,mail};
}
describe('Inscripciones',()=>{
 it('respeta apertura, cierre, publicación y fin de evento',()=>{
  const now=Date.parse('2028-01-01T00:00:00Z');expect(registrationsOpen(event,now)).toBe(true);
  for(const patch of [{status:'draft'},{published_at:null},{registration_status:'closed'},{ends_at:'2027-01-01T00:00:00Z'},{details:{registrationOpensAt:'2029-01-01T00:00:00Z'}},{details:{registrationClosesAt:'2027-01-01T00:00:00Z'}}])expect(registrationsOpen({...event,...patch},now)).toBe(false);
 });
 it('rechaza precio, estado y consentimiento inyectados en el DTO público',async()=>{
  const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
  for(const body of [{...dto,amount:0},{...dto,status:'confirmed'},{...dto,consent:false},{...dto,email:'invalid'}])await expect(pipe.transform(body,{type:'body',metatype:RegistrationDto})).rejects.toThrow();
 });
 it('confirma un evento gratuito y no solicita pago',async()=>{const x=setup();const result=await x.service.register('free',dto);expect(result.status).toBe('confirmed');expect(result.amount).toBe(0);expect(result.ticketCode).toBe(result.id);expect(x.query.mock.calls[0][0]).toContain('FOR UPDATE');});
 it('rechaza el último cupo ocupado o usa lista de espera sin emitir entrada',async()=>{
  await expect(setup({count:1}).service.register('full',dto)).rejects.toThrow(/agotaron/);
  const result=await setup({count:1,waitlist:true}).service.register('full',dto);expect(result.status).toBe('waitlisted');expect(result.ticketCode).toBeNull();
 });
 it('toma el precio del servidor y no emite ticket antes de pagar',async()=>{const x=setup({paid:true});const result=await x.service.register('paid',dto);expect(result.status).toBe('pending_payment');expect(result.amount).toBe(1000);expect(result.ticketCode).toBeNull();});
 it('un error de correo no revierte una inscripción confirmada',async()=>{const x=setup();x.mail.sendHtml.mockRejectedValue(new Error('offline'));const result=await x.service.register('free',dto);expect(result.status).toBe('confirmed');expect(result.emailSent).toBe(false);});
 it('no repite una inscripción al reintentar la misma clave',async()=>{
  const old={id:'existing',participant:{firstName:'A',lastName:'B'},snapshot:{title:'Evento'},amount:0,status:'confirmed',email_sent_at:new Date()};
  const x=setup({old});expect((await x.service.register('free',dto)).id).toBe('existing');expect(x.query.mock.calls.some(([sql])=>sql.startsWith('INSERT'))).toBe(false);
 });
 it('no permite consultar ni pagar con una clave ajena',async()=>{const x=setup();await expect(x.service.get('id','a'.repeat(64))).rejects.toThrow(/no encontrada/);await expect(x.service.checkout('id','a'.repeat(64))).rejects.toThrow();expect(x.query).not.toHaveBeenCalled();});
});
describe('Mercado Pago: pruebas, producción y confirmación verificada',()=>{
 const production={get:(key:string)=>({EVENT_PAYMENTS_MODE:'production',MERCADOPAGO_ACCESS_TOKEN:'mock-production',MERCADOPAGO_COLLECTOR_ID:'456',MERCADOPAGO_WEBHOOK_SECRET:'secret',VERCEL_ENV:'production'}[key])};
 it('producción usa solo la credencial real y verifica el vendedor esperado',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:456,site_id:'MLC',tags:[]})});vi.stubGlobal('fetch',fetch);
  expect(await new EventPaymentService(production as any).assertSeller()).toBe('456');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer mock-production');
 });
 it.each([{id:999,site_id:'MLC',tags:[]},{id:456,site_id:'MLC',tags:['test_user']},{id:456,site_id:'MLA',tags:[]}])('rechaza vendedor incorrecto, de prueba o de otro país: %j',async seller=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>seller}));
  await expect(new EventPaymentService(production as any).assertSeller()).rejects.toThrow();
 });
 it('explica si la credencial es de prueba o si el ID receptor no coincide',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({id:456,site_id:'MLC',tags:['test_user']})}));
  await expect(new EventPaymentService(production as any).assertSeller()).rejects.toThrow(/usuario de prueba/);
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({id:999,site_id:'MLC',tags:[]})}));
  await expect(new EventPaymentService(production as any).assertSeller()).rejects.toThrow(/ID receptor configurado no coincide/);
 });
 it('la comprobación del editor muestra los últimos dígitos de ambos IDs cuando no coinciden',async()=>{
  const prodConfig={get:(key:string)=>({...{EVENT_REGISTRATION_SECRET:'x'.repeat(40),FRONTEND_URL:'https://example.com'},EVENT_PAYMENTS_MODE:'production',MERCADOPAGO_ACCESS_TOKEN:'APP_USR-secret-token',MERCADOPAGO_COLLECTOR_ID:'123450917',MERCADOPAGO_WEBHOOK_SECRET:'secret',VERCEL_ENV:'production'} as any)[key]};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({id:987654821,site_id:'MLC',tags:[]})}));
  const service=new EventRegistrationService({query:vi.fn()} as any,prodConfig as any,new EventPaymentService(prodConfig as any),{} as any);
  const error=await service.checkPayments({sub:1,permissions:['eventos:manageAll']}).catch((e:any)=>e);
  expect(error.message).toContain('Cuenta del Access Token: …4821 (9 dígitos) · ID configurado: …0917 (9 dígitos).');
  expect(error.message).not.toContain('APP_USR');
  expect(error.message).not.toContain('987654821');
 });
 it('bloquea pagos reales desde Preview incluso si tiene credenciales',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  await expect(new EventPaymentService({get:(key:string)=>key==='VERCEL_ENV'?'preview':production.get(key)} as any).assertSeller()).rejects.toThrow(/Production/);
  expect(fetch).not.toHaveBeenCalled();
 });
 it('no convierte una reserva de prueba en un pago real ni cambia el receptor',()=>{
  const service=new EventPaymentService(production as any);
  expect(()=>service.assertRegistrationMode({snapshot:{}})).toThrow(/otro entorno/);
  expect(()=>service.assertRegistrationMode({snapshot:{paymentMode:'production',collectorId:'999'}})).toThrow(/receptora/);
  expect(()=>service.assertRegistrationMode({snapshot:{paymentMode:'production',collectorId:'456'}})).not.toThrow();
 });
 it('solo acepta pagos live del vendedor de producción',async()=>{
  const signature=createHmac('sha256','secret').update('id:123;request-id:req;ts:100;').digest('hex');
  for(const live of [false,true]){
   vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({id:456,site_id:'MLC',tags:[]})}).mockResolvedValueOnce({ok:true,json:async()=>({id:123,collector_id:456,live_mode:live})}));
   const result=new EventPaymentService(production as any).payment('123','req',`ts=100,v1=${signature}`);
   if(live)await expect(result).resolves.toMatchObject({live_mode:true});else await expect(result).rejects.toThrow();
  }
 });
 function webhookFixture(overrides:any={},status='approved'){
  const row:any={id:'11111111-1111-4111-8111-111111111111',event_id:'event',amount:1000,currency:'CLP',preference_id:'pref',status:'pending_payment',expires_at:'2030-01-01T00:00:00Z',payment_id:null,confirmation_sent_at:new Date(),...overrides};
  const query=vi.fn(async(sql:string,v:any[]=[])=>{
   if(sql.startsWith('SELECT event_id'))return {rows:[{event_id:'event'}]};
   if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[event]};
   if(sql.startsWith('SELECT * FROM arm_app.event_registrations'))return {rows:[row]};
   if(sql.startsWith('UPDATE arm_app.event_registrations SET status=$2')){row.status=v[1];row.payment_id=v[2];}
   return {rows:[]};
  });
  const payment={external_reference:row.id,status,transaction_amount:1000,currency_id:'CLP'};
  const payments={payment:vi.fn().mockResolvedValue(payment),assertRegistrationMode:(row:any)=>new EventPaymentService(config as any).assertRegistrationMode(row)};
  const service=new EventRegistrationService({query,transaction:async(fn:any)=>fn({query})} as any,config as any,payments as any,{sendHtml:vi.fn()} as any);
  return {service,row,query,payment};
 }
 it('confirma una sola vez un pago aprobado y rechaza diferencias de importe',async()=>{
  const x=webhookFixture();await x.service.webhook('123','req','signature');await x.service.webhook('123','req','signature');expect(x.row.status).toBe('confirmed');expect(x.query.mock.calls.filter(([sql])=>sql.startsWith('UPDATE arm_app.event_registrations SET status=$2'))).toHaveLength(1);
  const bad=webhookFixture({amount:2000});await expect(bad.service.webhook('123','req','signature')).rejects.toThrow(/importe/);expect(bad.row.status).toBe('pending_payment');
 });
 it('no confirma pagos pendientes y retiene pagos tardíos para revisión',async()=>{
  const pending=webhookFixture({},'pending');await pending.service.webhook('123','req','signature');expect(pending.row.status).toBe('pending_payment');
  const late=webhookFixture({expires_at:'2020-01-01T00:00:00Z'});await late.service.webhook('123','req','signature');expect(late.row.status).toBe('payment_review');
 });
 it('valida la firma y rechaza modificaciones de ID o firma',()=>{
  const signature=createHmac('sha256','secret').update('id:123;request-id:req;ts:100;').digest('hex');
  expect(verifyPaymentSignature('secret','123','req',`ts=100,v1=${signature}`)).toBe(true);
  expect(verifyPaymentSignature('secret','124','req',`ts=100,v1=${signature}`)).toBe(false);
  expect(verifyPaymentSignature('secret','123','req','ts=100,v1=bad')).toBe(false);
 });
 it('rechaza un vendedor real antes de crear el checkout',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:1,site_id:'MLC',tags:[]})});vi.stubGlobal('fetch',fetch);
  await expect(new EventPaymentService(config as any).checkout({},'https://example.com')).rejects.toThrow(/vendedor de prueba/);expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('rechaza pagos live aunque tengan firma válida',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({id:1,site_id:'MLC',tags:['test_user']})}).mockResolvedValueOnce({ok:true,json:async()=>({id:123,collector_id:1,live_mode:true})}));
  const signature=createHmac('sha256','secret').update('id:123;request-id:req;ts:100;').digest('hex');
  await expect(new EventPaymentService(config as any).payment('123','req',`ts=100,v1=${signature}`)).rejects.toThrow(/vendedor o entorno/);
 });
 it('sin modo test configurado no llama a Mercado Pago',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(new EventPaymentService({get:()=>undefined} as any).assertSeller()).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 });
});
