import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';
import { ValidationPipe } from '@nestjs/common';
import { RegistrationDto } from './event-registration.dto';
import { EventRegistrationService, registrationsOpen } from './event-registration.service';
import { EventPaymentService, verifyPaymentSignature } from './event-payment.service';
const event={id:'event',slug:'retiro',title:'Retiro',starts_at:'2030-01-01T12:00:00Z',status:'published',published_at:new Date(),registration_status:'open',ends_at:'2030-01-02T00:00:00Z',details:{pricing:'free',waitlist:false,timezone:'America/Santiago'},capacity:1,version:1};
const GENERAL='22222222-2222-4222-8222-222222222222',KIDS='33333333-3333-4333-8333-333333333333',VIP='44444444-4444-4444-8444-444444444444';
const item=(over:any={})=>({firstName:'Prueba',lastName:'ARM',...over});
const dto:any={firstName:'Prueba',lastName:'ARM',email:'test@example.com',phone:'+56912345678',campusId:1,consent:true,requestKey:'a'.repeat(64),items:[item()]};
const config={get:(key:string)=>({EVENT_REGISTRATION_SECRET:'x'.repeat(40),FRONTEND_URL:'https://example.com',EVENT_PAYMENTS_MODE:'test',MERCADOPAGO_TEST_ACCESS_TOKEN:'mock',MERCADOPAGO_WEBHOOK_SECRET:'secret'}[key])};
afterEach(()=>vi.unstubAllGlobals());
type Setup={count?:number;waitlist?:boolean;old?:any;paid?:boolean;capacity?:number|null;tickets?:any[];sold?:Record<string,number>;code?:any;uses?:number;details?:any};
/** Base de datos simulada que guarda la compra y sus entradas. */
function setup(o:Setup={}){
 const store:{order?:any;tickets:any[]}={tickets:[]};const mail={sendHtml:vi.fn().mockResolvedValue({id:'mail'})};
 const ev={...event,capacity:o.capacity===undefined?event.capacity:o.capacity,details:{...event.details,waitlist:o.waitlist??false,pricing:o.paid?'paid':'free',...o.details}};
 const tickets=o.tickets??(o.paid?[{id:GENERAL,name:'General',price:1000,currency:'CLP',max_per_order:10}]:[]);
 const query=vi.fn(async(sql:string,v:any[]=[])=>{
  sql=sql.trim();
  if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[ev]};
  if(sql.includes('AND request_hash'))return {rows:o.old?[o.old]:[]};
  if(sql.startsWith('SELECT c.id'))return {rows:[{id:1}]};
  if(sql.startsWith('SELECT * FROM arm_app.event_discount_codes'))return {rows:o.code&&o.code.code===v[1]?[o.code]:[]};
  if(sql.includes('FROM arm_app.event_orders WHERE discount_code_id'))return {rows:[{n:o.uses??0}]};
  if(sql.startsWith('SELECT * FROM arm_app.event_ticket_types'))return {rows:tickets};
  if(sql.startsWith('SELECT ticket_type_id'))return {rows:Object.entries(o.sold??{}).map(([ticket_type_id,n])=>({ticket_type_id,n}))};
  if(sql.startsWith('SELECT count'))return {rows:[{count:o.count??0}]};
  if(sql.startsWith('INSERT INTO arm_app.event_orders')){store.order={id:v[0],event_id:v[1],campus_id:v[2],email:v[4],buyer:JSON.parse(v[5]),snapshot:JSON.parse(v[6]),status:v[7],subtotal:v[8],discount:v[9],amount:v[10],currency:'CLP',discount_code_id:v[11],expires_at:v[12]};return {rows:[store.order]};}
  if(sql.startsWith('INSERT INTO arm_app.event_registrations')){store.tickets.push({id:v[0],email:v[4],participant:JSON.parse(v[5]),snapshot:JSON.parse(v[6]),status:v[7],amount:v[8],order_id:v[10],ticket_type_id:v[11],answers:JSON.parse(v[12])});return {rows:[]};}
  if(sql.startsWith('SELECT * FROM arm_app.event_orders WHERE id'))return {rows:[store.order??o.old]};
  if(sql.startsWith('SELECT * FROM arm_app.event_registrations WHERE order_id'))return {rows:store.tickets};
  if(sql.includes('SET email_sent_at')||sql.includes('SET confirmation_sent_at')){if(store.order)store.order[sql.includes('email_sent_at')?'email_sent_at':'confirmation_sent_at']=new Date();}
  return {rows:[]};
 });
 const db={query,transaction:async(fn:any)=>fn({query})};return {service:new EventRegistrationService(db as any,config as any,new EventPaymentService(config as any),mail as any),query,mail,store};
}
describe('Inscripciones',()=>{
 it('respeta apertura, cierre, publicación y fin de evento',()=>{
  const now=Date.parse('2028-01-01T00:00:00Z');expect(registrationsOpen(event,now)).toBe(true);
  for(const patch of [{status:'draft'},{published_at:null},{registration_status:'closed'},{ends_at:'2027-01-01T00:00:00Z'},{details:{registrationOpensAt:'2029-01-01T00:00:00Z'}},{details:{registrationClosesAt:'2027-01-01T00:00:00Z'}}])expect(registrationsOpen({...event,...patch},now)).toBe(false);
 });
 it('rechaza precio, estado y consentimiento inyectados en el DTO público',async()=>{
  const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
  for(const body of [{...dto,amount:0},{...dto,status:'confirmed'},{...dto,consent:false},{...dto,email:'invalid'},{...dto,items:[]},{...dto,items:Array(11).fill(item())},{...dto,items:[{...item(),price:0}]}])await expect(pipe.transform(body,{type:'body',metatype:RegistrationDto})).rejects.toThrow();
 });
 it('confirma un evento gratuito y no solicita pago',async()=>{const x=setup();const result=await x.service.register('free',dto);expect(result.status).toBe('confirmed');expect(result.amount).toBe(0);expect(result.tickets[0].code).toBe(x.store.tickets[0].id);expect(x.query.mock.calls.some(([sql])=>sql.includes('event_programs WHERE slug=$1 FOR UPDATE'))).toBe(true);});
 it('rechaza el último cupo ocupado o usa lista de espera sin emitir entrada',async()=>{
  await expect(setup({count:1}).service.register('full',dto)).rejects.toThrow(/agotaron/);
  const result=await setup({count:1,waitlist:true}).service.register('full',dto);expect(result.status).toBe('waitlisted');expect(result.tickets[0].code).toBeNull();
 });
 it('toma el precio del servidor y no emite ticket antes de pagar',async()=>{const x=setup({paid:true});const result=await x.service.register('paid',{...dto,items:[item({ticketTypeId:GENERAL})]});expect(result.status).toBe('pending_payment');expect(result.amount).toBe(1000);expect(result.tickets[0].code).toBeNull();expect(x.mail.sendHtml).not.toHaveBeenCalled();});
 it('un error de correo no revierte una inscripción confirmada',async()=>{const x=setup();x.mail.sendHtml.mockRejectedValue(new Error('offline'));const result=await x.service.register('free',dto);expect(result.status).toBe('confirmed');expect(result.emailSent).toBe(false);});
 it('no repite una inscripción al reintentar la misma clave',async()=>{
  const old={id:'existing',buyer:{firstName:'A',lastName:'B'},snapshot:{title:'Evento'},amount:0,subtotal:0,discount:0,status:'confirmed',confirmation_sent_at:new Date()};
  const x=setup({old});expect((await x.service.register('free',dto)).id).toBe('existing');expect(x.query.mock.calls.some(([sql])=>sql.trim().startsWith('INSERT'))).toBe(false);
 });
 it('no permite consultar ni pagar con una clave ajena',async()=>{const x=setup();await expect(x.service.get('id','a'.repeat(64))).rejects.toThrow(/no encontrada/);await expect(x.service.checkout('id','a'.repeat(64))).rejects.toThrow();expect(x.query).not.toHaveBeenCalled();});
});
describe('Compras con varias entradas',()=>{
 const tickets=[{id:GENERAL,name:'General',price:10000,currency:'CLP',max_per_order:4,capacity:50},{id:KIDS,name:'Niños',price:0,currency:'CLP',max_per_order:10},{id:VIP,name:'Equipo',price:5000,currency:'CLP',hidden:true,max_per_order:10}];
 const family={...dto,items:[item({ticketTypeId:GENERAL}),item({firstName:'Ana',ticketTypeId:GENERAL}),item({firstName:'Tomás',ticketTypeId:KIDS})]};
 it('una compra familiar crea una entrada por asistente con un solo total',async()=>{
  const x=setup({paid:true,tickets,capacity:null});
  const r=await x.service.register('retiro',family);
  expect(r).toMatchObject({status:'pending_payment',subtotal:20000,discount:0,amount:20000,summary:'2 × General, Niños'});
  expect(x.store.tickets.map(t=>[t.participant.firstName,t.amount,t.order_id===r.id])).toEqual([['Prueba',10000,true],['Ana',10000,true],['Tomás',0,true]]);
  expect(r.tickets).toHaveLength(3);
 });
 it('respeta el máximo por compra, el cupo de cada entrada y el cupo total',async()=>{
  const five={...dto,items:Array.from({length:5},()=>item({ticketTypeId:GENERAL}))};
  await expect(setup({paid:true,tickets,capacity:null}).service.register('retiro',five)).rejects.toThrow(/hasta 4/);
  await expect(setup({paid:true,tickets,capacity:null,sold:{[GENERAL]:49}}).service.register('retiro',family)).rejects.toThrow(/Solo quedan 1 entradas «General»/);
  await expect(setup({paid:true,tickets,capacity:10,count:8}).service.register('retiro',family)).rejects.toThrow(/Solo quedan 2 cupos/);
 });
 it('no vende fuera de la ventana de venta',async()=>{
  const soon=[{...tickets[0],sales_start:'2099-01-01T00:00:00Z'}];const over=[{...tickets[0],sales_end:'2000-01-01T00:00:00Z'}];
  await expect(setup({paid:true,tickets:soon,capacity:null}).service.register('retiro',{...dto,items:[item({ticketTypeId:GENERAL})]})).rejects.toThrow(/todavía no está a la venta/);
  await expect(setup({paid:true,tickets:over,capacity:null}).service.register('retiro',{...dto,items:[item({ticketTypeId:GENERAL})]})).rejects.toThrow(/terminó/);
 });
 it('una entrada oculta solo se compra con un código que la incluya',async()=>{
  const staff={...dto,items:[item({ticketTypeId:VIP})]};
  await expect(setup({paid:true,tickets,capacity:null}).service.register('retiro',staff)).rejects.toThrow(/requiere un código/);
  const code={id:'c1',code:'EQUIPO',kind:'percent',value:0,ticket_type_ids:[VIP],active:true};
  const r=await setup({paid:true,tickets,capacity:null,code}).service.register('retiro',{...staff,code:'equipo'});
  expect(r).toMatchObject({status:'pending_payment',amount:5000,code:'EQUIPO'});
 });
 it('aplica el descuento solo a las entradas que cubre el código y respeta sus usos',async()=>{
  const code={id:'c1',code:'FAMILIA',kind:'percent',value:25,ticket_type_ids:[GENERAL],active:true,max_uses:3};
  const x=setup({paid:true,tickets,capacity:null,code});
  const r=await x.service.register('retiro',{...family,code:'FAMILIA'});
  expect(r).toMatchObject({subtotal:20000,discount:5000,amount:15000});
  expect(x.store.order.discount_code_id).toBe('c1');
  await expect(setup({paid:true,tickets,capacity:null,code,uses:3}).service.register('retiro',{...family,code:'FAMILIA'})).rejects.toThrow(/todas las veces/);
  await expect(setup({paid:true,tickets,capacity:null,code}).service.register('retiro',{...family,code:'OTRO'})).rejects.toThrow(/no es válido/);
 });
 it('un descuento del 100 % confirma sin pasar por Mercado Pago',async()=>{
  const code={id:'c1',code:'BECA',kind:'percent',value:100,ticket_type_ids:[],active:true};
  const x=setup({paid:true,tickets,capacity:null,code});
  const r=await x.service.register('retiro',{...family,code:'BECA'});
  expect(r).toMatchObject({status:'confirmed',amount:0});
  expect(r.tickets.every((t:any)=>t.code)).toBe(true);
  expect(x.store.order.snapshot.paymentMode).toBe('free');
  // Un solo correo, con un QR por entrada.
  const sent=x.mail.sendHtml.mock.calls[0][0];expect(sent.attachments.map((a:any)=>a.content_id)).toEqual(['entrada-qr-1','entrada-qr-2','entrada-qr-3']);
 });
 it('valida las respuestas de cada asistente',async()=>{
  const questions=[{id:'talla',label:'Talla de polera',type:'select',options:['S','M','L'],required:true},{id:'alergia',label:'Alergias',type:'text',required:false},{id:'foto',label:'Autorizo fotos',type:'yesno',required:true}];
  const ok=(over:any={})=>({...dto,items:[item({answers:{talla:'M',foto:true,alergia:'  maní ',...over}})]});
  const x=setup({details:{questions}});
  await x.service.register('retiro',ok());
  expect(x.store.tickets[0].answers).toEqual({talla:'M',alergia:'maní',foto:true});
  await expect(setup({details:{questions}}).service.register('retiro',ok({talla:'XXL'}))).rejects.toThrow(/opción válida/);
  await expect(setup({details:{questions}}).service.register('retiro',ok({talla:''}))).rejects.toThrow(/Talla de polera/);
  await expect(setup({details:{questions}}).service.register('retiro',ok({foto:false}))).rejects.toThrow(/Confirma «Autorizo fotos»/);
 });
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
 it('al buscar pagos solo acepta pagos de la cuenta y el entorno configurados',async()=>{
  const ref='11111111-1111-4111-8111-111111111111';
  const fetch=vi.fn()
   .mockResolvedValueOnce({ok:true,json:async()=>({id:456,site_id:'MLC',tags:[]})})
   .mockResolvedValueOnce({ok:true,json:async()=>({results:[
    {id:1,external_reference:ref,live_mode:true,collector_id:456,status:'approved'},
    {id:2,external_reference:ref,live_mode:false,collector_id:456,status:'approved'},
    {id:3,external_reference:ref,live_mode:true,collector_id:999,status:'approved'},
    {id:4,external_reference:'otra',live_mode:true,collector_id:456,status:'approved'},
   ]})});
  vi.stubGlobal('fetch',fetch);
  const found=await new EventPaymentService(production as any).findPayments(ref);
  expect(found.map((p:any)=>p.id)).toEqual([1]);
  expect(fetch.mock.calls[1][0]).toContain(`/v1/payments/search?external_reference=${ref}`);
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
  // La compra (event_orders) con una entrada; el pago se aplica a la compra y se refleja en sus entradas.
  const row:any={id:'11111111-1111-4111-8111-111111111111',event_id:'event',amount:1000,subtotal:1000,discount:0,currency:'CLP',preference_id:'pref',status:'pending_payment',expires_at:'2030-01-01T00:00:00Z',payment_id:null,confirmation_sent_at:new Date(),buyer:{firstName:'Prueba',lastName:'ARM'},snapshot:{title:'Retiro',slug:'retiro'},...overrides};
  const ticket:any={id:'55555555-5555-4555-8555-555555555555',order_id:row.id,event_id:'event',status:'pending_payment',participant:{firstName:'Prueba',lastName:'ARM'},snapshot:{ticketName:'General'},amount:1000};
  const query=vi.fn(async(sql:string,v:any[]=[])=>{
   if(sql.startsWith('SELECT event_id'))return {rows:[{event_id:'event'}]};
   if(sql.startsWith('SELECT * FROM arm_app.event_programs')||sql.startsWith('SELECT status FROM arm_app.event_programs'))return {rows:[event]};
   if(sql.startsWith('SELECT * FROM arm_app.event_orders'))return {rows:[row]};
   if(sql.startsWith('SELECT order_id,event_id'))return {rows:[ticket]};
   if(sql.startsWith('SELECT * FROM arm_app.event_registrations WHERE order_id'))return {rows:[ticket]};
   if(sql.startsWith('UPDATE arm_app.event_orders SET status=$2')){row.status=v[1];row.payment_id=v[2];}
   if(sql.startsWith('UPDATE arm_app.event_registrations SET status=$2'))ticket.status=v[1];
   return {rows:[]};
  });
  const payment={external_reference:row.id,status,transaction_amount:1000,currency_id:'CLP'};
  const payments={payment:vi.fn().mockResolvedValue(payment),assertRegistrationMode:(row:any)=>new EventPaymentService(config as any).assertRegistrationMode(row)};
  const service=new EventRegistrationService({query,transaction:async(fn:any)=>fn({query})} as any,config as any,payments as any,{sendHtml:vi.fn()} as any);
  return {service,row,query,payment};
 }
 it('confirma una sola vez un pago aprobado y rechaza diferencias de importe',async()=>{
  const x=webhookFixture();await x.service.webhook('123','req','signature');await x.service.webhook('123','req','signature');expect(x.row.status).toBe('confirmed');expect(x.query.mock.calls.filter(([sql])=>sql.startsWith('UPDATE arm_app.event_orders SET status=$2'))).toHaveLength(1);expect(x.query.mock.calls.find(([sql])=>sql.startsWith('UPDATE arm_app.event_registrations SET status=$2'))?.[1]).toEqual([x.row.id,'confirmed']);
  const bad=webhookFixture({amount:2000});await expect(bad.service.webhook('123','req','signature')).rejects.toThrow(/importe/);expect(bad.row.status).toBe('pending_payment');
 });
 it('no confirma pagos pendientes y retiene pagos tardíos para revisión',async()=>{
  const pending=webhookFixture({},'pending');await pending.service.webhook('123','req','signature');expect(pending.row.status).toBe('pending_payment');
  const late=webhookFixture({expires_at:'2020-01-01T00:00:00Z'});await late.service.webhook('123','req','signature');expect(late.row.status).toBe('payment_review');
 });
 it('si el aviso no llegó, al consultar el estado confirma un pago aprobado según Mercado Pago',async()=>{
  const x=webhookFixture();
  const token=createHmac('sha256','x'.repeat(40)).update(`event-registration:${x.row.id}`).digest('hex');
  const approved={id:987654,external_reference:x.row.id,status:'approved',transaction_amount:1000,currency_id:'CLP'};
  (x.service as any).payments.findPayments=vi.fn().mockResolvedValue([approved]);

  const view=await x.service.get(x.row.id,token);
  expect(view.status).toBe('confirmed');
  expect(x.row.payment_id).toBe('987654');
  // Sin pago aprobado (o si Mercado Pago no responde) la inscripción queda igual.
  const y=webhookFixture();
  (y.service as any).payments.findPayments=vi.fn().mockRejectedValue(new Error('timeout'));
  const tokenY=createHmac('sha256','x'.repeat(40)).update(`event-registration:${y.row.id}`).digest('hex');
  expect((await y.service.get(y.row.id,tokenY)).status).toBe('pending_payment');
 });
 it('verificación del organizador: explica qué informa Mercado Pago y confirma un pago aprobado',async()=>{
  const admin={sub:1,permissions:['eventos:manageAll']};
  const ip=(over:any={})=>({id:'987654',status:'approved',statusDetail:'accredited',amount:1000,currency:'CLP',sameReference:true,sameMode:true,sameSeller:true,...over,payment:{id:987654,external_reference:'11111111-1111-4111-8111-111111111111',status:over.status??'approved',transaction_amount:1000,currency_id:'CLP'}});
  // Sin pagos con esa referencia.
  const none=webhookFixture();(none.service as any).payments.inspectPayments=vi.fn().mockResolvedValue([]);
  const r1=await none.service.verifyPayment(admin,'event',none.row.id);
  expect(r1).toMatchObject({status:'pending_payment',payments:[]});expect(r1.message).toMatch(/no tiene pagos con la referencia/);
  // Pago aprobado: se confirma y el detalle no incluye el objeto completo de Mercado Pago.
  const ok=webhookFixture();(ok.service as any).payments.inspectPayments=vi.fn().mockResolvedValue([ip()]);
  const r2=await ok.service.verifyPayment(admin,'event',ok.row.id);
  expect(r2.status).toBe('confirmed');expect(r2.message).toMatch(/quedó confirmada/);expect(ok.row.payment_id).toBe('987654');
  expect(r2.payments[0]).not.toHaveProperty('payment');
  // Otro estado: se informa tal cual y no cambia nada.
  const rejected=webhookFixture();(rejected.service as any).payments.inspectPayments=vi.fn().mockResolvedValue([ip({status:'rejected',statusDetail:'cc_rejected_other_reason'})]);
  const r3=await rejected.service.verifyPayment(admin,'event',rejected.row.id);
  expect(r3.status).toBe('pending_payment');expect(r3.message).toContain('«rejected · cc_rejected_other_reason»');
  // Aprobado pero de otra cuenta o entorno: no se aplica.
  const other=webhookFixture();(other.service as any).payments.inspectPayments=vi.fn().mockResolvedValue([ip({sameSeller:false})]);
  const r4=await other.service.verifyPayment(admin,'event',other.row.id);
  expect(r4.status).toBe('pending_payment');expect(r4.message).toMatch(/no corresponde a esta cuenta/);
  // Sin permisos de eventos no se puede consultar.
  await expect(none.service.verifyPayment({sub:2,permissions:[]},'event',none.row.id)).rejects.toThrow();
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
