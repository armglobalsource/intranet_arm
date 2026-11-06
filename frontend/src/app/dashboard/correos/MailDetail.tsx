'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';
import { dateLabel, domains, kindNames, MailRequest, operationNames, statusNames } from './mail.types';
import s from './mail.module.css';
const actions:Record<string,string>={submitted:'Solicitud enviada',resubmitted:'Corrección enviada',approve:'Aprobador aprobó',observe:'Observaciones',reject:'Solicitud rechazada',start:'TI inició la gestión',complete:'Gestión completada'};

export function MailDetail({r,onChanged,onEdit,onBack}:{r:MailRequest;onChanged:()=>void;onEdit:()=>void;onBack:()=>void}) {
  const userId=useAuthStore(x=>x.user?.id);
  const d=r.details;
  const [note,setNote]=useState('');
  const [email,setEmail]=useState(d.operation==='create'?`${d.suggestedName}@${domains[d.company]}`:d.existingEmail ?? '');
  const [license,setLicense]=useState(d.kind==='alias'?'Sin licencia adicional':'');
  const [groups,setGroups]=useState(d.groups);
  const [checked,setChecked]=useState({workspaceChecked:false,mfaConfirmed:false,secureDelivery:false,accessRevoked:false});
  const [localError,setLocalError]=useState('');
  const mutation=useMutation({mutationFn:async(action:string)=>api.post(`/institutional-mail/${r.id}/actions`,{action,version:r.version,note,...checked,...(action==='complete'?{email,license,groups}:{})}),onSuccess:()=>{setNote('');onChanged();}});
  const act=(action:string)=>{
    setLocalError('');
    if (['observe','reject'].includes(action)&&!note.trim()) {setLocalError('Escribe el motivo antes de continuar.');return;}
    mutation.mutate(action);
  };
  const approver=r.status==='approval'&&r.canApprove;
  const it=r.canManage&&['validation','creating'].includes(r.status);
  const deliver=it&&r.status==='creating'&&Number(r.assigned_to)===userId;
  const fields=[['Solicitante',r.requester_name],['Aprobador',r.manager_name],['Colaborador',d.name],['RUT / ID',d.employeeId],['Empresa',d.company==='arm'?'ARMGLOBAL':'AR School Global'],['Dominio asignado',domains[d.company]],['Tipo de cuenta',kindNames[d.kind]],['Área y cargo',`${d.area} · ${d.jobTitle}`],['Fecha solicitada',d.startsOn],['Vencimiento',d.expiresOn],['Correo sugerido',d.operation==='create'?`${d.suggestedName}@${domains[d.company]}`:undefined],['Correo existente',d.existingEmail],['Responsable titular',d.responsible],['Grupos y accesos',d.groups],['Motivo / observaciones',d.reason],['Responsable TI',r.assignee_name]];
  return <>
    <div className={s.toolbar}><button onClick={onBack}>← Volver a solicitudes</button><span className={s.badge} data-status={r.status}>{statusNames[r.status]}</span></div>
    <section className={s.card}><div className={s.eyebrow}>{operationNames[d.operation]}</div><h2 style={{marginTop:7}}>{d.name}</h2><p className={s.muted}>Solicitud {r.id.slice(0,8).toUpperCase()}</p>
      <dl className={s.details}>{fields.filter(([,value])=>value).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {r.canRevise&&<div className={s.actions}><button className={s.primary} onClick={onEdit}>Corregir y reenviar</button></div>}
    </section>
    {(approver||it)&&<section className={s.card} aria-labelledby="action-title"><h2 id="action-title">{approver?'Revisión del aprobador':deliver?'Registrar resultado de TI':'Validación TI'}</h2>
      <p className={s.muted}>{approver?'Revisa identidad, cargo, empresa y accesos antes de aprobar.':'La operación se realiza manualmente en Google Workspace. Aquí queda su resultado y trazabilidad.'}</p>
      <fieldset disabled={mutation.isPending}>
        {it&&<label className={s.check}><input type="checkbox" checked={checked.workspaceChecked} onChange={e=>setChecked({...checked,workspaceChecked:e.target.checked})}/><span>Verifiqué identidad, dominio, duplicados, licencia y accesos en Google Workspace.{d.kind==='alias'?' Confirmé que el alias pertenece a la misma persona y que ambos dominios permiten asociarlo a una sola cuenta principal.':''}</span></label>}
        {deliver&&<>
          <div className={s.grid} style={{margin:'12px 0'}}>
            <label className={`${s.field} ${s.wide}`}>Correo final<input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value.toLowerCase())}/></label>
            {d.operation!=='offboard'&&<><label className={s.field}>Licencia aplicada<input value={license} maxLength={160} onChange={e=>setLicense(e.target.value)} readOnly={d.kind==='alias'} placeholder="Ej.: Workspace Business Starter"/></label><label className={s.field}>Grupos / accesos aplicados<textarea value={groups} maxLength={2000} onChange={e=>setGroups(e.target.value)}/></label></>}
          </div>
          {d.operation==='offboard'?<label className={s.check}><input type="checkbox" checked={checked.accessRevoked} onChange={e=>setChecked({...checked,accessRevoked:e.target.checked})}/><span>La baja ya se ejecutó: accesos y sesiones revocados; tratamiento de datos y licencias revisado. Si es cuenta principal, se revisaron también sus alias.</span></label>:<>
            <label className={s.check}><input type="checkbox" checked={checked.mfaConfirmed} onChange={e=>setChecked({...checked,mfaConfirmed:e.target.checked})}/><span>MFA obligatorio verificado en la cuenta principal.</span></label>
            <label className={s.check}><input type="checkbox" checked={checked.secureDelivery} onChange={e=>setChecked({...checked,secureDelivery:e.target.checked})}/><span>Acceso entregado por un canal seguro y cambio inicial de contraseña exigido cuando corresponde. No guardé credenciales aquí.</span></label>
          </>}
        </>}
        <label className={s.field} style={{marginTop:12}}>Nota para el solicitante<textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Motivo de observación/rechazo o resultado de la gestión"/><small>Obligatoria para observar, rechazar o completar una baja. No incluyas contraseñas.</small></label>
        {(localError||mutation.isError)&&<p role="alert" className={s.error}>{localError||apiErrorMessage(mutation.error,'No se pudo actualizar. Vuelve a cargar la solicitud.')}</p>}
        <div className={s.actions}>
          {approver&&<button className={s.primary} onClick={()=>act('approve')}>Aprobar y enviar a TI</button>}
          {it&&r.status==='validation'&&<button className={s.primary} disabled={!checked.workspaceChecked} onClick={()=>act('start')}>Tomar solicitud e iniciar</button>}
          {deliver&&<button className={s.primary} disabled={!checked.workspaceChecked||!email||(d.operation==='offboard'?!checked.accessRevoked:!checked.mfaConfirmed||!checked.secureDelivery||!license.trim())} onClick={()=>act('complete')}>Confirmar gestión realizada</button>}
          <button onClick={()=>act('observe')}>Solicitar corrección</button><button className={s.danger} onClick={()=>act('reject')}>Rechazar solicitud</button>
        </div>
        {it&&r.status==='creating'&&!deliver&&<p className={s.notice} style={{marginTop:14}}>La entrega debe registrarla {r.assignee_name}, quien tomó esta solicitud.</p>}
      </fieldset>
    </section>}
    <section className={s.card}><h2>Historial de la solicitud</h2><div className={s.timeline}>{r.events.map(e=><article key={e.id} className={s.event}><strong>{actions[e.action]??e.action}</strong><time>{dateLabel(e.created_at)} · {e.actor_name}</time>{e.note&&<p>{e.note}</p>}{typeof e.snapshot.email==='string'&&<p>Correo: <b>{e.snapshot.email}</b></p>}{typeof e.snapshot.license==='string'&&e.snapshot.license&&<p>Licencia: {e.snapshot.license}</p>}{typeof e.snapshot.groups==='string'&&e.snapshot.groups&&<p>Accesos: {e.snapshot.groups}</p>}</article>)}</div></section>
  </>;
}
