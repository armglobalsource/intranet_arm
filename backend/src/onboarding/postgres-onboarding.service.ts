import { Injectable,NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows,insertIdentity,updateIdentity,deleteIdentity } from '../common/database/identity-sql';
import { CreateOnboardingDto,UpdateOnboardingDto } from './dto/onboarding.dto';

@Injectable()
export class PostgresOnboardingService {
  constructor(private db:DatabaseService) {}
  async findAll(roleName?:string,isAdmin=false) {return apiRows(await this.db.query(`SELECT * FROM arm_app.onboarding WHERE "isActive" IS DISTINCT FROM false AND ($2::boolean OR coalesce("roleNames",'[]') ? $1) ORDER BY "teamName",id`,[roleName??'',isAdmin]));}
  async findAllAdmin() {return apiRows(await this.db.query('SELECT * FROM arm_app.onboarding ORDER BY "teamName",id'));}
  async findBySlug(slug:string) {
    const row=apiRows(await this.db.query('SELECT * FROM arm_app.onboarding WHERE slug=$1',[slug]))[0];
    if(!row) throw new NotFoundException('Onboarding no encontrado');return row;
  }
  create(dto:CreateOnboardingDto) {return insertIdentity(this.db,'onboarding',{...this.fields(dto),roleNames:dto.roleNames??[],steps:dto.steps??[],isActive:dto.isActive??true,createdAt:new Date(),updatedAt:new Date()});}
  private fields(dto:UpdateOnboardingDto) {
    const data:any={updatedAt:new Date()};
    for(const key of ['teamName','slug','welcomeTitle','welcomeText','videoUrl','emoji','color','roleNames','steps','isActive'] as const) if(dto[key]!==undefined) data[key]=dto[key];
    return data;
  }
  update(id:number,dto:UpdateOnboardingDto) {return updateIdentity(this.db,'onboarding',id,this.fields(dto));}
  remove(id:number) {return deleteIdentity(this.db,'onboarding',id);}
}
