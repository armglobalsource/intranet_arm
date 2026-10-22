import { Injectable,NotFoundException } from '@nestjs/common';
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
  const result=await this.db.query(`SELECT document_id,data FROM ${this.table(table)} WHERE ($1::text IS NULL OR campus=$1) AND ($2::text IS NULL OR record_user=$2) AND ($3::text IS NULL OR record_date >= $3) AND ($4::text IS NULL OR record_date <= $4) AND ($5::boolean IS NULL OR (data->>'activo')::boolean=$5) ORDER BY record_date DESC NULLS LAST,document_id`,[filter.campus??null,filter.userId==null?null:String(filter.userId),filter.start??null,filter.end??null,filter.active??null]);return result.rows.map(r=>this.row(r));
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
 async update(table:Table,id:string,data:any){const row=(await this.db.query(`UPDATE ${this.table(table)} SET data=data||$2::jsonb WHERE document_id=$1 RETURNING document_id,data`,[id,JSON.stringify(data)])).rows[0];if(!row)throw new NotFoundException('Registro no encontrado');return this.row(row);}
 async remove(table:Table,id:string){const result=await this.db.query(`DELETE FROM ${this.table(table)} WHERE document_id=$1`,[id]);if(!result.rowCount)throw new NotFoundException('Registro no encontrado');return {id};}
}
