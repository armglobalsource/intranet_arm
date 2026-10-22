import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { UpdateTipoCambioDto } from './dto/tipo-cambio.dto';
@Injectable()
export class PostgresTipoCambioService {
 private logger=new Logger(PostgresTipoCambioService.name);
 private refreshing?:Promise<any>;
 constructor(private db:DatabaseService){}
 private code(value:string){const code=value.trim().toUpperCase();if(!/^[A-Z]{3}$/.test(code))throw new BadRequestException('Código de moneda inválido');return code;}
 async getTasasClp(monedas:string[]){
  const codes=monedas.map(m=>this.code(m));
  let api=(await this.db.query('SELECT rates,"fetchedAt" FROM arm_app.tipo_cambio_meta WHERE document_id=\'_api\'')).rows[0];
  if(!api?.fetchedAt || Date.now()-new Date(api.fetchedAt).getTime()>86400000){try{api=await this.refreshFromApi();}catch{this.logger.warn('No se pudo actualizar el tipo de cambio; se conserva la última tasa disponible');}}
  const rows=(await this.db.query('SELECT * FROM arm_app.tipo_cambio')).rows;
  const rates:Record<string,number>={USD:1,...Object.fromEntries(rows.filter(r=>Number(r.unitsPerUSD)>0).map(r=>[r.moneda??r.document_id,Number(r.unitsPerUSD)])),...(api?.rates??{})};
  const apiAt=api?.fetchedAt?new Date(api.fetchedAt).toISOString():null,tasas:Record<string,any>={};
  for(const moneda of codes){if(moneda==='CLP')continue;const manual=rows.find(r=>r.document_id===moneda && r.source==='manual' && Number(r.clpPorUnidad)>0);
   tasas[moneda]=manual?{moneda,clpPorUnidad:Number(manual.clpPorUnidad),fuente:'manual',updatedAt:manual.updatedAt?.toISOString()??null}:{moneda,clpPorUnidad:rates[moneda]>0&&rates.CLP>0?rates.CLP/rates[moneda]:null,fuente:'api',updatedAt:apiAt};
  }return {tasas,actualizadoApi:apiAt};
 }
 async setManual(moneda:string,dto:UpdateTipoCambioDto,user:{sub:string;email:string}){
  const code=this.code(moneda);if(!Number.isFinite(dto.clpPorUnidad)||dto.clpPorUnidad<=0)throw new BadRequestException('Tasa inválida');
  await this.db.query(`INSERT INTO arm_app.tipo_cambio(document_id,moneda,"clpPorUnidad",source,"updatedBy","updatedAt") VALUES ($1,$1,$2,'manual',$3,now()) ON CONFLICT(document_id) DO UPDATE SET "clpPorUnidad"=excluded."clpPorUnidad",source='manual',"updatedBy"=excluded."updatedBy","updatedAt"=now()`,[code,dto.clpPorUnidad,JSON.stringify({uid:user.sub,email:user.email})]);return {moneda:code,clpPorUnidad:dto.clpPorUnidad,fuente:'manual'};
 }
 async clearManual(moneda:string){const code=this.code(moneda);await this.db.query(`UPDATE arm_app.tipo_cambio SET "clpPorUnidad"=NULL,source='api',"updatedAt"=now() WHERE document_id=$1`,[code]);return {moneda:code,fuente:'api'};}
 async refreshFromApi(){
  if(this.refreshing)return this.refreshing;
  this.refreshing=this.fetchAndSave();try{return await this.refreshing;}finally{this.refreshing=undefined;}
 }
 private async fetchAndSave(){
  const res=await fetch('https://open.er-api.com/v6/latest/USD',{signal:AbortSignal.timeout(8000)});
  if(!res.ok)throw new Error('No se pudo consultar el proveedor de tasas');
  const body=await res.json();const rates:Record<string,number>={};
  for(const [k,v] of Object.entries(body?.rates??{}))if(/^[A-Z]{3}$/.test(k)&&typeof v==='number'&&Number.isFinite(v)&&v>0)rates[k]=v;
  if(!rates.CLP)throw new Error('El proveedor no devolvió una tasa CLP válida');
  const fetchedAt=new Date();
  await this.db.query(`INSERT INTO arm_app.tipo_cambio_meta(document_id,rates,"fetchedAt","lastRefreshedAt") VALUES ('_api',$1,$2,$2) ON CONFLICT(document_id) DO UPDATE SET rates=excluded.rates,"fetchedAt"=excluded."fetchedAt","lastRefreshedAt"=excluded."lastRefreshedAt"`,[JSON.stringify(rates),fetchedAt]);return {rates,fetchedAt};
 }
}
