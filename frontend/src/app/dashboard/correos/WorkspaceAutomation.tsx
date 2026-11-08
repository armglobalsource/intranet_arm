'use client';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { MailRequest } from './mail.types';
import s from './mail.module.css';

export function WorkspaceAutomation({r,onChanged}:{r:MailRequest;onChanged:()=>void}) {
  const job=r.workspace;
  const offboard=r.details.operation==='offboard';
  const [email,setEmail]=useState(job?.plan.email??(offboard?r.details.existingEmail??'':`${r.details.suggestedName}@armglobal.org`));
  const [groups,setGroups]=useState<string[]>(job?.plan.groupEmails??[]);
  const [search,setSearch]=useState('');
  const [identity,setIdentity]=useState(false);
  const [licenseChecked,setLicenseChecked]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [offboardChecked,setOffboardChecked]=useState(false);
  const [note,setNote]=useState('');
  const license=job?.plan.license??'Google Workspace para organizaciones sin fines de lucro · asignación automática';
  const status=useQuery<{automation:boolean}>({queryKey:['institutional-mail','workspace'],queryFn:async()=>(await api.get('/institutional-mail/workspace')).data});
  const directory=useQuery<{id:string;email:string;name:string}[]>({queryKey:['institutional-mail','workspace-groups'],queryFn:async()=>(await api.get('/institutional-mail/workspace/groups')).data,enabled:status.data?.automation===true&&!job&&!offboard,retry:false});
  const action=useMutation({mutationFn:async(step:'execute'|'invite'|'complete')=>api.post(`/institutional-mail/${r.id}/workspace/${step}`,step==='execute'?{version:r.version,email,license,groupEmails:groups,identityConfirmed:identity,licenseConfirmed:licenseChecked}:step==='complete'?{version:r.version,action:'complete',accessRevoked:offboardChecked,note}:{version:r.version}),onSettled:()=>{setConfirm(false);onChanged();}});
  const ready=job?.state==='ready';
  return <section className={s.card} aria-labelledby="workspace-actions-title">
    <div className={s.eyebrow}>Google Workspace · ARM Global</div><h2 id="workspace-actions-title" style={{marginTop:8}}>{offboard?'Suspender cuenta':'Crear y entregar el correo'}</h2>
    <p className={s.muted}>{offboard?'La suspensión bloquea el acceso y conserva los datos. La revisión de sesiones, archivos y licencia sigue a cargo de TI.':'La solicitud ya fue aprobada. Revisa el correo y los grupos antes de ejecutar. El destinatario definirá su contraseña mediante un enlace personal.'}</p>
    {status.isError&&<p className={s.error} role="alert">No se pudo consultar la automatización. <button onClick={()=>status.refetch()}>Reintentar</button></p>}
    {status.data&&!status.data.automation&&<p className={s.notice}>La conexión está preparada; la ejecución automática todavía no está habilitada en producción.</p>}
    <ol className={s.steps} aria-label="Avance de la cuenta">
      <li data-done={ready}><strong>1. {offboard?'Suspensión':'Creación'}</strong><span>{ready?'Confirmada en Google':job?'Ejecución por completar':'Pendiente de TI'}</span></li>
      {!offboard&&<><li data-done={!!job?.invitation_sent_at}><strong>2. Entrega segura</strong><span>{job?.activated_at?'Contraseña inicial definida':job?.invitation_sent_at?'Enlace enviado':'Enlace pendiente'}</span></li><li data-done={r.status==='delivered'}><strong>3. Verificación</strong><span>{r.status==='delivered'?'Buzón y MFA confirmados':'Activación, buzón y MFA'}</span></li></>}
    </ol>
    <fieldset disabled={action.isPending||!status.data?.automation}>
      {!job&&<>
        <div className={s.grid}>
          <label className={`${s.field} ${s.wide}`}>Correo que se {offboard?'suspenderá':'creará'}<input type="email" value={email} readOnly={offboard} onChange={e=>{setEmail(e.target.value.toLowerCase());setConfirm(false);}}/></label>
          {!offboard&&<div className={`${s.field} ${s.wide}`}>Entrega del acceso<strong>{r.details.deliveryEmail||'Falta el correo de contacto: solicita una corrección antes de ejecutar.'}</strong><small>Este destinatario forma parte de la solicitud aprobada.</small></div>}
        </div>
        {!offboard&&<div className={s.groupPicker}><label className={s.field}>Grupos que se agregarán<input placeholder="Buscar por nombre o correo" value={search} onChange={e=>setSearch(e.target.value)}/></label>
          <p className={s.muted}>Solicitud: {r.details.groups}. Se agregarán únicamente los grupos marcados, como miembro.</p>
          {directory.isPending&&<p role="status">Consultando grupos…</p>}
          {directory.isError&&<p className={s.error}>No se pudieron consultar los grupos. <button onClick={()=>directory.refetch()}>Reintentar</button></p>}
          <div className={s.groupList}>{directory.data?.filter(g=>`${g.name} ${g.email}`.toLowerCase().includes(search.toLowerCase())).map(g=><label className={s.check} key={g.id}><input type="checkbox" checked={groups.includes(g.email)} onChange={e=>{setGroups(prev=>e.target.checked?[...prev,g.email]:prev.filter(x=>x!==g.email));setConfirm(false);}}/><span><strong>{g.name||g.email}</strong><small className={s.muted} style={{display:'block',overflowWrap:'anywhere'}}>{g.email}</small></span></label>)}</div>
          <small>{groups.length} seleccionados · máximo 20. Sin selección no se agregan grupos.</small>
        </div>}
        <label className={s.check}><input type="checkbox" checked={identity} onChange={e=>setIdentity(e.target.checked)}/><span>Verifiqué la identidad y que no existe otra cuenta principal para esta persona. Los accesos seleccionados corresponden a lo aprobado.</span></label>
        <label className={s.check}><input type="checkbox" checked={licenseChecked} onChange={e=>setLicenseChecked(e.target.checked)}/><span>{offboard?'Revisé el alcance de la baja y la cuenta indicada.':'Confirmé que hay licencia disponible y que se aplica la asignación automática del plan sin fines de lucro. No se contratará una licencia desde este módulo.'}</span></label>
      </>}
      {job&&<div className={s.notice}><strong>{job.plan.email}</strong><br/>{job.plan.groupEmails.length?`Grupos: ${job.plan.groupEmails.join(', ')}`:'Sin grupos adicionales.'}{job.last_error&&<p>{job.last_error}</p>}</div>}
      {!ready&&<div className={s.actions}>{!confirm?<button className={s.primary} disabled={(!job&&(!identity||!licenseChecked||!email||(!offboard&&(!r.details.deliveryEmail||!directory.isSuccess))))||groups.length>20} onClick={()=>setConfirm(true)}>{job?'Reanudar ejecución':'Revisar y ejecutar'}</button>:<div className={s.notice} role="alert"><p>Se {offboard?'suspenderá':'creará'} <b>{job?.plan.email??email}</b> en Google Workspace.{!offboard&&' El acceso quedará pendiente de activación.'}</p><div className={s.actions}><button onClick={()=>setConfirm(false)}>Volver</button><button className={s.primary} onClick={()=>action.mutate('execute')}>{offboard?'Confirmar suspensión':'Confirmar ejecución en Google'}</button></div></div>}</div>}
      {ready&&!offboard&&<div className={s.actions}>{!job.activated_at&&<button onClick={()=>action.mutate('invite')}>{job.invitation_sent_at?'Enviar un nuevo enlace':'Enviar enlace de activación'}</button>}<button className={s.primary} onClick={()=>action.mutate('complete')}>Verificar buzón y MFA para cerrar</button></div>}
      {ready&&offboard&&<><label className={s.field}>Resultado de la revisión<textarea value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></label><label className={s.check}><input type="checkbox" checked={offboardChecked} onChange={e=>setOffboardChecked(e.target.checked)}/><span>Revisé sesiones y accesos, tratamiento de archivos, alias y licencia después de la suspensión.</span></label><button className={s.primary} disabled={!note.trim()||!offboardChecked} onClick={()=>action.mutate('complete')}>Verificar suspensión y cerrar baja</button></>}
      {action.isPending&&<p role="status">Procesando… Puedes volver a esta solicitud para consultar el resultado.</p>}
      {action.isError&&<p className={s.error} role="alert">{apiErrorMessage(action.error,'La operación no se completó. Actualiza y revisa el estado antes de reintentar.')}</p>}
      {action.isSuccess&&<p className={s.notice} role="status">Paso confirmado. El estado de la solicitud se ha actualizado.</p>}
    </fieldset>
  </section>;
}
