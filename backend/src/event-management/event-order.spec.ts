import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { cleanAnswers, codeProblem, lineDiscount, priceOrder, saleState, ticketSummary } from './event-order.rules';
import { EventDiscountCodeDto, SaveEventProgramDto } from './event-program.dto';
import { EventProgramService } from './event-program.service';
import { validateEventProgram } from './event-program.rules';

const A='22222222-2222-4222-8222-222222222222',B='33333333-3333-4333-8333-333333333333',C='44444444-4444-4444-8444-444444444444';
const now=Date.parse('2027-01-01T12:00:00Z');

describe('Reglas de una compra',()=>{
 it('la ventana de venta decide si una entrada se puede comprar',()=>{
  expect(saleState({},now)).toBe('on');
  expect(saleState({sales_start:'2027-01-02T00:00:00Z'},now)).toBe('soon');
  expect(saleState({sales_end:'2027-01-01T12:00:00Z'},now)).toBe('over');
 });
 it('el descuento se redondea al peso y nunca supera el precio',()=>{
  expect(lineDiscount(9990,{kind:'percent',value:15})).toBe(1499);
  expect(lineDiscount(3000,{kind:'amount',value:5000})).toBe(3000);
  expect(lineDiscount(0,{kind:'percent',value:50})).toBe(0);
 });
 it('aplica el código solo a las entradas que cubre',()=>{
  const r=priceOrder([{ticket:{id:A,name:'General',price:10000,currency:'CLP'}},{ticket:{id:B,name:'Niños',price:4000,currency:'CLP'}}],{id:'c',code:'X',kind:'amount',value:2000,ticket_type_ids:[B]});
  expect(r).toMatchObject({subtotal:14000,discount:2000,amount:12000});
  expect(r.lines.map(l=>l.amount)).toEqual([10000,2000]);
  expect(ticketSummary([{ticketName:'General'},{ticketName:'General'},{ticketName:'Niños'}])).toBe('2 × General, Niños');
 });
 it('explica por qué un código no sirve',()=>{
  const code={id:'c',code:'X',kind:'percent' as const,value:10,active:true,max_uses:2,starts_at:'2027-01-01T00:00:00Z',ends_at:'2027-02-01T00:00:00Z'};
  expect(codeProblem(code,1,now)).toBeNull();
  expect(codeProblem(code,2,now)).toMatch(/todas las veces/);
  expect(codeProblem(code,0,Date.parse('2026-12-01T00:00:00Z'))).toMatch(/todavía/);
  expect(codeProblem(code,0,Date.parse('2027-03-01T00:00:00Z'))).toMatch(/venció/);
  expect(codeProblem({...code,active:false},0,now)).toMatch(/no es válido/);
  expect(codeProblem(undefined,0,now)).toMatch(/no es válido/);
 });
 it('acepta respuestas opcionales vacías y rechaza tipos inventados',()=>{
  const q=[{id:'talla',label:'Talla',type:'select' as const,options:['S','M'],required:false},{id:'nota',label:'Nota',type:'text' as const,required:false}];
  expect(cleanAnswers(q,{},'x')).toEqual({});
  expect(cleanAnswers(q,{talla:'S',otra:'ignorada'},'x')).toEqual({talla:'S'});
  expect(()=>cleanAnswers(q,{nota:{a:1}} as any,'x')).toThrow();
  expect(()=>cleanAnswers(q,{nota:'x'.repeat(501)},'x')).toThrow(/larga/);
 });
});

