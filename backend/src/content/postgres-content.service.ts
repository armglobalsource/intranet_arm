import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows, insertIdentity, updateIdentity, deleteIdentity } from '../common/database/identity-sql';
import { hasPermission } from '../common/permissions';
import { CreateContentDto } from './dto/create-content.dto';

@Injectable()
export class PostgresContentsService {
  constructor(private db:DatabaseService) {}
  private async context(userId:number) {
    const r=(await this.db.query('SELECT u."campusId",r.permissions FROM arm_app.users u LEFT JOIN arm_app.roles r ON r.id=u."roleId" WHERE u.id=$1 AND u.status=\'active\'',[userId])).rows[0];
    if(!r) throw new ForbiddenException();
    return {campus:r.campusId,manage:['content:create','content:publish','content:delete'].some(p=>hasPermission(r.permissions??[],p))};
  }
  async findAll(userId:number,_roleId?:number) {
    const u=await this.context(userId);
    return apiRows(await this.db.query(`SELECT * FROM arm_app.content WHERE $1 OR (status='published' AND ("campusId" IS NULL OR "campusId"=$2)) ORDER BY "createdAt" DESC,id DESC`,[u.manage,u.campus]));
  }
  async findNews(campusId?:string,status?:string,user?:any) {
    const u=await this.context(user?.sub);
    return apiRows(await this.db.query(`SELECT * FROM arm_app.content WHERE type='news' AND ($1 OR (status='published' AND ("campusId" IS NULL OR "campusId"=$2))) AND ($3::text IS NULL OR ($3='global' AND "campusId" IS NULL) OR "campusId"::text=$3) AND ($4::text IS NULL OR status=$4) ORDER BY "createdAt" DESC,id DESC`,[u.manage,u.campus,campusId||null,status||null]));
  }
  async findPublished(scope:'global'|'campus',campusId?:string,allCampuses=false) {
    return apiRows(await this.db.query(`SELECT * FROM arm_app.content WHERE type='news' AND status='published' AND (($1='global' AND "campusId" IS NULL) OR ($1='campus' AND "campusId" IS NOT NULL AND ($3 OR "campusId"::text=$2))) ORDER BY "createdAt" DESC,id DESC LIMIT 10`,[scope,campusId??null,allCampuses]));
  }
  async findOne(id:number,user?:any) {
    const row=apiRows(await this.db.query('SELECT * FROM arm_app.content WHERE id=$1',[id]))[0];
    if(!row)throw new NotFoundException('Contenido no encontrado');
    // Internal calls omit user; controller always supplies the authenticated user.
    if(user){const u=await this.context(user.sub);if(!u.manage && (row.status!=='published' || (row.campusId!=null && String(row.campusId)!==String(u.campus))))throw new ForbiddenException();}
    return row;
  }
  private fields(dto:Partial<CreateContentDto>) {
    return Object.fromEntries(['title','body','excerpt','type','pinned','campusId','status','imageUrl','videoUrl','instagramUrl','mediaItems'].filter(k=>(dto as any)[k]!==undefined).map(k=>[k,(dto as any)[k]]));
  }
  create(dto:CreateContentDto,userId:number) {
    return insertIdentity(this.db,'content',{...this.fields(dto),campusId:dto.campusId??null,status:dto.status??'draft',mediaItems:dto.mediaItems??[],pinned:dto.pinned??false,authorId:userId,publishedAt:dto.status==='published'?new Date():null,createdAt:new Date(),updatedAt:new Date()});
  }
  update(id:number,dto:Partial<CreateContentDto>) {
    return this.db.transaction(async db=>{
      const existing=(await db.query('SELECT status,"publishedAt" FROM arm_app.content WHERE id=$1 FOR UPDATE',[id])).rows[0];
      if(!existing)throw new NotFoundException('Contenido no encontrado');
      return updateIdentity(db,'content',id,{...this.fields(dto),updatedAt:new Date(),...(dto.status==='published'&&!existing.publishedAt?{publishedAt:new Date()}:{})});
    });
  }
  remove(id:number){return deleteIdentity(this.db,'content',id);}
}
