import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows, insertIdentity, updateIdentity } from '../common/database/identity-sql';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { hasPermission } from '../common/permissions';

@Injectable()
export class PostgresNotificationsService {
  constructor(private db: DatabaseService) {}
  async findAll(userId: number) {
    return apiRows(await this.db.query('SELECT * FROM arm_app.notifications WHERE "userId"=$1 ORDER BY "createdAt" DESC,id DESC LIMIT 100',[userId]));
  }
  async findOne(id: number) {
    const row=apiRows(await this.db.query('SELECT * FROM arm_app.notifications WHERE id=$1',[id]))[0];
    if (!row) throw new NotFoundException('Notificación no encontrada');
    return row;
  }
  async findOneForUser(id: number,userId: number) {
    const row=await this.findOne(id);
    if(row.userId!==userId) throw new ForbiddenException('No puedes acceder a esta notificación');
    return row;
  }
  create(dto: CreateNotificationDto,_actor: number) {
    return insertIdentity(this.db,'notifications',{userId:dto.userId,title:dto.title,body:dto.body??null,link:dto.link??null,channel:dto.channel??'in_app',read:false,createdAt:new Date(),updatedAt:new Date()});
  }
  async createForPermission(permission: string,dto: Omit<CreateNotificationDto,'userId'>) {
    const candidates=apiRows(await this.db.query(`SELECT u.id,r.permissions FROM arm_app.users u JOIN arm_app.roles r ON r.id=u."roleId" WHERE u.status='active' AND r."isActive" IS DISTINCT FROM false`));
    return this.db.transaction(async client => {
      const result=[];
      for(const user of candidates.filter(u=>hasPermission(u.permissions??[],permission))) {
        result.push(await insertIdentity(client,'notifications',{...dto,userId:user.id,channel:dto.channel??'in_app',read:false,createdAt:new Date(),updatedAt:new Date()}));
      }
      return result;
    });
  }
  /** Avisa a quienes revisan los reportes de un campus: permiso en ese campus o administradores listados en él. */
  async createForCampusPermission(campusId: number,permission: string,extraUserIds: number[],dto: Omit<CreateNotificationDto,'userId'>) {
    const candidates=apiRows(await this.db.query(`SELECT u.id,u."campusId",r.permissions FROM arm_app.users u JOIN arm_app.roles r ON r.id=u."roleId" WHERE u.status='active' AND r."isActive" IS DISTINCT FROM false`));
    const ids=new Set<number>(extraUserIds.map(Number).filter(Number.isFinite));
    for(const u of candidates) if(String(u.campusId)===String(campusId) && hasPermission(u.permissions??[],permission)) ids.add(Number(u.id));
    const active=new Set(candidates.map(u=>Number(u.id)));
    return this.db.transaction(async client => {
      for(const userId of ids) if(active.has(userId)) await insertIdentity(client,'notifications',{...dto,userId,channel:dto.channel??'in_app',read:false,createdAt:new Date(),updatedAt:new Date()});
    });
  }
  update(id: number,dto: Partial<CreateNotificationDto>) {
    return updateIdentity(this.db,'notifications',id,{title:dto.title,body:dto.body,link:dto.link,channel:dto.channel,updatedAt:new Date()});
  }
  async markRead(id: number,userId: number) {
    const result=await this.db.query('UPDATE arm_app.notifications SET read=true,"readAt"=now(),"updatedAt"=now() WHERE id=$1 AND "userId"=$2 RETURNING *',[id,userId]);
    if(!result.rowCount) { await this.findOneForUser(id,userId); throw new NotFoundException(); }
    return apiRows(result)[0];
  }
  async remove(id: number) {
    const result=await this.db.query('DELETE FROM arm_app.notifications WHERE id=$1',[id]);
    if(!result.rowCount) throw new NotFoundException();
    return {id};
  }
}
