import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows,insertIdentity,updateIdentity,deleteIdentity } from '../common/database/identity-sql';
import { PostgresArmCatalogosService } from '../arm-catalogos/postgres-arm-catalogos.service';
import { CreateCampusDto,UpdateCampusDto } from './dto/campus.dto';

@Injectable()
export class PostgresCampusService {
  constructor(private db:DatabaseService,private catalogos:PostgresArmCatalogosService) {}
  async findAll() {return apiRows(await this.db.query('SELECT * FROM arm_app.campuses ORDER BY "isActive" DESC NULLS LAST,name,id'));}
  async findActive() {return apiRows(await this.db.query(`SELECT id,name,siglas,address,country,phone,coalesce(schedules,'[]') AS schedules,coalesce("monedaCodes",'[]') AS "monedaCodes" FROM arm_app.campuses WHERE "isActive"=true ORDER BY name,id`));}
  async findOne(id:number) {
    const row=apiRows(await this.db.query('SELECT * FROM arm_app.campuses WHERE id=$1',[id]))[0];
    if(!row) throw new NotFoundException('Campus no encontrado');return row;
  }
  async findByName(name:string) {
    const row=apiRows(await this.db.query('SELECT * FROM arm_app.campuses WHERE lower(btrim(name))=$1',[name.trim().toLowerCase()]))[0];
    if(!row) throw new NotFoundException('Campus no encontrado');return row;
  }
  private fields(dto:UpdateCampusDto) {
    const data:any={updatedAt:new Date()};
    for(const key of ['name','siglas','address','city','country','phone','email','website','description'] as const) if(dto[key]!==undefined) data[key]=dto[key]?.trim()??null;
    for(const key of ['isActive','pastorIds','adminIds','schedules','asistenciaCategoriaKeys','voluntarioCategoriaKeys','monedaCodes'] as const) if(dto[key]!==undefined) data[key]=dto[key];
    if(dto.name!==undefined) data.nameLower=dto.name.trim().toLowerCase();
    return data;
  }
  async create(dto:CreateCampusDto) {
    const keys=async(tipo:'asistencia'|'voluntarios'|'moneda')=>(await this.catalogos.findActive(tipo)).map(e=>e.key);
    return insertIdentity(this.db,'campuses',{...this.fields(dto),pastorIds:dto.pastorIds??[],adminIds:dto.adminIds??[],schedules:dto.schedules??[],asistenciaCategoriaKeys:dto.asistenciaCategoriaKeys??await keys('asistencia'),voluntarioCategoriaKeys:dto.voluntarioCategoriaKeys??await keys('voluntarios'),monedaCodes:dto.monedaCodes??await keys('moneda'),isActive:true,createdAt:new Date()});
  }
  update(id:number,dto:UpdateCampusDto) {return updateIdentity(this.db,'campuses',id,this.fields(dto));}
  remove(id:number) {return deleteIdentity(this.db,'campuses',id);}
}
