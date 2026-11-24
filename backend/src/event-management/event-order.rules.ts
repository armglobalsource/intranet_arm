import { BadRequestException } from '@nestjs/common';

// Reglas de una compra, sin base de datos: qué entradas están a la venta, cuánto se paga
// con un código de descuento y si las respuestas del asistente son válidas.

export type TicketRow = { id:string; name:string; price:number|string; currency:string; description?:string; capacity?:number|null; sales_start?:string|Date|null; sales_end?:string|Date|null; hidden?:boolean; max_per_order?:number; archived?:boolean };
export type CodeRow = { id:string; code:string; kind:'percent'|'amount'; value:number|string; max_uses?:number|null; starts_at?:string|Date|null; ends_at?:string|Date|null; ticket_type_ids?:string[]|null; active?:boolean };
export type Question = { id:string; label:string; type:'text'|'select'|'yesno'; options?:string[]; required:boolean };
export type Line = { ticketTypeId:string|null; ticketName:string; price:number; discount:number; amount:number };

const at=(v:string|Date|null|undefined)=>v==null?NaN:new Date(v).getTime();

/** «a la venta», «aún no» o «terminó», según la ventana de venta del tipo de entrada. */
export function saleState(t:Pick<TicketRow,'sales_start'|'sales_end'>,now=Date.now()):'on'|'soon'|'over'{
 if(Number.isFinite(at(t.sales_start))&&now<at(t.sales_start))return 'soon';
 if(Number.isFinite(at(t.sales_end))&&now>=at(t.sales_end))return 'over';
 return 'on';
}
/** Un código sirve para una entrada si no limita entradas o la incluye. */
export function codeAppliesTo(code:Pick<CodeRow,'ticket_type_ids'>|null|undefined,ticketTypeId:string|null){
 if(!code)return false;
 const ids=code.ticket_type_ids??[];
 return !ids.length||(!!ticketTypeId&&ids.includes(ticketTypeId));
}
/** Por qué un código no se puede usar ahora (o null si sirve). */
export function codeProblem(code:CodeRow|undefined,uses:number,now=Date.now()){
 if(!code||code.active===false)return 'El código no es válido para este evento.';
 if(Number.isFinite(at(code.starts_at))&&now<at(code.starts_at))return 'Este código todavía no está disponible.';
 if(Number.isFinite(at(code.ends_at))&&now>=at(code.ends_at))return 'Este código ya venció.';
 if(code.max_uses!=null&&uses>=code.max_uses)return 'Este código ya se usó todas las veces permitidas.';
 return null;
}
/** Descuento de una entrada: porcentaje redondeado al peso o monto fijo, nunca mayor que el precio. */
export function lineDiscount(price:number,code:Pick<CodeRow,'kind'|'value'>|null){
 if(!code||price<=0)return 0;
 const value=Number(code.value);
 return Math.min(price,code.kind==='percent'?Math.round(price*value/100):value);
}
/** Precio de la compra: una línea por entrada, con el descuento aplicado a las que el código cubre. */
export function priceOrder(items:{ticket:TicketRow|null}[],code:CodeRow|null,freeName='Entrada gratuita'){
 const lines:Line[]=items.map(({ticket})=>{
  const price=ticket?Number(ticket.price):0;
  const discount=codeAppliesTo(code,ticket?.id??null)?lineDiscount(price,code):0;
  return {ticketTypeId:ticket?.id??null,ticketName:ticket?.name??freeName,price,discount,amount:price-discount};
 });
 const subtotal=lines.reduce((s,l)=>s+l.price,0);const discount=lines.reduce((s,l)=>s+l.discount,0);
 return {lines,subtotal,discount,amount:subtotal-discount};
}
/** «2 × General, 1 × Niños» para correos y Mercado Pago. */
export function ticketSummary(lines:Pick<Line,'ticketName'>[]){
 const counts=new Map<string,number>();
 for(const l of lines)counts.set(l.ticketName,(counts.get(l.ticketName)??0)+1);
 return [...counts].map(([name,n])=>n>1?`${n} × ${name}`:name).join(', ');
}
/** Respuestas limpias según las preguntas del evento; rechaza las obligatorias vacías y opciones inventadas. */
export function cleanAnswers(questions:Question[]|undefined,answers:Record<string,unknown>|undefined,who:string){
 const out:Record<string,string|boolean>={};
 for(const q of questions??[]){
  const raw=answers?.[q.id];
  if(q.type==='yesno'){
   if(raw!==undefined&&raw!==null&&typeof raw!=='boolean')throw new BadRequestException(`Responde «${q.label}» para ${who}`);
   if(q.required&&raw!==true)throw new BadRequestException(`Confirma «${q.label}» para ${who}`);
   if(typeof raw==='boolean')out[q.id]=raw;
   continue;
  }
  const value=typeof raw==='string'?raw.trim():'';
  if(raw!=null&&typeof raw!=='string')throw new BadRequestException(`Responde «${q.label}» para ${who}`);
  if(!value){if(q.required)throw new BadRequestException(`Responde «${q.label}» para ${who}`);continue;}
  if(value.length>500)throw new BadRequestException(`La respuesta a «${q.label}» es demasiado larga`);
  if(q.type==='select'&&!(q.options??[]).includes(value))throw new BadRequestException(`Elige una opción válida en «${q.label}» para ${who}`);
  out[q.id]=value;
 }
 return out;
}
