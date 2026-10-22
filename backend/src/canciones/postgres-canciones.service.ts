import { Injectable,BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { apiRows } from '../common/database/identity-sql';
import { UpsertCancionDto } from './dto/cancion.dto';
@Injectable()
export class PostgresCancionesService {
  constructor(private db:DatabaseService) {}
  async search(q?:string) {
    const term=q?.trim().toLowerCase()??'';
    return apiRows(await this.db.query(`SELECT * FROM arm_app.canciones WHERE $1='' OR position($1 in lower(titulo))>0 ORDER BY "usageCount" DESC NULLS LAST,document_id LIMIT $2`,[term,term?20:30]));
  }
  async upsert(dto:UpsertCancionDto) {
    const titulo=dto.titulo.trim();if(!titulo) throw new BadRequestException('El título no puede estar vacío');
    const id=randomUUID();
    return apiRows(await this.db.query(`INSERT INTO arm_app.canciones(document_id,"cancionId",titulo,"tituloNorm",tonalidad,"usageCount","createdAt","updatedAt") VALUES($1,$1,$2,$3,$4,1,now(),now()) ON CONFLICT("tituloNorm") DO UPDATE SET "usageCount"=coalesce(arm_app.canciones."usageCount",0)+1,"updatedAt"=now(),tonalidad=CASE WHEN coalesce(arm_app.canciones.tonalidad,'')='' THEN excluded.tonalidad ELSE arm_app.canciones.tonalidad END RETURNING *`,[id,titulo,titulo.toLowerCase(),dto.tonalidad?.trim()??'']))[0];
  }
}
