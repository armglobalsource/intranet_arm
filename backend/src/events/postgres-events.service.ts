import { BadRequestException,Injectable } from '@nestjs/common';
import { ArmRecordStore } from '../common/database/arm-record-store';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
@Injectable()
export class PostgresEventsService {
 constructor(private store:ArmRecordStore){}
 async findAll(year?:string){if(year&&!/^\d{4}$/.test(year))throw new BadRequestException('Año inválido');return (await this.store.list('events',year?{start:`${year}-01-01`,end:`${year}-12-31`}:{})).sort((a,b)=>String(a.date).localeCompare(String(b.date)));}
 findOne(id:string){return this.store.find('events',id);}
 private fields(dto:Partial<CreateEventDto>){return Object.fromEntries(['title','description','date','endDate','time','category','customLabel','location'].filter(k=>(dto as any)[k]!==undefined).map(k=>[k,(dto as any)[k]]));}
 create(dto:CreateEventDto,userId:number){return this.store.create('events',{...this.fields(dto),createdBy:userId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}
 update(id:string,dto:UpdateEventDto){return this.store.update('events',id,{...this.fields(dto),updatedAt:new Date().toISOString()});}
 remove(id:string){return this.store.remove('events',id);}
}
