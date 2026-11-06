'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import { MailForm } from './MailForm';
import { MailDetail } from './MailDetail';
import { WorkspaceConnection } from './WorkspaceConnection';
import { dateLabel, MailDetails, MailRequest, operationNames, Options, RequestSummary, statusNames } from './mail.types';
import s from './mail.module.css';
type Account={id:string;email:string;owner_name:string;kind:string;active:boolean;expires_on:string|null;review_on:string|null;primary_email:string|null;license:string;groups_text:string;last_request_id:string;total:string;request_details:MailDetails};

export function MailWorkspace() {
  const qc=useQueryClient();
  const [view,setView]=useState('mine');
  const [page,setPage]=useState(1);
  const [status,setStatus]=useState('');
  const [due,setDue]=useState(false);
  const [id,setId]=useState<string|null>(null);
  const [editing,setEditing]=useState(false);
  const [creating,setCreating]=useState(false);
  const [initial,setInitial]=useState<MailDetails>();
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get('request');if(value)setId(value);},[]);
  const options=useQuery<Options>({queryKey:['institutional-mail','options'],queryFn:async()=>(await api.get('/institutional-mail/options')).data});
  const list=useQuery<{items:RequestSummary[];total:number}>({queryKey:['institutional-mail','list',view,status,page],queryFn:async()=>(await api.get('/institutional-mail',{params:{view,status,page}})).data,enabled:!!options.data&&view!=='accounts'&&!id&&!creating});
  const accounts=useQuery<Account[]>({queryKey:['institutional-mail','accounts',due,page],queryFn:async()=>(await api.get('/institutional-mail/accounts',{params:{due,page}})).data,enabled:!!options.data?.canManage&&view==='accounts'&&!id&&!creating});
  const detail=useQuery<MailRequest>({queryKey:['institutional-mail','detail',id],queryFn:async()=>(await api.get(`/institutional-mail/${id}`)).data,enabled:!!id});
  function open(next:string|null){setId(next);setEditing(false);setCreating(false);const url=new URL(window.location.href);if(next)url.searchParams.set('request',next);else url.searchParams.delete('request');window.history.replaceState(null,'',url.toString());}
  function refresh(){qc.invalidateQueries({queryKey:['institutional-mail']});qc.invalidateQueries({queryKey:['notifications']});}
  function saved(next:string){refresh();open(next);}
  function fromAccount(a:Account,operation:'change'|'offboard') {
    open(null);
    setInitial({...a.request_details,operation,company:a.email.endsWith('@armglobal.org')?'arm':'school',kind:a.kind,
      existingEmail:a.email,startsOn:new Date().toLocaleDateString('en-CA'),groups:a.groups_text||'Ninguno',reason:'',
      expiresOn:operation==='offboard'?undefined:a.expires_on?.slice(0,10)});
    setCreating(true);
  }
  const changeView=(next:string)=>{setView(next);setPage(1);setStatus('');open(null);};
  const total=view==='accounts'?Number(accounts.data?.[0]?.total??0):list.data?.total??0;
  return <div className={s.workspace}>
    <header className={s.heading}><div><div className={s.eyebrow}>Servicios internos</div><h1>Correos y accesos</h1><p className={s.muted}>Solicita, aprueba y acompaña cada gestión en un solo lugar.</p></div><button className={s.primary} onClick={()=>{open(null);setInitial(undefined);setCreating(true);}} disabled={!options.data}>+ Nueva solicitud</button></header>
    <nav className={s.tabs} aria-label="Bandejas de correos">
      {([['mine','Mis solicitudes'],...(options.data?.canApprove?[['approvals','Aprobaciones']]:[]),...(options.data?.canManage?[['it','Gestión TI'],['accounts','Cuentas institucionales']]:[])]).map(([key,label])=><button key={key} aria-pressed={view===key&&!creating&&!id} className={view===key&&!creating&&!id?s.selected:''} onClick={()=>changeView(key)}>{label}</button>)}
    </nav>
    {options.data?.canManage&&view==='it'&&!id&&!creating&&<WorkspaceConnection/>}
    {!!options.data?.dueReviews&&!id&&!creating&&<div className={s.notice}>{options.data.dueReviews} cuenta(s) con revisión pendiente por vencimiento. <button onClick={()=>{changeView('accounts');setDue(true);}}>Revisar cuentas</button></div>}
    {options.isPending&&<p className={s.empty} role="status">Cargando tu espacio…</p>}
    {options.isError&&<div className={s.error} role="alert">{apiErrorMessage(options.error,'No se pudo cargar el módulo.')} <button onClick={()=>options.refetch()}>Reintentar</button></div>}
    {options.data&&(creating||(editing&&detail.data))?<MailForm key={creating?`new-${initial?.existingEmail??''}-${initial?.operation??''}`:`edit-${id}`} options={options.data} initial={initial} request={editing?detail.data:undefined} onSaved={saved} onCancel={()=>{setCreating(false);setEditing(false);}}/>:id?<>
      {detail.isPending&&<p className={s.empty}>Cargando solicitud…</p>}
      {detail.isError&&<div className={s.error} role="alert">{apiErrorMessage(detail.error,'No se pudo abrir la solicitud.')} <button onClick={()=>detail.refetch()}>Reintentar</button><button onClick={()=>open(null)}>Volver</button></div>}
      {detail.data&&<MailDetail key={`${id}-${detail.data.version}`} r={detail.data} onChanged={refresh} onEdit={()=>setEditing(true)} onBack={()=>open(null)}/>}
    </>:options.data&&<>
      <div className={s.toolbar}><div><h2 style={{fontSize:18,fontWeight:700}}>{view==='accounts'?'Inventario de cuentas':view==='approvals'?'Solicitudes asignadas a ti':view==='it'?'Bandeja de TI':'Seguimiento de tus solicitudes'}</h2><p className={s.muted}>{view==='accounts'?'Cuentas registradas al completar gestiones en este módulo.':view==='approvals'?'La aprobación habilita la revisión de TI.':'Aprobador → Validación TI → Ejecución → Entrega'}</p></div>
        {view==='accounts'?<button className={due?s.selected:''} aria-pressed={due} onClick={()=>{setDue(!due);setPage(1);}}>{due?'Ver todas las cuentas':'Revisiones por vencimiento'}</button>:<label className={s.field}>Estado<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Todos los estados</option>{Object.entries(statusNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}
      </div>
      {view==='accounts'?<>
        {due&&<p className={s.notice}>Revisa estas cuentas temporales: faltan 7 días o menos para vencer, o su fecha ya pasó. Solicita un cambio para renovarlas o una baja para cerrarlas. La suspensión en Google Workspace la realiza TI.</p>}
        {accounts.isPending&&<p role="status" className={s.empty}>Cargando cuentas…</p>}
        {accounts.isError&&<div role="alert" className={s.error}>{apiErrorMessage(accounts.error,'No se pudo cargar el inventario.')} <button onClick={()=>accounts.refetch()}>Reintentar</button></div>}
        {accounts.data?.length===0&&<p className={s.empty}>{due?'No hay revisiones pendientes por vencimiento.':'Todavía no hay cuentas registradas. Aparecerán al completar una gestión de TI.'}</p>}
        {accounts.data?.map(a=><article key={a.id} className={s.card}><div className={s.toolbar}><h3 style={{overflowWrap:'anywhere',margin:0}}>{a.email}</h3><span className={s.badge}>{a.active?'Activa':'Baja registrada'}</span></div><p>{a.owner_name}</p>{a.primary_email&&<p className={s.muted} style={{overflowWrap:'anywhere'}}>Alias de {a.primary_email}</p>}<p className={s.muted}>{a.license} · {a.groups_text||'Sin grupos registrados'}</p>{a.expires_on&&<p style={{marginTop:8}}>Vence: <b>{a.expires_on.slice(0,10)}</b> · Revisar desde {a.review_on?.slice(0,10)}</p>}<div className={s.actions}><button onClick={()=>open(a.last_request_id)}>Ver última gestión</button><button onClick={()=>fromAccount(a,'change')}>Solicitar cambio / renovación</button>{a.active&&<button className={s.danger} onClick={()=>fromAccount(a,'offboard')}>Solicitar baja</button>}</div></article>)}
      </>:<>
        {list.isPending&&<p role="status" className={s.empty}>Cargando solicitudes…</p>}
        {list.isError&&<div role="alert" className={s.error}>{apiErrorMessage(list.error,'No se pudo cargar la bandeja.')} <button onClick={()=>list.refetch()}>Reintentar</button></div>}
        {list.data?.items.length===0&&<div className={s.empty}>No hay solicitudes en esta vista.{view==='mine'&&<p>Usa «Nueva solicitud» para pedir un correo, un cambio de accesos o una baja.</p>}</div>}
        <div className={s.list}>{list.data?.items.map(r=><button className={s.request} key={r.id} onClick={()=>open(r.id)}><span><strong>{r.name}</strong><small>{operationNames[r.operation]} · {r.company==='arm'?'ARMGLOBAL':'AR School Global'}<br/>{dateLabel(r.created_at)} · #{r.id.slice(0,8).toUpperCase()}</small></span><span className={s.badge} data-status={r.status}>{statusNames[r.status]}</span></button>)}</div>
      </>}
      {(total>30||page>1)&&<div className={s.pagination}><button disabled={page===1} onClick={()=>setPage(page-1)}>Anterior</button><span>Página {page}</span><button disabled={page*30>=total} onClick={()=>setPage(page+1)}>Siguiente</button></div>}
    </>}
  </div>;
}
