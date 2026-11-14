'use client';
/* eslint-disable @next/next/no-img-element */
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { CSSProperties } from 'react';
import { PublicEvent,eventDate,eventPrice } from './event-types';
import s from './events.module.css';
export function EventLanding({event:e,preview=false}:{event:PublicEvent;preview?:boolean}){
 const d=e.details;
 const status=e.status==='cancelled'?'Evento cancelado':e.status==='finished'?'Evento finalizado':e.registrationStatus==='closed'?'Inscripciones cerradas':'Inscripciones próximamente';
 return <div className={s.public} style={{'--event-color':d.color} as CSSProperties}>
  <header className={s.hero}>
   {d.bannerUrl&&<img className={s.heroImage} src={d.bannerUrl} alt="" referrerPolicy="no-referrer"/>}
   <nav className={s.publicNav} aria-label="Identidad del evento"><img src="/logo_ficha.png" alt="ARM Global"/><span>Encuentros que nos unen</span></nav>
   <div className={s.heroContent}><div className={s.eyebrow}>{e.categoryName||'ARM Global · Eventos'}</div><h1>{e.title||'El próximo encuentro comienza aquí'}</h1><p>{d.summary||'La información de tu evento aparecerá aquí.'}</p>
    <div className={s.heroFacts}><div className={s.heroFact}><CalendarDays size={23}/><div><b>Fecha y horario</b>{e.startsAt?eventDate(e.startsAt,d.timezone):'Por definir'}<br/>{d.timezone}</div></div><div className={s.heroFact}><MapPin size={23}/><div><b>Lugar</b>{d.modality==='online'?'Evento online':d.location||'Por definir'}</div></div><div className={s.heroFact}><Users size={23}/><div><b>Organiza</b>{e.campusName||'Campus organizador'}</div></div></div>
   </div>
  </header>
  <main className={s.publicMain}><div><section className={s.publicSection}><h2>Un tiempo para encontrarnos</h2><p className={s.prose}>{d.description||'Agrega una descripción para presentar esta experiencia.'}</p></section>
   <section className={s.publicSection}><h2>Todo lo que necesitas saber</h2><p className={s.prose}>{d.address}{d.address?'\n':''}{e.endsAt?`Finaliza: ${eventDate(e.endsAt,d.timezone)}\n`:''}{e.campuses.length?`Campus participantes: ${e.campuses.join(', ')}\n`:''}{d.minimumAge!=null?`Edad mínima: ${d.minimumAge} años`:''}</p></section>
   {d.faqs.length>0&&<section className={s.publicSection}><h2>Preguntas frecuentes</h2>{d.faqs.map((f,i)=><details key={i} className={s.faq}><summary>{f.question}</summary><p className={s.prose}>{f.answer}</p></details>)}</section>}
   {d.conditions&&<section className={s.publicSection}><h2>Condiciones del encuentro</h2><p className={s.prose}>{d.conditions}</p></section>}
   {d.cancellationPolicy&&<section className={s.publicSection}><h2>Política de cancelación</h2><p className={s.prose}>{d.cancellationPolicy}</p></section>}
  </div><aside className={s.booking}><div className={s.eyebrow}>Tu próxima experiencia</div><h2>Participa en este encuentro</h2>{d.pricing==='free'?<strong>Entrada gratuita</strong>:e.ticketTypes.map((t,i)=><div key={i} className={s.publicTickets}><span>{t.name}</span><b>{eventPrice(t)}</b></div>)}
   {e.capacity&&<p>Capacidad total: {e.capacity} personas</p>}<div className={s.bookingStatus}>{status}</div><p>{e.status==='cancelled'?'Este encuentro ha sido cancelado.':e.status==='finished'?'Gracias por ser parte de nuestros encuentros.':'La inscripción aún no está habilitada. Aquí encontrarás el acceso cuando esté disponible.'}</p>{preview&&<p>Vista previa · No realiza inscripciones ni pagos.</p>}
  </aside></main><footer className={s.footer}>ARM Global · Un mismo propósito, muchos encuentros.</footer>
 </div>;
}

