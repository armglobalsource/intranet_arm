'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiErrorMessage } from '@/lib/api';
import s from './events.module.css';
import { eventPrice } from './event-types';
const labels:Record<string,string>={confirmed:'Confirmada',pending_payment:'Pago pendiente',waitlisted:'Lista de espera',expired:'Reserva vencida',payment_review:'Revisar pago',cancelled:'Cancelada'};
type Participant={id:string;participant:{firstName:string;lastName:string};email:string;campusName:string;status:string;createdAt:string;amount:number;currency:string;paymentId?:string;testPayment?:boolean};
type Verification={ok:boolean;text:string};
/** Estados en que el organizador puede preguntarle a Mercado Pago por el pago. */
const VERIFIABLE=['pending_payment','expired','payment_review'];

export function EventParticipants({id}:{id:string}){
 const query=useQuery({queryKey:['event-participants',id],queryFn:async()=>(await api.get<Participant[]>(`/event-management/${id}/registrations`)).data});
 const [checking,setChecking]=useState<string|null>(null);
 const [results,setResults]=useState<Record<string,Verification>>({});
 async function verify(registrationId:string){
  setChecking(registrationId);
  try{
   const {data}=await api.post<{status:string;message:string}>(`/event-management/${id}/registrations/${registrationId}/verify-payment`);
   setResults(r=>({...r,[registrationId]:{ok:data.status==='confirmed',text:data.message}}));
   await query.refetch();
  }catch(err){
   setResults(r=>({...r,[registrationId]:{ok:false,text:apiErrorMessage(err,'No pudimos consultar a Mercado Pago. Inténtalo de nuevo en unos minutos.')}}));
  }finally{setChecking(null);}
 }
 return <section className={s.panel}><div className={s.toolbar}><h2>Inscripciones</h2><button className={s.button} disabled={query.isFetching} onClick={()=>query.refetch()}>Actualizar</button></div><p className={s.muted}>Últimas 500 solicitudes. Las reservas vencidas y las personas en espera no tienen una entrada confirmada. Las inscripciones de prueba se identifican por separado.</p>{query.isPending&&<p role="status">Cargando participantes…</p>}{query.isError&&<p className={s.error} role="alert">{apiErrorMessage(query.error,'No pudimos cargar las inscripciones.')}</p>}{query.data?.length===0&&<p>Todavía no hay inscripciones.</p>}<div className={s.grid}>{query.data?.map(r=>{
  const canVerify=Number(r.amount)>0&&VERIFIABLE.includes(r.status);
  const result=results[r.id];
  return <article className={s.card} key={r.id}><div className={s.cardBody}><span className={s.badge}>{labels[r.status]||r.status}{r.testPayment?' · Prueba':''}</span><h3>{r.participant.firstName} {r.participant.lastName}</h3><p className={s.prose}>{r.email}</p><p>{r.campusName}</p><p>{Number(r.amount)>0?eventPrice({name:'Entrada',price:Number(r.amount),currency:r.currency}):'Gratuito'}</p>{r.paymentId&&<p className={s.prose}>Pago Mercado Pago: {r.paymentId}</p>}{r.status==='payment_review'&&<p className={s.muted}>Revisa el pago en la cuenta receptora antes de confirmar cupo o tramitar un reembolso.</p>}
   {canVerify&&<div className={s.actions}><button type="button" className={s.button} disabled={checking===r.id} onClick={()=>void verify(r.id)}>{checking===r.id?'Consultando a Mercado Pago…':'Verificar pago con Mercado Pago'}</button></div>}
   {result&&<p role={result.ok?'status':'alert'} className={result.ok?s.success:s.notice}>{result.text}</p>}
   <small>{new Date(r.createdAt).toLocaleString('es-CL')}</small></div></article>;
 })}</div></section>;
}