describe('Editor: entradas, preguntas y códigos',()=>{
 const base=():SaveEventProgramDto=>({version:1,title:'Retiro',slug:'retiro',categoryId:null,campusId:10,organizerId:3,startsAt:'2027-01-10T09:00:00-03:00',endsAt:'2027-01-10T18:00:00-03:00',status:'draft',registrationStatus:'pending',capacity:null,campusIds:[10],
  details:{summary:'',description:'',bannerUrl:'',color:'#31302e',timezone:'America/Santiago',modality:'onsite',location:'',address:'',waitlist:false,conditions:'',cancellationPolicy:'',pricing:'paid',faqs:[]} as any,ticketTypes:[{name:'General',price:10000,currency:'CLP'},{name:'Niños',price:0,currency:'CLP'}]});
 it('un evento pagado admite entradas sin costo, pero no ventanas invertidas ni preguntas sin opciones',()=>{
  expect(()=>validateEventProgram(base())).not.toThrow();
  const bad=base();bad.ticketTypes[0]={...bad.ticketTypes[0],salesStart:'2027-01-05T00:00:00Z',salesEnd:'2027-01-04T00:00:00Z'};
  expect(()=>validateEventProgram(bad)).toThrow(/empezar antes/);
  const q=base();(q.details as any).questions=[{id:'talla',label:'Talla',type:'select',options:[],required:true}];
  expect(()=>validateEventProgram(q)).toThrow(/opciones/);
  const dup=base();(dup.details as any).questions=[{id:'abcd',label:'A',type:'text',required:false},{id:'abcd',label:'B',type:'text',required:false}];
  expect(()=>validateEventProgram(dup)).toThrow(/repetidas/);
 });
 it('al guardar conserva el ID de cada entrada, archiva las vendidas que se quitan y borra las demás',async()=>{
  const calls:{sql:string;v:any[]}[]=[];
  const query=vi.fn(async(sql:string,v:any[]=[])=>{
   calls.push({sql,v});
   if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[{id:'e',version:1,campus_id:10,organizer_id:3,slug:'retiro',published_at:null}],rowCount:1};
   if(sql.includes('SELECT id FROM arm_app.campuses'))return {rows:[{id:10}],rowCount:1};
   if(sql.startsWith('SELECT id FROM arm_app.users'))return {rows:[{id:3}],rowCount:1};
   if(sql.startsWith('SELECT id FROM arm_app.event_ticket_types'))return {rows:[{id:A},{id:B},{id:C}],rowCount:3};
   if(sql.startsWith('SELECT 1 FROM arm_app.event_registrations WHERE ticket_type_id'))return {rows:v[0]===B?[{x:1}]:[],rowCount:0};
   return {rows:[],rowCount:1};
  });
  const d=base();d.ticketTypes=[{id:A,name:'General',price:12000,currency:'CLP',capacity:80,hidden:false,maxPerOrder:4},{name:'Equipo',price:0,currency:'CLP',hidden:true}];
  await new EventProgramService({query,transaction:async(fn:any)=>fn({query})} as any).save({sub:1,campusId:10,permissions:['eventos:manageAll']},d,'e');
  expect(calls.some(c=>c.sql.startsWith('DELETE FROM arm_app.event_ticket_types WHERE event_id'))).toBe(false);
  expect(calls.find(c=>c.sql.startsWith('UPDATE arm_app.event_ticket_types SET name'))?.v.slice(0,3)).toEqual([A,'General',12000]);
  expect(calls.find(c=>c.sql.startsWith('INSERT INTO arm_app.event_ticket_types'))?.v).toContain('Equipo');
  expect(calls.find(c=>c.sql.startsWith('UPDATE arm_app.event_ticket_types SET archived=true'))?.v).toEqual([B]);
  expect(calls.find(c=>c.sql.startsWith('DELETE FROM arm_app.event_ticket_types WHERE id'))?.v).toEqual([C]);
 });
 it('la portada no muestra entradas ocultas e informa los cupos que quedan',async()=>{
  const query=vi.fn(async(sql:string)=>{
   if(sql.includes('FROM arm_app.event_programs e'))return {rows:[{id:'e',slug:'retiro',title:'Retiro',status:'published',published_at:new Date(),registration_status:'open',ends_at:'2099-01-01T00:00:00Z',capacity:100,details:{pricing:'paid'}}]};
   if(sql.startsWith('SELECT * FROM arm_app.event_ticket_types'))return {rows:[{id:A,name:'General',price:1000,currency:'CLP',capacity:10,max_per_order:4},{id:C,name:'Equipo',price:0,currency:'CLP',hidden:true}]};
   if(sql.startsWith('SELECT ticket_type_id'))return {rows:[{ticket_type_id:A,n:10}]};
   if(sql.includes('event_discount_codes'))return {rows:[{n:1}]};
   if(sql.includes('FROM arm_app.event_registrations WHERE event_id'))return {rows:[{n:30}]};
   return {rows:[]};
  });
  const r:any=await new EventProgramService({query} as any).publicEvent('retiro');
  expect(r.ticketTypes.map((t:any)=>t.name)).toEqual(['General']);
  expect(r.ticketTypes[0]).toMatchObject({remaining:0,soldOut:true,maxPerOrder:4,sale:'on'});
  expect(r).toMatchObject({capacityLeft:70,codesEnabled:true});
 });
 it('un código revela las entradas ocultas que incluye',async()=>{
  const code={id:'c',code:'EQUIPO',kind:'percent',value:0,ticket_type_ids:[C],active:true};
  const query=vi.fn(async(sql:string,v:any[]=[])=>{
   if(sql.startsWith('SELECT id FROM arm_app.event_programs'))return {rows:[{id:'e'}]};
   if(sql.startsWith('SELECT * FROM arm_app.event_discount_codes'))return {rows:v[1]==='EQUIPO'?[code]:[]};
   if(sql.includes('discount_code_id'))return {rows:[{n:0}]};
   if(sql.startsWith('SELECT * FROM arm_app.event_ticket_types'))return {rows:[{id:C,name:'Equipo',price:0,currency:'CLP',hidden:true}]};
   return {rows:[]};
  });
  const service=new EventProgramService({query} as any);
  const r=await service.lookupCode('retiro',' equipo ');
  expect(r).toMatchObject({code:'EQUIPO',value:0,ticketTypeIds:[C]});
  expect(r.unlockedTickets.map((t:any)=>t.name)).toEqual(['Equipo']);
  await expect(service.lookupCode('retiro','nada')).rejects.toThrow(/no es válido/);
 });
 it('valida y guarda códigos en mayúsculas, con mensajes claros',async()=>{
  const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
  const ok={code:'familia-2027',kind:'percent',value:20,ticketTypeIds:[],active:true};
  await expect(pipe.transform(ok,{type:'body',metatype:EventDiscountCodeDto})).resolves.toBeTruthy();
  for(const body of [{...ok,code:'a b'},{...ok,kind:'gratis'},{...ok,value:-1},{...ok,ticketTypeIds:['x']},{...ok,value:10.5}])await expect(pipe.transform(body,{type:'body',metatype:EventDiscountCodeDto})).rejects.toThrow();
  const query=vi.fn(async(sql:string,v:any[]=[])=>{
   if(sql.startsWith('SELECT * FROM arm_app.event_programs'))return {rows:[{id:'e',campus_id:10,organizer_id:3}]};
   if(sql.startsWith('INSERT INTO arm_app.event_discount_codes'))return {rows:[{id:'c',code:v[1],kind:v[2],value:v[3],ticket_type_ids:v[7],active:v[8]}]};
   return {rows:[]};
  });
  const service=new EventProgramService({query} as any);
  const admin={sub:1,campusId:10,permissions:['eventos:manageAll']};
  expect(await service.saveCode(admin,'e',ok as any)).toMatchObject({code:'FAMILIA-2027',value:20,uses:0});
  await expect(service.saveCode(admin,'e',{...ok,value:120} as any)).rejects.toThrow(/100/);
  await expect(service.saveCode({sub:9,campusId:99,permissions:['eventos:manageCampus']},'e',ok as any)).rejects.toThrow();
 });
});
