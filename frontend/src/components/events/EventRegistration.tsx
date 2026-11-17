'use client';
import { FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { api, apiErrorMessage } from '@/lib/api';
import { eventDate, eventPrice, PublicEvent } from './event-types';
import s from './events.module.css';

type Receipt={id:string;token:string;status:string;participantName:string;title:string;startsAt:string;timezone:string;amount:number;currency:string;expiresAt:string|null;emailSent:boolean;testPayment:boolean;ticketCode:string|null};
const labels:Record<string,string>={confirmed:'Inscripción confirmada',pending_payment:'Pendiente de pago de prueba',waitlisted:'En lista de espera',expired:'Reserva vencida',payment_review:'Pago en revisión',cancelled:'Inscripción cancelada'};
const post=async(path:string,body:unknown)=>(await axios.post(`${api.defaults.baseURL}${path}`,body)).data;
function remember(slug:string,r:Receipt){sessionStorage.setItem(`event-receipt:${slug}`,JSON.stringify({id:r.id,token:r.token}));}

export function EventRegistrationForm({event:e}:{event:PublicEvent}){
 const [step,setStep]=useState(0);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const [form,setForm]=useState({firstName:'',lastName:'',email:'',phone:'',campusId:'',age:'',ticketTypeId:'',consent:false});
 async function submit(ev:FormEvent){
  ev.preventDefault();if(step<2){setStep(step+1);return;}
  setBusy(true);setError('');
  try{
   let key=sessionStorage.getItem(`event-request:${e.slug}`);
   if(!key){key=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');sessionStorage.setItem(`event-request:${e.slug}`,key);}
   const r:Receipt=await post(`/public-events/${encodeURIComponent(e.slug)}/registrations`,{...form,campusId:Number(form.campusId),age:form.age?Number(form.age):undefined,ticketTypeId:e.details.pricing==='paid'?form.ticketTypeId:undefined,requestKey:key});
   remember(e.slug,r);window.location.assign(`/eventos/${encodeURIComponent(e.slug)}/inscripcion#id=${r.id}&token=${r.token}`);
  }catch(err){setError(apiErrorMessage(err,'No pudimos registrar tu inscripción. Inténtalo nuevamente.'));setBusy(false);}
 }
 const field=(key:'firstName'|'lastName'|'email'|'phone',label:string,type='text',autoComplete?:string)=><label className={s.field}>{label}<input aria-label={label} type={type} autoComplete={autoComplete} required maxLength={key==='email'?254:key==='phone'?25:80} value={form[key]} onChange={ev=>setForm({...form,[key]:ev.target.value})}/></label>;
 return <section className={s.registration} id="inscribirme"><h2>Inscríbete en este encuentro</h2><ol className={s.registrationSteps} aria-label="Pasos de inscripción">{['Tus datos','Contacto y campus','Confirmación'].map((label,i)=><li key={label} aria-current={step===i?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
  <form onSubmit={submit}><fieldset disabled={busy} className={s.registrationFields}>
   {step===0&&<div className={s.formGrid}>{field('firstName','Nombre','text','given-name')}{field('lastName','Apellido','text','family-name')}{field('email','Correo electrónico','email','email')}{e.details.minimumAge!=null&&<label className={s.field}>Edad<input aria-label="Edad" type="number" required min={e.details.minimumAge} max={120} value={form.age} onChange={ev=>setForm({...form,age:ev.target.value})}/><small>Edad mínima: {e.details.minimumAge} años.</small></label>}</div>}
   {step===1&&<div className={s.formGrid}>{field('phone','Teléfono / WhatsApp','tel','tel')}<label className={s.field}>Campus<select aria-label="Campus" required value={form.campusId} onChange={ev=>setForm({...form,campusId:ev.target.value})}><option value="">Selecciona tu campus</option>{e.campusOptions?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{e.details.pricing==='paid'&&<label className={s.field}>Entrada<select aria-label="Entrada" required value={form.ticketTypeId} onChange={ev=>setForm({...form,ticketTypeId:ev.target.value})}><option value="">Seleccionar entrada</option>{e.ticketTypes.map(t=><option key={t.id} value={t.id}>{t.name} · {eventPrice(t)}</option>)}</select><small>Pago exclusivamente de prueba.</small></label>}</div>}
   {step===2&&<><dl className={s.receiptDetails}><dt>Participante</dt><dd>{form.firstName} {form.lastName}</dd><dt>Correo de confirmación</dt><dd>{form.email}</dd><dt>Campus</dt><dd>{e.campusOptions?.find(c=>String(c.id)===form.campusId)?.name}</dd><dt>Acceso</dt><dd>{e.details.pricing==='free'?'Gratuito':eventPrice(e.ticketTypes.find(t=>t.id===form.ticketTypeId)!)}</dd></dl><p className={s.muted}>{e.details.pricing==='free'?'Confirmaremos tu inscripción si quedan cupos.':'Tu inscripción quedará pendiente. Después podrás realizar el pago de prueba para confirmar tu cupo.'}{e.details.waitlist?' Si no quedan cupos, ingresarás a la lista de espera sin pagar.':''}</p><details className={s.faq}><summary>Condiciones del encuentro</summary><p className={s.prose}>{e.details.conditions||'La inscripción es personal y está sujeta a disponibilidad de cupos.'}</p><p className={s.prose}>{e.details.cancellationPolicy}</p></details><label className={s.check}><input required type="checkbox" checked={form.consent} onChange={ev=>setForm({...form,consent:ev.target.checked})}/>Acepto las condiciones y el uso de mis datos para gestionar esta inscripción y recibir sus comunicaciones.</label></>}
   {error&&<p className={s.error} role="alert">{error}</p>}<div className={s.actions}>{step>0&&<button type="button" className={s.button} onClick={()=>setStep(step-1)}>Anterior</button>}<button className={s.primary} type="submit">{busy?'Registrando…':step<2?'Continuar':e.details.pricing==='free'?'Confirmar inscripción gratuita':'Registrar y continuar al pago de prueba'}</button></div>
  </fieldset></form></section>;
}

export function EventReceipt({slug}:{slug:string}){
 const [receipt,setReceipt]=useState<Receipt|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);setError('');try{
   const hash=new URLSearchParams(window.location.hash.slice(1));
   const saved=hash.get('id')&&hash.get('token')?{id:hash.get('id'),token:hash.get('token')}:JSON.parse(sessionStorage.getItem(`event-receipt:${slug}`)||'null');
   if(!saved)throw new Error('Abre el enlace de tu correo de confirmación o vuelve desde el navegador donde te inscribiste.');
   const r=await post(`/event-registrations/${saved.id}/status`,{token:saved.token});remember(slug,r);setReceipt(r);
  }catch(err){setError(apiErrorMessage(err,err instanceof Error?err.message:'No pudimos consultar la inscripción.'));}finally{setBusy(false);}
 }
 useEffect(()=>{void load();},[slug]); // eslint-disable-line react-hooks/exhaustive-deps
 async function action(kind:'checkout'|'email'){
  if(!receipt)return;setBusy(true);setError('');try{
   const r=await post(`/event-registrations/${receipt.id}/${kind}`,{token:receipt.token});
   if(kind==='checkout'){window.location.assign(r.url);return;}setReceipt(r);
  }catch(err){setError(apiErrorMessage(err,'No se pudo completar la acción. Puedes reintentar.'));}finally{setBusy(false);}
 }
 return <main className={`${s.public} ${s.receiptPage}`}><section className={s.registration}><Link href={`/eventos/${slug}`} className={s.button}>Volver al evento</Link><p className={s.eyebrow}>ARM Global · Tu inscripción</p>{error&&<p role="alert" className={s.error}>{error}</p>}{receipt?<><h1>{labels[receipt.status]||receipt.status}</h1><h2>{receipt.title}</h2><p>{receipt.participantName}</p><p>{eventDate(receipt.startsAt,receipt.timezone)}</p>{receipt.status==='confirmed'&&<div className={s.ticket}><b>Tu entrada</b><p>Presenta este comprobante al equipo del evento.</p><code>{receipt.ticketCode}</code><button className={s.button} onClick={()=>window.print()}>Imprimir / Guardar PDF</button></div>}{receipt.status==='pending_payment'&&<><div className={s.notice}>Modo de prueba · No utilices tarjetas ni cuentas reales.</div><p>{eventPrice({name:'Entrada',price:receipt.amount,currency:receipt.currency})}</p><p>Reserva hasta {eventDate(receipt.expiresAt!,receipt.timezone)}. El regreso desde Mercado Pago no confirma el pago; consulta el estado después.</p><button disabled={busy} className={s.primary} onClick={()=>action('checkout')}>Pagar con Mercado Pago · Prueba</button></>}{receipt.status==='waitlisted'&&<p>Registramos tu interés. Todavía no tienes un cupo confirmado y no debes pagar. El equipo organizador se pondrá en contacto contigo.</p>}{receipt.status==='payment_review'&&<p>El equipo debe revisar tu pago. No vuelvas a pagar; aún no se ha emitido una entrada.</p>}{receipt.status==='expired'&&<p>La reserva venció. Contacta al organizador antes de intentar otro pago.</p>}<p className={s.muted}>{receipt.emailSent?'Enviamos el enlace de seguimiento a tu correo.':'La inscripción está guardada, pero no pudimos confirmar el envío del correo. Conserva este enlace.'}</p><div className={s.actions}><button disabled={busy} className={s.button} onClick={load}>Actualizar estado</button>{!receipt.emailSent&&<button disabled={busy} className={s.button} onClick={()=>action('email')}>Reintentar envío de correo</button>}</div></>:!error&&<p role="status">Consultando inscripción…</p>}</section></main>;
}
