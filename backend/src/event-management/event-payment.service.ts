import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyPaymentSignature(secret:string,id:string,requestId:string,signature:string) {
 const parts=Object.fromEntries(signature.split(',').map(p=>p.trim().split('=')));
 if(!secret||!/^\d+$/.test(id)||!requestId||!/^\d+$/.test(parts.ts??'')||! /^[a-f0-9]{64}$/i.test(parts.v1??''))return false;
 const expected=createHmac('sha256',secret).update(`id:${id};request-id:${requestId};ts:${parts.ts};`).digest();
 return timingSafeEqual(expected,Buffer.from(parts.v1,'hex'));
}
@Injectable()
export class EventPaymentService {
 constructor(private readonly config:ConfigService){}
 mode(): 'test'|'production'|'disabled' {
  const mode=this.config.get<string>('EVENT_PAYMENTS_MODE');
  return mode==='test'||mode==='production'?mode:'disabled';
 }
 assertConfigured(){
  this.token();
  if(!this.config.get('MERCADOPAGO_WEBHOOK_SECRET'))throw new ServiceUnavailableException('Falta configurar la firma de notificaciones de Mercado Pago.');
 }
 private token(){
  const mode=this.mode();
  const token=this.config.get<string>(mode==='production'?'MERCADOPAGO_ACCESS_TOKEN':'MERCADOPAGO_TEST_ACCESS_TOKEN');
  if(mode==='disabled'||!token)throw new ServiceUnavailableException('Los pagos todavía no están configurados.');
  if(mode==='production'&&(!/^\d+$/.test(this.config.get<string>('MERCADOPAGO_COLLECTOR_ID')??'')||this.config.get('VERCEL_ENV')!=='production'))throw new ServiceUnavailableException('Los pagos reales requieren Production y la cuenta receptora configurada.');
  return token;
 }
 async request(path:string,body?:unknown){
  const response=await fetch(`https://api.mercadopago.com${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${this.token()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new ServiceUnavailableException('Mercado Pago no respondió. Puedes volver a intentarlo sin repetir tu inscripción.');
  return response.json();
 }
 async assertSeller(){
  const seller=await this.request('/users/me');
  const test=Array.isArray(seller.tags)&&seller.tags.includes('test_user');
  if(seller.site_id!=='MLC'||!Array.isArray(seller.tags))throw new ServiceUnavailableException('Configura un vendedor de Mercado Pago Chile.');
  if(this.mode()==='test'&&!test)throw new ServiceUnavailableException('Configura un vendedor de prueba de Mercado Pago Chile.');
  // Mensajes distintos para cada causa: quien configura sabe qué variable corregir (sin exponer IDs ni tokens).
  if(this.mode()==='production'&&test)throw new ServiceUnavailableException('La credencial de producción pertenece a un usuario de prueba de Mercado Pago. Usa el Access Token productivo de la cuenta real que recibe los pagos.');
  if(this.mode()==='production'&&String(seller.id)!==this.config.get<string>('MERCADOPAGO_COLLECTOR_ID'))throw new ServiceUnavailableException('El ID receptor configurado no coincide con la cuenta del Access Token. Usa el User ID de esa cuenta (el número al final del token), no el número de la aplicación.');
  return String(seller.id);
 }
 assertRegistrationMode(row:any){
  if((row.snapshot?.paymentMode??'test')!==this.mode())throw new ServiceUnavailableException('Esta inscripción pertenece a otro entorno de pagos. Contacta al organizador.');
  if(this.mode()==='production'&&row.snapshot?.collectorId!==this.config.get('MERCADOPAGO_COLLECTOR_ID'))throw new ServiceUnavailableException('La cuenta receptora cambió. Contacta al organizador.');
 }
 async checkout(row:any,origin:string){
  this.assertConfigured();
  this.assertRegistrationMode(row);
  await this.assertSeller();
  const back=`${origin}/eventos/${encodeURIComponent(row.snapshot.slug)}/inscripcion`;
  const preference=await this.request('/checkout/preferences',{
   external_reference:row.id,
   items:[{id:row.id,title:row.snapshot.title,quantity:1,currency_id:'CLP',unit_price:Number(row.amount)}],
   back_urls:{success:back,pending:back,failure:back},
   notification_url:`${origin}/api/v1/event-payments/webhook`,
   expires:true,expiration_date_to:new Date(row.expires_at).toISOString(),
  });
  const url=new URL(preference.init_point);
  if(url.protocol!=='https:'||!['www.mercadopago.cl','mercadopago.cl'].includes(url.hostname)||url.username||url.password||!preference.id)throw new ServiceUnavailableException('No se pudo preparar el enlace de pago.');
  return {id:String(preference.id),url:url.href};
 }
 async payment(id:string,requestId:string,signature:string){
  if(!verifyPaymentSignature(this.config.get('MERCADOPAGO_WEBHOOK_SECRET')??'',id,requestId,signature))throw new UnauthorizedException('Firma de notificación inválida');
  const seller=await this.assertSeller();
  const payment=await this.request(`/v1/payments/${id}`);
  if(payment.live_mode!==(this.mode()==='production')||String(payment.collector_id)!==seller||String(payment.id)!==id)throw new UnauthorizedException('El pago no pertenece al vendedor o entorno configurado');
  return payment;
 }
}
