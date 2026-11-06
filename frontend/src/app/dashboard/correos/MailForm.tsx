'use client';
import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';
import { domains, kindNames, MailDetails, MailRequest, operationNames, Options } from './mail.types';
import s from './mail.module.css';

export function MailForm({options,request,initial,onSaved,onCancel}:{options:Options;request?:MailRequest;initial?:MailDetails;onSaved:(id:string)=>void;onCancel:()=>void}) {
  const user=useAuthStore(x=>x.user);
  const [d,setD]=useState<MailDetails>(request?.details ?? initial ?? {operation:'create',company:'arm',kind:'collaborator',name:`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),employeeId:'',area:'',jobTitle:'',startsOn:new Date().toLocaleDateString('en-CA'),suggestedName:'',groups:'',reason:''});
  const managerId=options.managers[0]?.id;
  function field<K extends keyof MailDetails>(key:K,value:MailDetails[K]) { setD(prev=>({...prev,[key]:value})); }
  const save=useMutation({mutationFn:async()=>{
    const {domain,...details}=d;
    const body={managerId:Number(managerId),details};
    return (request ? await api.patch(`/institutional-mail/${request.id}`,{...body,version:request.version}) : await api.post('/institutional-mail',body)).data;
  },onSuccess:data=>onSaved(data.id)});
  function submit(e:FormEvent){e.preventDefault();save.mutate();}
  const suggested=()=>d.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0,2).join('.').replace(/[^a-z0-9.]/g,'');
  return <section className={s.card} aria-labelledby="request-title">
    <h2 id="request-title">{request?'Corregir solicitud':'Nueva solicitud'}</h2>
    <p className={s.muted}>Completa los datos para revisión del aprobador y TI. Los campos sin «opcional» son obligatorios.</p>
    <div className={s.notice} style={{marginTop:16}}>La empresa determina el dominio. Si necesitas ambos dominios, solicita un alias de tu cuenta principal.</div>
    {!options.managers.length&&<div className={s.error}>El aprobador designado no está disponible o eres tú mismo. Contacta al administrador.</div>}
    <form onSubmit={submit}>
      <fieldset disabled={save.isPending} className={s.grid}>
        <label className={s.field}>¿Qué necesitas?<select value={d.operation} onChange={e=>field('operation',e.target.value as MailDetails['operation'])}>{Object.entries(operationNames).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label className={s.field}>Empresa / unidad<select value={d.company} onChange={e=>field('company',e.target.value as MailDetails['company'])}><option value="arm">ARMGLOBAL</option><option value="school">AR School Global</option></select></label>
        <label className={s.field}>Tipo de cuenta<select value={d.kind} onChange={e=>field('kind',e.target.value)}>{Object.entries(kindNames).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <div className={s.field}>Aprobador<span className={s.domain}>Pastor · pburgos@armglobal.org</span><small>Las solicitudes se envían automáticamente al aprobador designado.</small></div>
        <label className={s.field}>Nombre y apellido<input required minLength={2} maxLength={160} autoComplete="name" value={d.name} onChange={e=>field('name',e.target.value)}/></label>
        <label className={s.field}>RUT o ID de colaborador<input required minLength={3} maxLength={60} value={d.employeeId} onChange={e=>field('employeeId',e.target.value)}/><small>Usa siempre el mismo identificador para evitar cuentas duplicadas.</small></label>
        <label className={s.field}>Área<input required minLength={2} maxLength={160} value={d.area} onChange={e=>field('area',e.target.value)}/></label>
        <label className={s.field}>Cargo<input required minLength={2} maxLength={160} value={d.jobTitle} onChange={e=>field('jobTitle',e.target.value)}/></label>
        <label className={s.field}>{d.operation==='offboard'?'Fecha efectiva de baja':'Fecha de ingreso / aplicación'}<input required type="date" value={d.startsOn} onChange={e=>field('startsOn',e.target.value)}/></label>
        {(d.kind==='temporary'||d.expiresOn)&&d.operation!=='offboard'&&<label className={s.field}>Vencimiento<input required type="date" min={d.startsOn} value={d.expiresOn ?? ''} onChange={e=>field('expiresOn',e.target.value)}/><small>TI verá la revisión pendiente desde 7 días antes.</small></label>}
        {(d.kind==='alias'||d.operation!=='create')&&<label className={`${s.field} ${s.wide}`}>{d.kind==='alias'&&d.operation==='create'?'Correo de la cuenta principal':'Correo existente'}<input required type="email" maxLength={254} value={d.existingEmail ?? ''} onChange={e=>field('existingEmail',e.target.value.trim().toLowerCase())}/><small>{d.kind==='alias'?'TI verificará que sea la misma persona y que ambos dominios permitan el alias.':'La cuenta será validada por TI antes de aplicar cambios.'}</small></label>}
        {d.operation==='create'&&<div className={`${s.field} ${s.wide}`}><label htmlFor="suggested-mail">Nombre sugerido para el correo</label><input id="suggested-mail" required maxLength={64} pattern="[a-z0-9][a-z0-9._\-]{1,63}" placeholder="nombre.apellido" value={d.suggestedName} onChange={e=>field('suggestedName',e.target.value.toLowerCase())}/><span className={s.domain}>{d.suggestedName||'nombre.apellido'}@{domains[d.company]}</span><button type="button" onClick={()=>field('suggestedName',suggested())}>Sugerir a partir del nombre</button><small>TI confirma disponibilidad. Ante duplicados: nombre.apellido2, nombre.apellido3…</small></div>}
        {d.kind==='functional'&&<label className={`${s.field} ${s.wide}`}>Responsable titular<input required maxLength={160} value={d.responsible ?? ''} onChange={e=>field('responsible',e.target.value)}/></label>}
        <label className={`${s.field} ${s.wide}`}>Grupos o accesos requeridos<textarea required maxLength={2000} placeholder="Ej.: equipo de comunicaciones. Si no requiere grupos, indica Ninguno." value={d.groups} onChange={e=>field('groups',e.target.value)}/></label>
        <label className={`${s.field} ${s.wide}`}>{d.operation==='offboard'?'Motivo y tratamiento de accesos / archivos':d.operation==='change'?'Cambios que necesitas':d.kind==='functional'?'Justificación':'Observaciones (opcional)'}<textarea required={d.operation!=='create'||d.kind==='functional'} maxLength={2000} value={d.reason} onChange={e=>field('reason',e.target.value)}/><small>No escribas contraseñas, códigos MFA ni enlaces de activación.</small></label>
      </fieldset>
      {save.isError&&<p role="alert" className={s.error}>{apiErrorMessage(save.error,'No se pudo enviar la solicitud.')}</p>}
      <div className={s.actions}><button type="button" onClick={onCancel} disabled={save.isPending}>Cancelar</button><button className={s.primary} disabled={save.isPending||!options.managers.length}>{save.isPending?'Enviando…':request?'Corregir y reenviar':'Enviar a aprobación'}</button></div>
    </form>
  </section>;
}
