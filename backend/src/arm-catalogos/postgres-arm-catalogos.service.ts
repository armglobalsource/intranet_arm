import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows,insertIdentity,updateIdentity,deleteIdentity } from '../common/database/identity-sql';
import { ArmCatalogoTipo,CreateArmCatalogoDto,UpdateArmCatalogoDto } from './dto/arm-catalogo.dto';

@Injectable()
export class PostgresArmCatalogosService {
  constructor(private db:DatabaseService) {}
  async findAll(tipo:ArmCatalogoTipo) {return apiRows(await this.db.query('SELECT * FROM arm_app.arm_catalogos WHERE tipo=$1 ORDER BY "sortOrder",label,id',[tipo]));}
  async findActive(tipo:ArmCatalogoTipo):Promise<{key:string;label:string}[]> {return (await this.db.query<{key:string;label:string}>('SELECT key,label FROM arm_app.arm_catalogos WHERE tipo=$1 AND "isActive"=true ORDER BY "sortOrder",label,id',[tipo])).rows;}
  async findOne(id:number) {
    const row=apiRows(await this.db.query('SELECT * FROM arm_app.arm_catalogos WHERE id=$1',[id]))[0];
    if(!row) throw new NotFoundException('Catálogo no encontrado');
    return row;
  }
  create(dto:CreateArmCatalogoDto) {return insertIdentity(this.db,'arm_catalogos',{tipo:dto.tipo,key:dto.key.trim(),keyLower:dto.key.trim().toLowerCase(),label:dto.label.trim(),sortOrder:dto.sortOrder??0,isActive:true,createdAt:new Date(),updatedAt:new Date()});}
  update(id:number,dto:UpdateArmCatalogoDto) {return updateIdentity(this.db,'arm_catalogos',id,{label:dto.label?.trim(),sortOrder:dto.sortOrder,isActive:dto.isActive,updatedAt:new Date()});}
  remove(id:number) {return deleteIdentity(this.db,'arm_catalogos',id);}
}
