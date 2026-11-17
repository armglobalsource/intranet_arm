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
 private token(){
  const token=this.config.get<string>('MERCADOPAGO_TEST_ACCESS_TOKEN');
  if(this.config.get('EVENT_PAYMENTS_MODE')!=='test'||!token)throw new ServiceUnavailableException('Los pagos de prueba todavía no están configurados.');
  return token;
 }
 async request(path:string,body?:unknown){
  const response=await fetch(`https://api.mercadopago.com${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${this.token()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new ServiceUnavailableException('Mercado Pago no respondió. Puedes volver a intentarlo sin repetir tu inscripción.');
  return response.json();
 }
 /** Check seller identity before ever creating a checkout; a real seller is rejected. */
 async assertTestSeller(){
  const seller=await this.request('/users/me');
  if(seller.site_id!=='MLC'||!Array.isArray(seller.tags)||!seller.tags.includes('test_user'))throw new ServiceUnavailableException('Configura un vendedor de prueba de Mercado Pago Chile.');
  return String(seller.id);
 }
 async checkout(row:any,origin:string){
  await this.assertTestSeller();
  const back=`${origin}/eventos/${encodeURIComponent(row.snapshot.slug)}/inscripcion`;
  const preference=await this.request('/checkout/preferences',{
   external_reference:row.id,
   items:[{id:row.id,title:row.snapshot.title,quantity:1,currency_id:'CLP',unit_price:Number(row.amount)}],
   back_urls:{success:back,pending:back,failure:back},
   notification_url:`${origin}/api/v1/event-payments/webhook`,
   expires:true,expiration_date_to:new Date(row.expires_at).toISOString(),
  });
  const url=new URL(preference.init_point);
  if(url.protocol!=='https:'||!['www.mercadopago.cl','mercadopago.cl'].includes(url.hostname)||url.username||url.password||!preference.id)throw new ServiceUnavailableException('No se pudo preparar el enlace de pago de prueba.');
  return {id:String(preference.id),url:url.href};
 }
 async payment(id:string,requestId:string,signature:string){
  if(!verifyPaymentSignature(this.config.get('MERCADOPAGO_WEBHOOK_SECRET')??'',id,requestId,signature))throw new UnauthorizedException('Firma de notificación inválida');
  const seller=await this.assertTestSeller();
  const payment=await this.request(`/v1/payments/${id}`);
  if(payment.live_mode!==false||String(payment.collector_id)!==seller||String(payment.id)!==id)throw new UnauthorizedException('El pago no pertenece al vendedor de pruebas');
  return payment;
 }
}
