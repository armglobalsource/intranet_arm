import 'reflect-metadata';
import { describe,it,expect,vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { assertEventScope,eventAccess,validateEventProgram } from './event-program.rules';
import { SaveEventProgramDto } from './event-program.dto';
import { EventProgramService } from './event-program.service';
const global={sub:1,campusId:10,permissions:['eventos:manageAll']};
const campus={sub:2,campusId:10,permissions:['eventos:manageCampus']};
const organizer={sub:3,campusId:20,permissions:['eventos:organize']};
function dto():SaveEventProgramDto{return {version:1,title:'Retiro de prueba',slug:'retiro-prueba',categoryId:'5b7e370e-198c-4d68-8cc2-f47304c6aa22',campusId:10,organizerId:3,startsAt:'2027-01-10T09:00:00-03:00',endsAt:'2027-01-10T18:00:00-03:00',status:'draft',registrationStatus:'pending',campusIds:[10],capacity:100,ticketTypes:[],details:{summary:'Un encuentro',description:'Descripción',bannerUrl:'',color:'#102b40',timezone:'America/Santiago',modality:'onsite',location:'Auditorio',address:'',waitlist:false,conditions:'',cancellationPolicy:'',pricing:'free',faqs:[]}};}
function database(row:any){const query=vi.fn(async(sql:string)=>{
 if(sql.startsWith('SELECT * FROM'))return {rows:row?[row]:[],rowCount:row?1:0};
 if(sql.includes('SELECT id FROM arm_app.campuses'))return {rows:[{id:10}],rowCount:1};
 if(sql.startsWith('SELECT id FROM'))return {rows:[{id:3}],rowCount:1};
 return {rows:[],rowCount:1};
});return {query,transaction:async(fn:any)=>fn({query})};}
describe('Permisos de Eventos',()=>{
 it('rechaza usuarios sin permiso específico',()=>expect(()=>eventAccess({sub:1,permissions:['campus:edit']})).toThrow());
 it('limita al gestor al campus propio',()=>{expect(()=>assertEventScope(campus,{campus_id:10,organizer_id:4})).not.toThrow();expect(()=>assertEventScope(campus,{campus_id:20,organizer_id:2})).toThrow();});
 it('permite al organizador únicamente eventos asignados',()=>{expect(()=>assertEventScope(organizer,{campus_id:10,organizer_id:3})).not.toThrow();expect(()=>assertEventScope(organizer,{campus_id:20,organizer_id:4})).toThrow();});
 it('un campus nulo no concede acceso',()=>expect(()=>assertEventScope({...campus,campusId:null},{campus_id:10,organizer_id:2})).toThrow());
 it('respeta el wildcard existente',()=>expect(()=>assertEventScope({...global,permissions:['*']},{campus_id:99,organizer_id:99})).not.toThrow());
});
describe('Validación y publicación',()=>{
 it('acepta un borrador válido',()=>expect(()=>validateEventProgram(dto())).not.toThrow());
 it('rechaza fechas invertidas y sin offset',()=>{expect(()=>validateEventProgram({...dto(),endsAt:'2026-01-01T00:00:00Z'})).toThrow();expect(()=>validateEventProgram({...dto(),startsAt:'2027-01-10T09:00:00'})).toThrow();});
 it('no permite publicar sin contenido',()=>{const d=dto();d.status='published';d.details.summary='';expect(()=>validateEventProgram(d)).toThrow();});
 it('bloquea URLs no HTTPS y con credenciales',()=>{for(const url of ['javascript:alert(1)','http://example.com/x','https://user:pass@example.com/x']){const d=dto();d.details.bannerUrl=url;expect(()=>validateEventProgram(d)).toThrow();}});
 it('comprueba la zona horaria',()=>{const d=dto();d.details.timezone='Fake/City';expect(()=>validateEventProgram(d)).toThrow();});
 it('valida precios y ventanas de inscripción',()=>{const d=dto();d.details.pricing='paid';expect(()=>validateEventProgram(d)).toThrow();d.ticketTypes=[{name:'General',price:20,currency:'USD'}];expect(()=>validateEventProgram(d)).not.toThrow();d.details.registrationOpensAt='2028-01-01T00:00:00Z';expect(()=>validateEventProgram(d)).toThrow();});
 it('no permite dar por finalizado sin cerrar inscripción',()=>expect(()=>validateEventProgram({...dto(),status:'finished'})).toThrow());
 it('rechaza aperturas y datos anidados desconocidos por el pipe real',async()=>{
  const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:true}});
  for(const data of [{...dto(),registrationStatus:'open'},{...dto(),details:{...dto().details,secret:'unsafe'}},{...dto(),ticketTypes:[{name:'X',price:-1,currency:'CLP'}]}])await expect(pipe.transform(data,{type:'body',metatype:SaveEventProgramDto})).rejects.toThrow();
  await expect(pipe.transform(dto(),{type:'body',metatype:SaveEventProgramDto})).resolves.toBeInstanceOf(SaveEventProgramDto);
 });
});
describe('Servicio transaccional',()=>{
 it('rechaza una actualización obsoleta antes de escribir',async()=>{const db=database({version:2,campus_id:10,organizer_id:3});await expect(new EventProgramService(db as any).save(global,dto(),'id')).rejects.toThrow(/actualizó/);expect(db.query.mock.calls.every(([sql])=>sql.startsWith('SELECT'))).toBe(true);});
 it('rechaza leer un evento ajeno',async()=>{const db=database({campus_id:20,organizer_id:99});await expect(new EventProgramService(db as any).get(campus,'id')).rejects.toThrow();});
 it('un organizador no puede crear ni reasignar un evento',async()=>{const db=database({version:1,campus_id:10,organizer_id:3});const service=new EventProgramService(db as any);await expect(service.save(organizer,dto())).rejects.toThrow();await expect(service.save(organizer,{...dto(),organizerId:4},'id')).rejects.toThrow(/reasignar/);});
 it('guarda relaciones e historial en la transacción',async()=>{const db=database(null);const result=await new EventProgramService(db as any).save(global,dto());expect(result.version).toBe(1);expect(db.query.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO arm_app.event_audit_logs'))).toBe(true);});
 it('conserva el enlace tras una publicación previa',async()=>{const db=database({version:1,campus_id:10,organizer_id:3,status:'draft',slug:'original',published_at:new Date()});await expect(new EventProgramService(db as any).save(global,dto(),'id')).rejects.toThrow(/enlace/);});
 it('traduce una colisión de slug en conflicto',async()=>{const db={transaction:async()=>{throw {code:'23505'};}};await expect(new EventProgramService(db as any).save(global,dto())).rejects.toThrow(/ya existe/);});
 it('no permite administrar categorías a gestores de campus',async()=>{await expect(new EventProgramService({} as any).category(campus,{name:'Retiro',active:true})).rejects.toThrow();});
 it('la consulta pública excluye borradores y no expone organizadores',async()=>{const db=database(null);await expect(new EventProgramService(db as any).publicEvent('draft')).rejects.toThrow();const sql=db.query.mock.calls[0][0];expect(sql).toContain("e.status IN ('published','finished','cancelled')");expect(sql).not.toContain('organizer_id');});
});
