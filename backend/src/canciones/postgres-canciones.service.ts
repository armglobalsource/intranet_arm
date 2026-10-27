import { Injectable,BadRequestException,ConflictException,NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { apiRows } from '../common/database/identity-sql';
import { UpdateCancionDto, UpsertCancionDto } from './dto/cancion.dto';
@Injectable()
export class PostgresCancionesService {
  constructor(private db:DatabaseService) {}
  async search(q?:string) {
    const term=q?.trim().toLowerCase()??'';
    return apiRows(await this.db.query(`SELECT document_id,"cancionId",titulo,tonalidad,"usageCount","updatedAt", (length(coalesce(letra,''))>0) AS "hasLetra" FROM arm_app.canciones WHERE $1='' OR position($1 in lower(titulo))>0 ORDER BY "usageCount" DESC NULLS LAST,document_id LIMIT $2`,[term,term?20:30]));
  }
  async detail(id:string) {
    const result=apiRows(await this.db.query(`SELECT document_id,"cancionId",titulo,tonalidad,letra,"updatedAt", to_char("updatedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS revision FROM arm_app.canciones WHERE document_id=$1`,[id]))[0];
    if(!result) throw new NotFoundException('Canción no encontrada');
    return result;
  }
  async update(id:string, dto:UpdateCancionDto) {
    const result=apiRows(await this.db.query(`UPDATE arm_app.canciones SET tonalidad=$2,letra=$3,"updatedAt"=clock_timestamp() WHERE document_id=$1 AND "updatedAt" IS NOT DISTINCT FROM $4::timestamptz RETURNING document_id,"cancionId",titulo,tonalidad,letra,"updatedAt", to_char("updatedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS revision`,[id,dto.tonalidad.trim(),dto.letra.trim(),dto.expectedUpdatedAt??null]))[0];
    if(!result) {
      const exists=(await this.db.query('SELECT 1 FROM arm_app.canciones WHERE document_id=$1',[id])).rowCount;
      if(!exists) throw new NotFoundException('Canción no encontrada');
      throw new ConflictException('La canción cambió. Cierra y vuelve a abrir para consultar la versión actual.');
    }
    return result;
  }
  async upsert(dto:UpsertCancionDto) {
    const titulo=dto.titulo.trim();if(!titulo) throw new BadRequestException('El título no puede estar vacío');
    const id=randomUUID();
    return apiRows(await this.db.query(`INSERT INTO arm_app.canciones(document_id,"cancionId",titulo,"tituloNorm",tonalidad,"usageCount","createdAt","updatedAt") VALUES($1,$1,$2,$3,$4,1,now(),now()) ON CONFLICT("tituloNorm") DO UPDATE SET "usageCount"=coalesce(arm_app.canciones."usageCount",0)+1,"updatedAt"=now(),tonalidad=CASE WHEN coalesce(arm_app.canciones.tonalidad,'')='' THEN excluded.tonalidad ELSE arm_app.canciones.tonalidad END RETURNING *`,[id,titulo,titulo.toLowerCase(),dto.tonalidad?.trim()??'']))[0];
  }
}
