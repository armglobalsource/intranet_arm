import { ConflictException,Injectable,NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from './database.service';
type Table='encuentros'|'siembra'|'kiloamor'|'anuncios'|'events';
const tables=new Set<Table>(['encuentros','siembra','kiloamor','anuncios','events']);
@Injectable()
export class ArmRecordStore {
 constructor(private db:DatabaseService){}
 private table(table:Table){if(!tables.has(table))throw new Error('Unapproved record table');return `arm_app.${table}`;}
 private row(row:any){return {...row.data,id:row.document_id,fichaId:row.document_id};}
 async list(table:Table,filter:{campus?:string;userId?:number|string;start?:string;end?:string;active?:boolean}={}){
  // Listados sin 'source' (metadatos de la importación histórica): pesa casi la mitad y nadie lo usa.
  const result=await this.db.query(`SELECT document_id,data - 'source' AS data FROM ${this.table(table)} WHERE ($1::text IS NULL OR campus=$1) AND ($2::text IS NULL OR record_user=$2) AND ($3::text IS NULL OR record_date >= $3) AND ($4::text IS NULL OR record_date <= $4) AND ($5::boolean IS NULL OR (data->>'activo')::boolean=$5) ORDER BY record_date DESC NULLS LAST,document_id`,[filter.campus??null,filter.userId==null?null:String(filter.userId),filter.start??null,filter.end??null,filter.active??null]);return result.rows.map(r=>this.row(r));
 }
 /** Fecha del último encuentro reportado por campus (sin eventos ni históricos de solo mes). */
 async lastEncounterDates(table:Table,upTo:string){
  const result=await this.db.query(`SELECT campus_id,max(left(record_date,10)) AS last FROM ${this.table(table)} WHERE campus_id IS NOT NULL AND data->>'tipo' IS DISTINCT FROM 'evento' AND data->>'fechaPrecision' IS DISTINCT FROM 'mes' AND left(record_date,10)<=$1 GROUP BY campus_id`,[upTo]);
  return new Map<string,string>(result.rows.map((r:any)=>[String(r.campus_id),r.last]));
 }
 /** Corte histórico fijo; si no hubo importación, conserva el primer registro diario. */
 async encounterControlAnchors(upTo:string){
  const result=await this.db.query(`WITH daily AS (SELECT campus_id,document_id,left(record_date,10) AS day FROM arm_app.encuentros WHERE campus_id IS NOT NULL AND data->>'tipo' IS DISTINCT FROM 'evento' AND data->>'fechaPrecision' IS DISTINCT FROM 'mes' AND left(record_date,10)<=$1), baseline AS (SELECT coalesce(max(day) FILTER (WHERE document_id LIKE 'asana:%'),min(day),$1) AS day FROM daily) SELECT campus_id::text AS key,coalesce(max(day) FILTER (WHERE document_id LIKE 'asana:%'),least(min(day),(SELECT day FROM baseline))) AS anchor FROM daily GROUP BY campus_id UNION ALL SELECT '__baseline',day FROM baseline`,[upTo]);
  return new Map<string,string>(result.rows.map((r:any)=>[String(r.key),r.anchor]));
 }
 /** Solo datos operativos y campus autorizados; evita cargar cifras, contactos e histórico completo. */
 async encounterControlRows(campusIds:number[],from:string,to:string,starts:Record<string,string>={}){
  const result=await this.db.query(`SELECT document_id,jsonb_build_object('campusId',campus_id,'campus',campus,'fecha',left(record_date,10),'encuentro',data->>'encuentro','fechaPrecision',data->>'fechaPrecision','tipo',data->>'tipo','estado',data->>'estado','registradoPor',jsonb_build_object('uid',data#>>'{registradoPor,uid}')) AS data FROM arm_app.encuentros WHERE campus_id=ANY($1::bigint[]) AND record_date>=$2 AND record_date>=coalesce($4::jsonb->>campus_id::text,$2) AND record_date<=$3 ORDER BY record_date,document_id`,[campusIds,from,`${to}T23:59:59.999Z`,JSON.stringify(starts)]);
  return result.rows.map(r=>this.row(r));
 }
 async find(table:Table,id:string){const row=(await this.db.query(`SELECT document_id,data FROM ${this.table(table)} WHERE document_id=$1`,[id])).rows[0];if(!row)throw new NotFoundException('Registro no encontrado');return this.row(row);}
 async create(table:Table,data:any){
  const id=randomUUID(),name=this.table(table),key=data.idempotencyKey??null,user=data.registradoPor?.uid;
  return this.db.transaction(async db=>{
   // Scope retry keys to their owner. A key cannot reveal another user's record.
   if(key && user!=null){await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${table}:${user}:${key}`]);const prior=(await db.query(`SELECT document_id,data FROM ${name} WHERE record_user=$1 AND idempotency_key=$2`,[String(user),key])).rows[0];if(prior)return this.row(prior);}
   return this.row((await db.query(`INSERT INTO ${name}(document_id,data) VALUES ($1,$2) RETURNING document_id,data`,[id,JSON.stringify(data)])).rows[0]);
  });
 }
 async update(table:Table,id:string,data:any,version?:{fechaEdicion?:string;fechaRevision?:string}){
  const guard=version?' AND (data->>\'fechaEdicion\') IS NOT DISTINCT FROM $3::text AND (data->>\'fechaRevision\') IS NOT DISTINCT FROM $4::text':'';
  const args:any[]=[id,JSON.stringify(data)];if(version)args.push(version.fechaEdicion??null,version.fechaRevision??null);
  const row=(await this.db.query(`UPDATE ${this.table(table)} SET data=data||$2::jsonb WHERE document_id=$1${guard} RETURNING document_id,data`,args)).rows[0];
  if(!row){if(version)throw new ConflictException('El reporte cambió durante la operación. Recarga antes de continuar');throw new NotFoundException('Registro no encontrado');}return this.row(row);
 }
 async remove(table:Table,id:string,version?:{fechaEdicion?:string;fechaRevision?:string}){
  const guard=version?' AND (data->>\'fechaEdicion\') IS NOT DISTINCT FROM $2::text AND (data->>\'fechaRevision\') IS NOT DISTINCT FROM $3::text':'';
  const args:any[]=[id];if(version)args.push(version.fechaEdicion??null,version.fechaRevision??null);
  const result=await this.db.query(`DELETE FROM ${this.table(table)} WHERE document_id=$1${guard}`,args);
  if(!result.rowCount){if(version)throw new ConflictException('El reporte cambió durante la operación. Recarga antes de continuar');throw new NotFoundException('Registro no encontrado');}return {id};
 }
}
