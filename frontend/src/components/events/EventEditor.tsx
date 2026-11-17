'use client';
import { useEffect,useState,useId,Children,cloneElement,isValidElement,ReactElement,ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery,useMutation,useQueryClient } from '@tanstack/react-query';
import { ArrowLeft,Eye,Save,Plus,Trash2 } from 'lucide-react';
import Link from 'next/link';
import { api,apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';
import { EventShell,useEventAccess,useEventOptions } from './EventWorkspace';
import { EventProgram,EventDetails,EventOptions,newEvent,eventStatuses,PublicEvent } from './event-types';
import { EventLanding } from './EventLanding';
import { EventParticipants } from './EventParticipants';
import s from './events.module.css';
const tabs=['Información','Identidad visual','Participación','Publicación'];
function Field({title,children,wide=false,hint}:{title:string;children:ReactNode;wide?:boolean;hint?:string}){const id=useId();return <div className={`${s.field} ${wide?s.wide:''}`}><label htmlFor={id}>{title}</label>{Children.map(children,child=>isValidElement(child)&&['input','select','textarea'].includes(String(child.type))?cloneElement(child as ReactElement<any>,{id,'aria-describedby':hint?`${id}-hint`:undefined}):child)}{hint&&<small id={`${id}-hint`}>{hint}</small>}</div>;}
function localDate(value:string|null){if(!value)return '';const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function isoDate(value:string){return value?new Date(value).toISOString():'';}
export function EventEditor({id}:{id?:string}){
 const access=useEventAccess();const options=useEventOptions();const user=useAuthStore(x=>x.user);const [draft,setDraft]=useState<EventProgram|null>(null);
 const query=useQuery({queryKey:['event-program',id],enabled:!!id&&access.allowed,queryFn:()=>api.get<EventProgram>(`/event-management/${id}`).then(r=>r.data)});
 useEffect(()=>{if(!draft){if(id&&query.data)setDraft(query.data);else if(!id&&user)setDraft(newEvent(user.id,user.campusId??0));}},[id,query.data,user,draft]);
 return <EventShell title={id?'Diseña tu encuentro':'Crea un nuevo evento'} description="Configura cada detalle y revisa cómo lo verán los participantes." action={<Link className={s.button} href="/dashboard/eventos/gestion"><ArrowLeft size={16}/>Volver</Link>}>
  {(options.isError||query.isError)&&<div className={s.error} role="alert">{apiErrorMessage(options.error??query.error,'No se pudo cargar el evento o su configuración.')} <button className={s.button} onClick={()=>{options.refetch();if(id)query.refetch();}}>Reintentar</button></div>}
  {(!draft||!options.data)&&!options.isError&&!query.isError&&<p role="status">Preparando el editor…</p>}
  {draft&&options.data&&<EditorForm initial={draft} options={options.data} onReload={async()=>{if(id){const r=await query.refetch();if(r.data)setDraft(r.data);}}} key={`${id??'new'}-${draft.version}`}/>}
 </EventShell>;
}
function EditorForm({initial,options,onReload}:{initial:EventProgram;options:EventOptions;onReload:()=>void}){
 const router=useRouter();const qc=useQueryClient();const [event,setEvent]=useState(initial);const [tab,setTab]=useState(0);const [preview,setPreview]=useState(false);const [dirty,setDirty]=useState(false);const [error,setError]=useState('');const [saved,setSaved]=useState(false);
 const access=useEventAccess();const user=useAuthStore(x=>x.user);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 function change<K extends keyof EventProgram>(key:K,value:EventProgram[K]){setEvent(e=>({...e,[key]:value}));setDirty(true);setSaved(false);}
 function detail<K extends keyof EventDetails>(key:K,value:EventDetails[K]){setEvent(e=>({...e,details:{...e.details,[key]:value}}));setDirty(true);setSaved(false);}
 const save=useMutation({mutationFn:async()=>{
  if(!event.title.trim()||!event.slug||!event.campusId||!event.organizerId||!event.startsAt||!event.endsAt)throw new Error('Completa nombre, enlace, campus, responsable y fechas en Información.');
  if(new Date(event.endsAt)<new Date(event.startsAt))throw new Error('La fecha de término debe ser posterior al inicio.');
  const {id,audit,...body}=event;
  return (await (id?api.patch(`/event-management/${id}`,body):api.post('/event-management',body))).data as {id:string;version:number};
 },onSuccess:r=>{setEvent(e=>({...e,id:r.id,version:r.version}));setDirty(false);setSaved(true);setError('');qc.invalidateQueries({queryKey:['event-programs']});qc.invalidateQueries({queryKey:['event-program',r.id]});if(!initial.id)router.replace(`/dashboard/eventos/${r.id}`);},onError:e=>setError(apiErrorMessage(e,e instanceof Error?e.message:'No se pudo guardar el evento'))});
 const editableOwner=options.access.global||(options.access.campus&&Number(event.campusId)===Number(user?.campusId));
 const previewData:PublicEvent={...event,campusName:options.campuses.find(c=>c.id===event.campusId)?.name??'',categoryName:options.categories.find(c=>c.id===event.categoryId)?.name??'',campuses:options.campuses.filter(c=>event.campusIds.includes(c.id)).map(c=>c.name),registrationEnabled:false};
 const input=(key:'title'|'slug',max:number)=> <input maxLength={max} value={event[key]} onChange={e=>change(key,e.target.value)} required/>;
 const dateField=(title:string,key:'registrationOpensAt'|'registrationClosesAt'|'paymentDueAt')=><Field title={title}><input type="datetime-local" value={localDate(event.details[key])} onChange={e=>detail(key,isoDate(e.target.value)||null)}/></Field>;
 return <>
  {error&&<div className={s.error} role="alert">{error}{(save.error as any)?.response?.status===409&&<button className={s.button} onClick={()=>{if(confirm('¿Descartar tus cambios locales y cargar la versión guardada?'))onReload();}}>Recargar versión guardada</button>}</div>}
  {saved&&<div className={s.success} role="status">Cambios guardados. {event.status==='published'?'La portada está publicada.':'El evento sigue en el estado seleccionado.'}</div>}
  <div className={s.toolbar}><button className={s.button} onClick={()=>setPreview(!preview)}><Eye size={16}/>{preview?'Volver al editor':'Vista previa de la portada'}</button>{event.id&&event.status!=='draft'&&<Link href={`/eventos/${event.slug}`} className={s.button} target="_blank">Abrir página pública</Link>}</div>
  {preview?<div className={s.previewFrame}><EventLanding event={previewData} preview/></div>:<div className={s.editorLayout}>
   <div className={s.steps} role="tablist" aria-label="Configuración del evento">{tabs.map((t,i)=><button type="button" key={t} role="tab" id={`event-tab-${i}`} aria-selected={tab===i} aria-controls="event-panel" onClick={()=>setTab(i)}><small>0{i+1}</small>{t}</button>)}</div>
   <section className={s.panel} role="tabpanel" id="event-panel" aria-labelledby={`event-tab-${tab}`}>
    {tab===0&&<><h2>Información del evento</h2><p className={s.muted}>Los datos esenciales para que todos sepan cuándo y dónde encontrarse.</p><div className={s.formGrid}>
     <Field title="Nombre del evento *" wide>{input('title',160)}</Field><Field title="Enlace público *" hint="Solo minúsculas, números y guiones. Ej.: retiro-de-hombres" wide>{input('slug',120)}<small>/eventos/{event.slug||'nombre-del-evento'}</small></Field>
     <Field title="Categoría"><select value={event.categoryId??''} onChange={e=>change('categoryId',e.target.value||null)}><option value="">Seleccionar categoría</option>{options.categories.filter(c=>c.active||c.id===event.categoryId).map(c=><option key={c.id} value={c.id}>{c.name}{!c.active?' (inactiva)':''}</option>)}</select>{!options.categories.length&&<small>Agrega categorías desde Configuración o solicítalas al administrador.</small>}</Field>
     <Field title="Modalidad"><select value={event.details.modality} onChange={e=>detail('modality',e.target.value as EventDetails['modality'])}><option value="onsite">Presencial</option><option value="online">Online</option><option value="hybrid">Presencial y online</option></select></Field>
     <Field title="Campus organizador *"><select disabled={!options.access.global&&!!initial.id} value={event.campusId||''} onChange={e=>change('campusId',Number(e.target.value))}><option value="">Seleccionar campus</option>{options.campuses.filter(c=>options.access.global||c.id===user?.campusId||c.id===initial.campusId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
     <Field title="Organizador responsable *"><select disabled={!editableOwner} value={event.organizerId||''} onChange={e=>change('organizerId',Number(e.target.value))}><option value="">Seleccionar responsable</option>{options.organizers.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
     <Field title="Inicio *"><input type="datetime-local" value={localDate(event.startsAt)} onChange={e=>change('startsAt',isoDate(e.target.value))}/></Field><Field title="Término *"><input type="datetime-local" value={localDate(event.endsAt)} onChange={e=>change('endsAt',isoDate(e.target.value))}/></Field>
     <div className={`${s.notice} ${s.wide}`}>Ingresa las horas en la zona de tu dispositivo: {Intl.DateTimeFormat().resolvedOptions().timeZone}. La portada las mostrará en la zona del evento.</div>
     <Field title="Zona horaria del evento" hint="Formato IANA, por ejemplo America/Santiago"><input value={event.details.timezone} onChange={e=>detail('timezone',e.target.value)} maxLength={80}/></Field>
     <Field title="Lugar"><input value={event.details.location} onChange={e=>detail('location',e.target.value)} maxLength={200}/></Field><Field title="Dirección" wide><input value={event.details.address} onChange={e=>detail('address',e.target.value)} maxLength={400}/></Field>
     <div className={s.wide}><h3 className="text-sm font-semibold">Campus participantes</h3><p className={s.muted}>Esta selección informa a los participantes; no otorga permisos administrativos.</p><div className={s.checks}>{options.campuses.map(c=><label key={c.id} className={s.check}><input type="checkbox" checked={event.campusIds.includes(c.id)} onChange={e=>change('campusIds',e.target.checked?[...event.campusIds,c.id]:event.campusIds.filter(id=>id!==c.id))}/>{c.name}</label>)}</div></div>
    </div></>}
    {tab===1&&<><h2>Una identidad para cada encuentro</h2><p className={s.muted}>Banner, color y contenido propio, conservando la identidad ARM Global.</p><div className={s.formGrid}>
     <Field title="Resumen" wide hint="Una invitación breve, visible en la portada."><textarea maxLength={240} value={event.details.summary} onChange={e=>detail('summary',e.target.value)}/></Field>
     <Field title="Descripción completa" wide><textarea style={{minHeight:180}} maxLength={15000} value={event.details.description} onChange={e=>detail('description',e.target.value)}/></Field>
     <Field title="URL del banner" wide hint="Imagen pública HTTPS. Vacío: portada con color neutro, sin fotografía."><input type="url" maxLength={2000} placeholder="https://…" value={event.details.bannerUrl} onChange={e=>detail('bannerUrl',e.target.value)}/></Field>
     <Field title="Color de la portada"><input type="color" aria-label="Color de la portada" value={event.details.color} onChange={e=>detail('color',e.target.value)} style={{width:80,height:44}}/></Field>
     <div className={s.wide}><h3 className="font-semibold">Preguntas frecuentes</h3>{event.details.faqs.map((f,i)=><div className={s.entry} key={i}><div className={s.formGrid}><Field title={`Pregunta ${i+1}`} wide><input maxLength={200} value={f.question} onChange={e=>detail('faqs',event.details.faqs.map((x,j)=>j===i?{...x,question:e.target.value}:x))}/></Field><Field title="Respuesta" wide><textarea maxLength={2000} value={f.answer} onChange={e=>detail('faqs',event.details.faqs.map((x,j)=>j===i?{...x,answer:e.target.value}:x))}/></Field></div><button className={s.button} onClick={()=>detail('faqs',event.details.faqs.filter((_,j)=>j!==i))}>Quitar pregunta</button></div>)}<button className={s.button} disabled={event.details.faqs.length>=20} onClick={()=>detail('faqs',[...event.details.faqs,{question:'',answer:''}])}><Plus size={16}/>Agregar pregunta</button></div>
    </div></>}
    {tab===2&&<><h2>Prepara la participación</h2><p className={s.muted}>Define fechas de inscripción, cupos y acceso gratuito o pagado.</p><div className={s.formGrid}>
     <Field title="Capacidad total" hint="Vacío: sin límite configurado."><input type="number" min={1} max={1000000} value={event.capacity??''} onChange={e=>change('capacity',e.target.value?Number(e.target.value):null)}/></Field>
     <Field title="Edad mínima (opcional)"><input type="number" min={0} max={120} value={event.details.minimumAge??''} onChange={e=>detail('minimumAge',e.target.value?Number(e.target.value):null)}/></Field>
     {dateField('Abrir inscripciones desde','registrationOpensAt')}{dateField('Cerrar inscripciones el','registrationClosesAt')}
     <label className={`${s.check} ${s.wide}`}><input type="checkbox" checked={event.details.waitlist} onChange={e=>detail('waitlist',e.target.checked)}/>Permitir lista de espera cuando se agoten los cupos</label>
     <Field title="Tipo de acceso"><select value={event.details.pricing} onChange={e=>{detail('pricing',e.target.value as 'free'|'paid');if(e.target.value==='free')change('ticketTypes',event.ticketTypes.map(t=>({...t,price:0})));}}><option value="free">Gratuito</option><option value="paid">Pagado</option></select></Field>
     {event.details.pricing==='paid'&&dateField('Fecha límite de pago','paymentDueAt')}
     {event.details.pricing==='paid'?<div className={s.wide}><div className={s.notice}>Mercado Pago Chile · Pruebas. Usa cuentas y tarjetas de prueba. La reserva dura hasta 24 horas. La entrada se confirma cuando se verifica el pago.</div><h3 className="font-semibold">Tipos de entrada</h3>{event.ticketTypes.map((t,i)=><div key={i} className={s.entry}><div className={s.entryGrid}><Field title="Nombre"><input value={t.name} maxLength={80} onChange={e=>change('ticketTypes',event.ticketTypes.map((x,j)=>i===j?{...x,name:e.target.value}:x))}/></Field><Field title="Valor"><input type="number" min={0} step="0.01" max={999999999} disabled={event.details.pricing==='free'} value={t.price} onChange={e=>change('ticketTypes',event.ticketTypes.map((x,j)=>i===j?{...x,price:Number(e.target.value)}:x))}/></Field><Field title="Moneda ISO"><input value={t.currency} maxLength={3} placeholder="CLP" onChange={e=>change('ticketTypes',event.ticketTypes.map((x,j)=>i===j?{...x,currency:e.target.value.toUpperCase()}:x))}/></Field><button className={s.button} aria-label={`Quitar entrada ${t.name||i+1}`} onClick={()=>change('ticketTypes',event.ticketTypes.filter((_,j)=>j!==i))}><Trash2 size={16}/></button></div></div>)}<button className={s.button} disabled={event.ticketTypes.length>=20} onClick={()=>change('ticketTypes',[...event.ticketTypes,{name:'Entrada general',price:0,currency:'CLP'}])}><Plus size={16}/>Agregar tipo de entrada</button></div>:<div className={`${s.notice} ${s.wide}`}>Acceso gratuito: confirma el cupo sin pedir datos de pago. Si se agota, se utiliza la lista de espera cuando esté habilitada.</div>}
     <Field title="Condiciones y requisitos" wide><textarea maxLength={5000} value={event.details.conditions} onChange={e=>detail('conditions',e.target.value)}/></Field><Field title="Política de cancelación" wide><textarea maxLength={5000} value={event.details.cancellationPolicy} onChange={e=>detail('cancellationPolicy',e.target.value)}/></Field>
    </div></>}
    {tab===3&&<><h2>Revisa antes de compartir</h2><p className={s.muted}>Publica la portada y elige cuándo abrir inscripciones. Los pagos utilizan exclusivamente cuentas de prueba.</p><div className={s.formGrid}>
     <Field title="Estado del evento"><select value={event.status} onChange={e=>{change('status',e.target.value as EventProgram['status']);if(['finished','cancelled'].includes(e.target.value))change('registrationStatus','closed');}}>{Object.entries(eventStatuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></Field>
     <Field title="Estado de inscripciones"><select value={event.registrationStatus} onChange={e=>change('registrationStatus',e.target.value as EventProgram['registrationStatus'])}><option value="pending">Próximamente</option><option value="open">Abiertas (según las fechas configuradas)</option><option value="closed">Cerradas</option></select></Field>
     <div className={`${s.notice} ${s.wide}`}>Para publicar: completa categoría, resumen, descripción y lugar (si es presencial). Revisa fechas, responsable y la vista previa. No se enviarán correos al guardar.</div>
     <div className={s.wide}><h3 className="font-semibold mb-3">Últimos cambios guardados</h3>{initial.audit?.length?initial.audit.map((a,i)=><div key={i} className={s.audit}>{a.actor} · {a.action}<br/>Versión {a.version} · {new Date(a.createdAt).toLocaleString('es-CL')}</div>):<p className={s.muted}>El historial comienza al guardar este evento.</p>}</div>
    </div></>}
   </section>
  </div>}
  {event.id&&!preview&&<EventParticipants id={event.id}/>}
  <div className={s.savebar}><p>{dirty?'Tienes cambios sin guardar':`Versión ${event.version} · ${eventStatuses[event.status]}`}</p><button className={s.button} onClick={()=>setPreview(!preview)}><Eye size={16}/>{preview?'Editar':'Vista previa'}</button><button className={s.primary} disabled={save.isPending||(!initial.id&&!access.create)} onClick={()=>{setError('');save.mutate();}}><Save size={16}/>{save.isPending?'Guardando…':event.status==='published'?'Guardar y publicar':'Guardar evento'}</button></div>
 </>;
}
