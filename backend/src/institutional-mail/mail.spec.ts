import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { CreateMailRequestDto, MailActionDto, MailDetailsDto } from './mail.dto';
import { canReadRequest, identityKey, nextStatus, validateDetails } from './mail.rules';
import { InstitutionalMailService } from './mail.service';

const requester={sub:1,permissions:[]};
const manager={sub:2,permissions:['institutional-mail:approve']};
const ti={sub:3,permissions:['institutional-mail:manage']};
const base={id:'00000000-0000-4000-8000-000000000001',requester_id:1,manager_id:2,status:'approval',version:1,assigned_to:3};
const details:MailDetailsDto={operation:'create',company:'arm',kind:'collaborator',name:'Demo ARM',employeeId:'12.345.678-9',area:'Comunicaciones',jobTitle:'Coordinador',startsOn:'2026-11-05',suggestedName:'demo.arm',groups:'Comunicaciones',reason:''};
function service(row:any=base,extra?: (sql:string,params:any[])=>any) {
  const query=vi.fn(async(sql:string,params:any[]=[])=>{
    if(sql.includes('FROM arm_app.mail_requests WHERE id=$1 FOR UPDATE'))return {rows:[row]};
    return extra?.(sql,params) ?? {rows:[],rowCount:0};
  });
  const db={query,transaction:async(fn:any)=>fn({query})};
  return {service:new InstitutionalMailService(db as any),query};
}
describe('institutional mail rules',()=>{
  it('derives company domains and normalizes the same collaborator ID',()=>{
    expect(validateDetails(details).domain).toBe('armglobal.org');
    expect(validateDetails({...details,company:'school'}).domain).toBe('arschoolglobal.com');
    expect(identityKey(details.employeeId)).toBe(identityKey('12345678-9'));
  });
  it('only the assigned approver can approve; requester and TI cannot bypass approval',()=>{
    expect(nextStatus(base,manager,'approve')).toBe('validation');
    for(const u of [requester,ti,{sub:5,permissions:['institutional-mail:approve']},{sub:1,permissions:['*']}]) expect(()=>nextStatus(base,u,'approve')).toThrow();
    expect(()=>nextStatus({...base,manager_id:1},{sub:1,permissions:['*']},'approve')).toThrow();
  });
  it('enforces workflow order, mandatory observation reasons and terminal states',()=>{
    expect(()=>nextStatus(base,ti,'complete')).toThrow();
    expect(()=>nextStatus({...base,status:'validation'},ti,'complete')).toThrow();
    expect(nextStatus({...base,status:'validation'},ti,'start')).toBe('creating');
    expect(()=>nextStatus(base,manager,'observe','  ')).toThrow();
    expect(nextStatus(base,manager,'observe','Corregir cargo')).toBe('observed');
    for(const status of ['delivered','rejected','observed'])expect(()=>nextStatus({...base,status},ti,'start')).toThrow();
  });
  it('restricts private requests to requester, assigned approver and TI',()=>{
    expect(canReadRequest(base,requester)).toBe(true);
    expect(canReadRequest(base,manager)).toBe(true);
    expect(canReadRequest(base,ti)).toBe(true);
    expect(canReadRequest(base,{sub:2,permissions:[]})).toBe(false);
    expect(canReadRequest(base,{sub:8,permissions:['institutional-mail:approve']})).toBe(false);
  });
  it('requires functional ownership, justification and valid temporary dates',()=>{
    expect(()=>validateDetails({...details,kind:'functional'})).toThrow();
    expect(()=>validateDetails({...details,kind:'temporary',expiresOn:'2026-02-30'})).toThrow();
    expect(()=>validateDetails({...details,kind:'temporary',expiresOn:'2020-01-01'})).toThrow();
    expect(()=>validateDetails({...details,groups:' '})).toThrow();
  });
  it('requires a corporate principal in the other domain for aliases',()=>{
    expect(()=>validateDetails({...details,kind:'alias',existingEmail:'someone@gmail.com'})).toThrow();
    expect(()=>validateDetails({...details,kind:'alias',existingEmail:'demo@armglobal.org'})).toThrow();
    expect(validateDetails({...details,kind:'alias',existingEmail:'demo@arschoolglobal.com'}).domain).toBe('armglobal.org');
  });
});
describe('request API boundary and service',()=>{
  const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:true}});
  it('rejects missing details, secret fields and non-boolean attestations',async()=>{
    await expect(pipe.transform({managerId:2},{type:'body',metatype:CreateMailRequestDto})).rejects.toThrow();
    await expect(pipe.transform({managerId:2,details:{...details,password:'secret'}},{type:'body',metatype:CreateMailRequestDto})).rejects.toThrow();
    await expect(pipe.transform({version:1,action:'start',workspaceChecked:'false'},{type:'body',metatype:MailActionDto})).rejects.toThrow();
  });
  it('blocks private list and inventory before querying',async()=>{
    const x=service();
    await expect(x.service.list(requester,'it','',1)).rejects.toThrow();
    await expect(x.service.accounts(requester,false,1)).rejects.toThrow();
    expect(x.query).not.toHaveBeenCalled();
  });
  it('uses row locks and rejects stale versions without writes',async()=>{
    const x=service();
    await expect(x.service.action(base.id,{version:9,action:'approve'},manager)).rejects.toThrow('La solicitud cambió');
    expect(x.query).toHaveBeenCalledTimes(1);
    expect(x.query.mock.calls[0][0]).toContain('FOR UPDATE');
  });
  it('does not mutate a request through a guessed identifier',async()=>{
    const x=service();
    await expect(x.service.action(base.id,{version:1,action:'approve'},{sub:9,permissions:[]})).rejects.toThrow('Solicitud no encontrada');
    expect(x.query).toHaveBeenCalledTimes(1);
  });
  it('records approval and notifications in the same transaction',async()=>{
    const x=service();
    const result=await x.service.action(base.id,{version:1,action:'approve'},manager);
    expect(result.status).toBe('validation');
    expect(x.query.mock.calls.some(([sql])=>sql.includes('INSERT INTO arm_app.mail_request_events'))).toBe(true);
    expect(x.query.mock.calls.some(([sql])=>sql.includes('notifications'))).toBe(true);
  });
  it('does not deliver before Workspace and security attestations',async()=>{
    const x=service({...base,status:'creating',details});
    await expect(x.service.action(base.id,{version:1,action:'complete',email:'demo.arm@armglobal.org'},ti)).rejects.toThrow('Google Workspace');
    await expect(x.service.action(base.id,{version:1,action:'complete',email:'demo.arm@armglobal.org',workspaceChecked:true},ti)).rejects.toThrow('MFA');
  });
  it('rejects another TI operator delivering an assigned request',async()=>{
    const x=service({...base,status:'creating',details});
    await expect(x.service.action(base.id,{version:1,action:'complete'},{sub:4,permissions:ti.permissions})).rejects.toThrow('responsable de TI');
  });
  it('rejects email domains inconsistent with the approved company',async()=>{
    const x=service({...base,status:'creating',details});
    await expect(x.service.action(base.id,{version:1,action:'complete',email:'demo.arm@arschoolglobal.com',workspaceChecked:true,mfaConfirmed:true,secureDelivery:true,license:'Starter'},ti)).rejects.toThrow('dominio asignado');
  });
  it('rejects a principal belonging to another identity when delivering an alias',async()=>{
    const d={...details,kind:'alias',existingEmail:'other@arschoolglobal.com'};
    const x=service({...base,status:'creating',details:d},(sql,p)=>sql.includes('FROM arm_app.mail_accounts WHERE email=')&&p[0]===d.existingEmail?{rows:[{active:true,identity_key:'OTHER'}]}:undefined);
    await expect(x.service.action(base.id,{version:1,action:'complete',email:'demo.arm@armglobal.org',workspaceChecked:true,mfaConfirmed:true,secureDelivery:true,license:'Sin licencia adicional'},ti)).rejects.toThrow('misma persona');
  });
  it('deactivates the principal and its aliases on an approved offboarding',async()=>{
    const d={...details,operation:'offboard',existingEmail:'demo.arm@armglobal.org',reason:'Salida'};
    const x=service({...base,status:'creating',details:d},sql=>sql.includes('FROM arm_app.mail_accounts WHERE email=')?{rows:[{id:'account',identity_key:identityKey(details.employeeId)}]}:undefined);
    await x.service.action(base.id,{version:1,action:'complete',email:d.existingEmail,workspaceChecked:true,accessRevoked:true,note:'Accesos revocados y archivos transferidos'},ti);
    expect(x.query.mock.calls.some(([sql])=>sql.includes('WHERE id=$1 OR primary_id=$1'))).toBe(true);
  });
  it('renames an existing principal while preserving its ID and alias relationships',async()=>{
    const d={...details,operation:'change',existingEmail:'demo.arm@armglobal.org',reason:'Cambio de apellido'};
    const x=service({...base,status:'creating',details:d},(sql,p)=>sql.includes('FROM arm_app.mail_accounts WHERE email=')&&p[0]===d.existingEmail?{rows:[{id:'principal',kind:'collaborator',identity_key:identityKey(details.employeeId)}]}:undefined);
    await x.service.action(base.id,{version:1,action:'complete',email:'demo.nuevo@armglobal.org',workspaceChecked:true,mfaConfirmed:true,secureDelivery:true,license:'Starter'},ti);
    const update=x.query.mock.calls.find(([sql])=>sql.includes('UPDATE arm_app.mail_accounts SET owner_name'));
    expect(update?.[1][0]).toBe('principal');
    expect(update?.[1][7]).toBe('demo.nuevo@armglobal.org');
  });
});
