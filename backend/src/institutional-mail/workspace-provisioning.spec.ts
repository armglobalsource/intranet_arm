import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { WorkspaceProvisioningService } from './workspace-provisioning.service';
import { WorkspaceDirectory } from './workspace.service';
import { WorkspacePlanDto } from './mail.dto';

const actor={sub:3,permissions:['institutional-mail:manage']};
const id='00000000-0000-4000-8000-000000000001';
const row={id,assigned_to:3,requester_id:1,status:'creating',version:4,details:{operation:'create',company:'arm',kind:'collaborator',name:'Demo ARM',employeeId:'demo-1',deliveryEmail:'recipient@example.com'}};
const plan={email:'demo@armglobal.org',license:'Nonprofit',groupEmails:[],operation:'create',deliveryEmail:'recipient@example.com',name:'Demo ARM'};
const dto={...plan,version:4,identityConfirmed:true,licenseConfirmed:true};
const user={id:'google-1',primaryEmail:plan.email,externalIds:[{type:'custom',customType:'ecosistema-request',value:id}]};
function setup(options:{request?:any;job?:any;extra?:(sql:string,p:any[])=>any}={}) {
  let job=options.job;
  const query=vi.fn(async(sql:string,p:any[]=[])=>{
    if(sql.includes('FROM arm_app.mail_requests WHERE id=$1 FOR UPDATE'))return {rows:[options.request??row]};
    if(sql.startsWith('SELECT')&&sql.includes('mail_workspace_jobs')&&!sql.includes('UNION'))return {rows:job?[job]:[]};
    if(sql.startsWith('INSERT INTO arm_app.mail_workspace_jobs'))job={request_id:id,plan:JSON.parse(p[1]),state:'prepared'};
    return options.extra?.(sql,p)??{rows:[]};
  });
  const directory={user:vi.fn().mockResolvedValue(null),groups:vi.fn().mockResolvedValue([]),create:vi.fn().mockResolvedValue(user),addMember:vi.fn(),activate:vi.fn(),suspend:vi.fn()};
  const workspace={requireAutomation:vi.fn(),directory:vi.fn().mockResolvedValue(directory)};
  const mailer={settings:vi.fn().mockReturnValue({origin:'https://ecosistema.armglobal.org'}),sendHtml:vi.fn().mockResolvedValue({id:'sent'})};
  const mail={action:vi.fn()};
  const service=new WorkspaceProvisioningService({query,transaction:async(fn:any)=>fn({query})} as any,workspace as any,mailer as any,mail as any);
  return {service,query,directory,workspace,mailer,mail};
}
afterEach(()=>vi.unstubAllGlobals());
describe('Workspace execution authorization and recovery',()=>{
  it('rejects requesters, other TI operators, unapproved requests and stale versions before Google calls',async()=>{
    for(const [request,who] of [[row,{sub:1,permissions:[]}],[{...row,assigned_to:8},actor],[{...row,status:'approval'},actor],[{...row,version:5},actor]] as const){
      const s=setup({request});await expect(s.service.execute(id,dto,who)).rejects.toThrow();expect(s.workspace.directory).not.toHaveBeenCalled();
    }
  });
  it('rejects string attestations instead of coercing false to true',async()=>{
    const pipe=new ValidationPipe({transform:true,transformOptions:{enableImplicitConversion:true}});
    await expect(pipe.transform({...dto,identityConfirmed:'false'},{type:'body',metatype:WorkspacePlanDto})).rejects.toThrow();
  });
  it('requires the approved delivery recipient and blocks unconnected domains and aliases',async()=>{
    for(const details of [{...row.details,deliveryEmail:undefined},{...row.details,company:'school'},{...row.details,kind:'alias'}]){
      const s=setup({request:{...row,details}});await expect(s.service.execute(id,dto,actor)).rejects.toThrow();expect(s.directory.create).not.toHaveBeenCalled();
    }
  });
  it('does not reserve or overwrite an existing Google account',async()=>{
    const s=setup();s.directory.user.mockResolvedValue(user as any);
    await expect(s.service.execute(id,dto,actor)).rejects.toThrow('ya existe');
    expect(s.query.mock.calls.some(([sql])=>sql.startsWith('INSERT INTO arm_app.mail_workspace_jobs'))).toBe(false);
    expect(s.directory.create).not.toHaveBeenCalled();
  });
  it('persists intent before creating and resumes the original plan after a timeout',async()=>{
    const s=setup();await s.service.execute(id,dto,actor);
    const inserted=s.query.mock.calls.findIndex(([sql])=>sql.startsWith('INSERT INTO arm_app.mail_workspace_jobs'));
    expect(inserted).toBeGreaterThan(-1);
    expect(s.query.mock.invocationCallOrder[inserted]).toBeLessThan(s.directory.create.mock.invocationCallOrder[0]);
    const retry=setup({job:{state:'failed',plan}});
    await retry.service.execute(id,{...dto,email:'different@armglobal.org'},actor);
    expect(retry.directory.create).toHaveBeenCalledWith(id,plan.email,plan.name);
  });
  it('does not create or add groups again when execution is already ready',async()=>{
    const s=setup({job:{state:'ready',plan}});await s.service.execute(id,dto,actor);expect(s.directory.create).not.toHaveBeenCalled();
  });
  it('requires the account to be active, activated, have a mailbox and enforced/enrolled MFA before completion',async()=>{
    for(const flags of [{},{isEnrolledIn2Sv:true},{isEnrolledIn2Sv:true,isEnforcedIn2Sv:true},{isEnrolledIn2Sv:true,isEnforcedIn2Sv:true,isMailboxSetup:true,suspended:true}]){
      const s=setup({job:{state:'ready',plan,google_id:user.id,activated_at:new Date()}});s.directory.user.mockResolvedValue({...user,...flags} as any);
      await expect(s.service.complete(id,{version:4,action:'complete'},actor)).rejects.toThrow('Falta completar');expect(s.mail.action).not.toHaveBeenCalled();
    }
  });
  it('invalid or consumed activation links cannot call Google',async()=>{
    const s=setup();await expect(s.service.activate('a'.repeat(64),'a-valid-password')).rejects.toThrow('venció');expect(s.workspace.directory).not.toHaveBeenCalled();
  });
  it('consumes activation before Google and never stores the password or raw token',async()=>{
    const token='b'.repeat(64), password='initial-test-password';
    const s=setup({extra:sql=>sql.startsWith('UPDATE arm_app.mail_workspace_jobs j')?{rows:[{request_id:id,google_id:user.id,plan}]}:undefined});
    s.directory.user.mockResolvedValue(user as any);
    await expect(s.service.activate(token,password)).resolves.toEqual({activated:true,email:plan.email});
    expect(s.query.mock.invocationCallOrder[0]).toBeLessThan(s.directory.activate.mock.invocationCallOrder[0]);
    expect(JSON.stringify(s.query.mock.calls)).not.toContain(password);expect(JSON.stringify(s.query.mock.calls)).not.toContain(token);
  });
  it('never emails a password and stores only the activation hash',async()=>{
    const s=setup({job:{state:'ready',plan,google_id:user.id,updated_at:new Date(0)}});
    await s.service.invite(id,4,actor);
    const message=s.mailer.sendHtml.mock.calls[0][0];
    expect(message.to).toEqual([plan.deliveryEmail]);
    const token=message.text.match(/#token=([a-f0-9]{64})/)[1];
    expect(JSON.stringify(s.query.mock.calls)).not.toContain(token);
    expect(message.text).toContain('24 horas');
  });
});

describe('Directory mutation boundaries',()=>{
  it('reconciles only accounts marked with the same request and never resets credentials on retry',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(user)));vi.stubGlobal('fetch',fetch);
    await new WorkspaceDirectory('token').create(id,plan.email,plan.name);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({...user,externalIds:[]}))));
    await expect(new WorkspaceDirectory('token').create(id,plan.email,plan.name)).rejects.toThrow('ya existe');
  });
  it('never suspends administrators or the delegated administrator',async()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    for(const u of [{...user,isAdmin:true},{...user,isDelegatedAdmin:true},{...user,primaryEmail:'contacto@armglobal.org'}])await expect(new WorkspaceDirectory('token').suspend(u)).rejects.toThrow('gestión directa');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('adds only member access and treats an existing member as success',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response('{}',{status:404})).mockResolvedValueOnce(new Response('{}'));vi.stubGlobal('fetch',fetch);
    await new WorkspaceDirectory('token').addMember('team@armglobal.org',user);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({email:plan.email,role:'MEMBER'});
    const existing=vi.fn().mockResolvedValue(new Response('{}'));vi.stubGlobal('fetch',existing);
    await new WorkspaceDirectory('token').addMember('team@armglobal.org',user);expect(existing).toHaveBeenCalledTimes(1);
  });
});
