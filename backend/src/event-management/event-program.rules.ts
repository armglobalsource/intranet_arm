import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { hasPermission } from '../common/permissions';
import { SaveEventProgramDto } from './event-program.dto';
export type EventActor = {sub:number;campusId?:number|null;permissions:string[]};
export function eventAccess(user:EventActor) {
 const global=hasPermission(user.permissions,'eventos:manageAll');
 const campus=hasPermission(user.permissions,'eventos:manageCampus');
 const assigned=hasPermission(user.permissions,'eventos:organize');
 if(!global&&!campus&&!assigned)throw new ForbiddenException('No tienes acceso a la administración de eventos');
 return {global,campus,assigned};
}
export function assertEventScope(user:EventActor,row:{campus_id:unknown;organizer_id:unknown}) {
 const a=eventAccess(user);
 if(!a.global&&!(a.campus&&user.campusId!=null&&Number(row.campus_id)===Number(user.campusId))&&!(a.assigned&&Number(row.organizer_id)===Number(user.sub)))throw new ForbiddenException('Este evento no está asignado a tu ámbito');
}
export function validateEventProgram(dto:SaveEventProgramDto) {
 if(!dto.title.trim())throw new BadRequestException('Escribe el nombre del evento');
 if(!dto.details)throw new BadRequestException('Falta la configuración del evento');
 const d=dto.details;
 const instant=(v:string)=>/T.*(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
 if(!instant(dto.startsAt)||!instant(dto.endsAt)||Date.parse(dto.endsAt)<Date.parse(dto.startsAt))throw new BadRequestException('Revisa las fechas de inicio y término, incluida su zona horaria');
 try{new Intl.DateTimeFormat('es',{timeZone:d.timezone}).format();}catch{throw new BadRequestException('Zona horaria inválida');}
 if(d.bannerUrl){try{const u=new URL(d.bannerUrl);if(u.protocol!=='https:'||u.username||u.password)throw new Error();}catch{throw new BadRequestException('El banner debe ser una URL HTTPS sin credenciales');}}
 for(const v of [d.registrationOpensAt,d.registrationClosesAt,d.paymentDueAt])if(v&&!instant(v))throw new BadRequestException('La fecha de inscripción o pago debe incluir zona horaria');
 if(d.registrationOpensAt&&d.registrationClosesAt&&Date.parse(d.registrationOpensAt)>Date.parse(d.registrationClosesAt))throw new BadRequestException('La apertura debe ser anterior al cierre');
 for(const v of [d.registrationOpensAt,d.registrationClosesAt,d.paymentDueAt])if(v&&Date.parse(v)>Date.parse(dto.endsAt))throw new BadRequestException('Inscripciones y pagos deben terminar antes del fin del evento');
 if(dto.registrationStatus==='open'&&dto.status!=='published')throw new BadRequestException('Publica el evento antes de abrir inscripciones');
 if(dto.registrationStatus==='open'&&!dto.campusIds.length)throw new BadRequestException('Selecciona al menos un campus participante');
 if(d.pricing==='paid'&&dto.ticketTypes.some(t=>t.currency!=='CLP'||t.price<0||!Number.isInteger(t.price)))throw new BadRequestException('Mercado Pago Chile requiere entradas en CLP, con valores enteros (0 para una entrada sin costo)');
 for(const t of dto.ticketTypes){
  if(t.salesStart&&t.salesEnd&&Date.parse(t.salesStart)>=Date.parse(t.salesEnd))throw new BadRequestException(`La venta de «${t.name}» debe empezar antes de terminar`);
  if(t.salesStart&&!instant(t.salesStart)||t.salesEnd&&!instant(t.salesEnd))throw new BadRequestException(`Las fechas de venta de «${t.name}» deben incluir zona horaria`);
 }
 const questions=d.questions??[];
 if(new Set(questions.map(q=>q.id)).size!==questions.length)throw new BadRequestException('Hay preguntas repetidas: vuelve a crearlas');
 for(const q of questions){if(!q.label.trim())throw new BadRequestException('Cada pregunta necesita un texto');if(q.type==='select'&&!(q.options??[]).filter(o=>o.trim()).length)throw new BadRequestException(`Agrega opciones a la pregunta «${q.label}»`);}
 if(d.pricing==='free'&&dto.ticketTypes.some(t=>t.price!==0))throw new BadRequestException('Un evento gratuito no puede tener entradas pagadas');
 if(d.pricing==='paid'&&!dto.ticketTypes.some(t=>t.price>0))throw new BadRequestException('Define al menos una entrada con precio');
 if(dto.ticketTypes.some(t=>!t.name.trim()))throw new BadRequestException('Cada entrada necesita un nombre');
 if(new Set(dto.ticketTypes.map(t=>t.name.trim().toLowerCase())).size!==dto.ticketTypes.length)throw new BadRequestException('Los nombres de entradas deben ser distintos');
 if(dto.status==='published'){
  // Nombra solo lo que falta: un mensaje genérico hacía creer que faltaba algo ya completado.
  const missing=[!dto.categoryId&&'la categoría',!d.summary.trim()&&'la invitación breve',!d.description.trim()&&'la descripción',d.modality!=='online'&&!d.location.trim()&&'el lugar',!dto.campusIds.length&&'los campus que pueden inscribirse'].filter(Boolean) as string[];
  if(missing.length)throw new BadRequestException(`Para publicar, completa ${missing.length>1?`${missing.slice(0,-1).join(', ')} y ${missing[missing.length-1]}`:missing[0]}`);
 }
 if(['cancelled','finished'].includes(dto.status)&&dto.registrationStatus!=='closed')throw new BadRequestException('Cierra las inscripciones al finalizar o cancelar');
}
