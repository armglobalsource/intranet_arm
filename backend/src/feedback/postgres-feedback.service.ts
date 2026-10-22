import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { apiRows, insertIdentity, updateIdentity, deleteIdentity } from '../common/database/identity-sql';
import { StorageService } from '../common/storage/storage.service';
import { PostgresNotificationsService } from '../notifications/postgres-notifications.service';
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './dto/feedback.dto';
@Injectable()
export class PostgresFeedbackService {
  constructor(private db:DatabaseService,private storage:StorageService,private notifications:PostgresNotificationsService) {}
  async create(dto:CreateFeedbackDto,userId:number,userName:string,userEmail:string,buffer?:Buffer,mime?:string) {
    let screenshotUrl:string|null=null;
    if(buffer){if(!mime || !['image/png','image/jpeg','image/webp'].includes(mime))throw new BadRequestException('Formato de imagen no permitido');screenshotUrl=await this.storage.uploadPublic(`feedback/${randomUUID()}.${mime.split('/')[1]}`,buffer,mime);}
    const row=await insertIdentity(this.db,'feedback',{userId,userName,userEmail,type:dto.type,message:dto.message,screenshotUrl,status:'open',note:null,createdAt:new Date(),updatedAt:new Date(),resolvedAt:null,resolvedBy:null,resolvedByName:null});
    await Promise.allSettled([
      this.notifications.createForPermission('feedback:manage',{title:`${dto.type==='bug'?'Problema reportado':'Sugerencia recibida'}: ${userName}`,body:dto.message.slice(0,80),link:'/dashboard/soporte',channel:'in_app'}),
      this.notifications.create({userId,title:dto.type==='bug'?'Recibimos tu reporte':'Recibimos tu sugerencia',body:'Puedes seguir su estado y leer la respuesta del equipo de soporte aquí.',link:`/notificaciones?feedback=${row.id}`,channel:'in_app'},userId),
    ]);return row;
  }
  async findAll(){return apiRows(await this.db.query('SELECT * FROM arm_app.feedback ORDER BY "createdAt" DESC,id DESC LIMIT 500'));}
  async findMine(userId:number){return apiRows(await this.db.query('SELECT * FROM arm_app.feedback WHERE "userId"=$1 ORDER BY "createdAt" DESC,id DESC LIMIT 100',[userId]));}
  async findOne(id:number){const row=apiRows(await this.db.query('SELECT * FROM arm_app.feedback WHERE id=$1',[id]))[0];if(!row)throw new NotFoundException('Feedback no encontrado');return row;}
  async updateStatus(id:number,dto:UpdateFeedbackStatusDto,userId:number,userName:string){
    const result=await this.db.transaction(async db=>{
      const current=apiRows(await db.query('SELECT * FROM arm_app.feedback WHERE id=$1 FOR UPDATE',[id]))[0];if(!current)throw new NotFoundException('Feedback no encontrado');
      const row=await updateIdentity(db,'feedback',id,{status:dto.status,note:dto.note??null,updatedAt:new Date(),resolvedAt:dto.status==='resolved'?new Date():null,resolvedBy:dto.status==='resolved'?userId:null,resolvedByName:dto.status==='resolved'?userName:null});
      return {row,changed:current.status!==row.status || current.note!==row.note};
    });
    if(result.changed){const row=result.row,label={open:'abierto',in_progress:'en revisión',resolved:'resuelto'}[dto.status];await this.notifications.create({userId:row.userId,title:row.note?'Nueva respuesta a tu reporte':`Tu reporte está ${label}`,body:row.note??`El estado cambió a ${label}.`,link:`/notificaciones?feedback=${id}`,channel:'in_app'},userId).catch(()=>{});}
    return result.row;
  }
  remove(id:number){return deleteIdentity(this.db,'feedback',id);}
}
