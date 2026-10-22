import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { apiRows } from '../common/database/identity-sql';
import { CreatePaletaDto } from './dto/paleta.dto';
@Injectable()
export class PostgresPaletasService {
  constructor(private db:DatabaseService) {}
  async findAll() {return apiRows(await this.db.query('SELECT * FROM arm_app.paletas WHERE active IS DISTINCT FROM false ORDER BY "order",id'));}
  async create(dto:CreatePaletaDto) {
    return this.db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(721936403)');
      const id=randomUUID();
      return apiRows(await client.query(`INSERT INTO arm_app.paletas(id,document_id,name,colors,"order",active,"createdAt") SELECT $1,$1,$2,$3::jsonb,coalesce(max("order"),-1)+1,true,now() FROM arm_app.paletas RETURNING *`,[id,dto.name,JSON.stringify(dto.colors)]))[0];
    });
  }
}
