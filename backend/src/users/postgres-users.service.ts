import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../common/database/database.service';
import { apiRows, databaseError, insertIdentity, SqlConnection, updateIdentity } from '../common/database/identity-sql';
import { StorageService } from '../common/storage/storage.service';
import { PostgresNotificationsService } from '../notifications/postgres-notifications.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';

const userSelect = `SELECT u.*, CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id',r.id,'name',r.name) END AS role,
 CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'name',c.name,'address',c.address) END AS campus
 FROM arm_app.users u LEFT JOIN arm_app.roles r ON r.id=u."roleId" LEFT JOIN arm_app.campuses c ON c.id=u."campusId"`;

@Injectable()
export class PostgresUsersService {
  private readonly logger=new Logger(PostgresUsersService.name);
  constructor(private db: DatabaseService,private storage: StorageService,private notifications: PostgresNotificationsService) {}

  async rawById(id: number,db: SqlConnection=this.db) {
    const row=apiRows(await db.query(`${userSelect} WHERE u.id=$1`,[id]))[0];
    if(!row) throw new NotFoundException('Usuario no encontrado');
    return row;
  }
  async findByEmail(email: string) {
    return apiRows(await this.db.query(`${userSelect} WHERE lower(btrim(u.email))=$1`,[email.trim().toLowerCase()]))[0]??null;
  }
  private async formatMany(rawRows: any[],db: SqlConnection=this.db) {
    if(!rawRows.length) return [];
    const allTitles=apiRows(await db.query(`SELECT DISTINCT m."userId",j.id AS "jobTitleId",j.name FROM arm_app.org_memberships m JOIN arm_app.job_titles j ON j.id=m."jobTitleId" WHERE m."userId"=ANY($1::bigint[]) ORDER BY j.name`,[rawRows.map(row=>row.id)]));
    return rawRows.map(raw=>{
    const {passwordHash,nameLower,...user}=raw;
    const titles=allTitles.filter(title=>title.userId===raw.id);
    const ids=new Set(titles.map(t=>t.jobTitleId));
    user.jobTitles=[...titles.map(t=>({jobTitle:{id:t.jobTitleId,name:t.name},source:'orgchart'})),...(raw.jobTitles??[]).filter((t:any)=>!ids.has(t.jobTitleId)).map((t:any)=>({jobTitle:{id:t.jobTitleId,name:t.name},source:'manual'}))];
    return user;
    });
  }
  async findOne(id: number,db: SqlConnection=this.db) { return (await this.formatMany([await this.rawById(id,db)],db))[0]; }
  async findAll(_userId: number,_roleId: number,search?: string,page=1,limit=50) {
    page=Math.max(1,page); limit=Math.max(1,Math.min(2000,limit));
    const query=(search??'').trim().toLowerCase();
    const filter=`($1='' OR position($1 in lower(concat_ws(' ',u."firstName",u."lastName",u.email)))>0
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(u."jobTitles",'[]'::jsonb)) j WHERE position($1 in lower(j->>'name'))>0)
      OR EXISTS(SELECT 1 FROM arm_app.org_memberships m JOIN arm_app.job_titles j ON j.id=m."jobTitleId" WHERE m."userId"=u.id AND position($1 in lower(j.name))>0))`;
    const count=await this.db.query(`SELECT count(*)::int AS total FROM arm_app.users u WHERE ${filter}`,[query]);
    const rows=apiRows(await this.db.query(`${userSelect} WHERE ${filter} ORDER BY u."firstName",u."lastName",u.id LIMIT $2 OFFSET $3`,[query,limit,(page-1)*limit]));
    const data=await this.formatMany(rows);
    const total=count.rows[0].total;
    return {data,total,page,limit,totalPages:Math.ceil(total/limit)};
  }
  async findBirthdays() {
    return apiRows(await this.db.query(`SELECT id,"firstName","lastName","avatarUrl","birthDate" FROM arm_app.users WHERE status='active' AND nullif("birthDate",'') IS NOT NULL`));
  }
  private async jobTitles(ids: number[],db: SqlConnection=this.db) {
    const unique=[...new Set(ids)];
    const rows=apiRows(await db.query('SELECT id,name FROM arm_app.job_titles WHERE id=ANY($1::bigint[])',[unique]));
    if(rows.length!==unique.length) throw new BadRequestException('Cargo inexistente');
    return unique.map((id,sortOrder)=>({jobTitleId:id,name:rows.find(r=>r.id===id).name,sortOrder}));
  }
  async create(dto: CreateUserDto,_actor: number) {
    const row=await insertIdentity(this.db,'users',{...this.profile(dto),email:dto.email.trim().toLowerCase(),passwordHash:dto.password?await bcrypt.hash(dto.password,12):null,firstName:dto.firstName.trim(),lastName:dto.lastName.trim(),nameLower:`${dto.firstName.trim()} ${dto.lastName.trim()}`.toLowerCase(),roleId:dto.roleId,campusId:dto.campusId??null,jobTitles:await this.jobTitles(dto.jobTitleIds??[]),status:'active',createdAt:new Date(),updatedAt:new Date()});
    return this.findOne(row.id);
  }
  private profile(dto: any) {
    const result: Record<string,any>={};
    for(const key of ['phone','country','bio','birthDate','gender','ministerialTitle','memberSince','preferredName','phoneCountryCode','referralChannel','referredByName','servingStatus','interestAreas','otherAreaText']) {
      if(dto[key]!==undefined) result[key]=typeof dto[key]==='string'?dto[key].trim():dto[key];
    }
    return result;
  }
  async update(id: number,dto: UpdateUserDto) {
    const passwordHash=dto.password?await bcrypt.hash(dto.password,12):undefined;
    await this.db.transaction(async client=>{
      await client.query('SELECT id FROM arm_app.users WHERE id=$1 FOR UPDATE',[id]);
      const current=await this.rawById(id,client);
      const data: any={...this.profile(dto),updatedAt:new Date()};
      if(dto.email!==undefined) data.email=dto.email.trim().toLowerCase();
      if(passwordHash) data.passwordHash=passwordHash;
      for(const key of ['firstName','lastName','status','campusId','roleId'] as const) { const value=dto[key]; if(value!==undefined) data[key]=typeof value==='string'?value.trim():value; }
      if(dto.firstName!==undefined||dto.lastName!==undefined) data.nameLower=`${data.firstName??current.firstName} ${data.lastName??current.lastName??''}`.toLowerCase();
      if(dto.jobTitleIds!==undefined) data.jobTitles=await this.jobTitles(dto.jobTitleIds,client);
      await updateIdentity(client,'users',id,data);
    });
    return this.findOne(id);
  }
  async markOnboardingComplete(id: number,consent: boolean) {
    await updateIdentity(this.db,'users',id,{onboardingCompletedAt:new Date(),...(consent?{consentAcceptedAt:new Date()}:{}),updatedAt:new Date()});
    return this.findOne(id);
  }
  async updateLastLogin(id: number) { await updateIdentity(this.db,'users',id,{lastLoginAt:new Date()}); }
  async patchGoogleFields(id: number,patch: Record<string,string>) {
    await this.db.transaction(async client=>{
      await client.query('SELECT id FROM arm_app.users WHERE id=$1 FOR UPDATE',[id]);
      const current=await this.rawById(id,client);
      const data: any={updatedAt:new Date()};
      for(const key of ['firstName','lastName','avatarUrl']) if(patch[key]!==undefined) data[key]=patch[key];
      data.nameLower=`${data.firstName??current.firstName} ${data.lastName??current.lastName??''}`.toLowerCase();
      await updateIdentity(client,'users',id,data);
    });
    return this.rawById(id);
  }
  async claimAccount(id: number,data: {firstName:string;lastName:string;password:string}) {
    const hash=await bcrypt.hash(data.password,12);
    const result=await this.db.query(`UPDATE arm_app.users SET "passwordHash"=$2,"firstName"=$3,"lastName"=$4,"nameLower"=lower($3||' '||$4),"updatedAt"=now() WHERE id=$1 AND "passwordHash" IS NULL AND status IN ('active','pending') RETURNING id`,[id,hash,data.firstName.trim(),data.lastName.trim()]);
    if(!result.rowCount) throw new ConflictException('La cuenta ya fue reclamada o no está disponible');
    return this.rawById(id);
  }
  async selfRegister(data: {email:string;password?:string;firstName:string;lastName:string;avatarUrl?:string|null}) {
    const row=await insertIdentity(this.db,'users',{email:data.email.trim().toLowerCase(),passwordHash:data.password?await bcrypt.hash(data.password,12):null,firstName:data.firstName.trim(),lastName:data.lastName.trim(),nameLower:`${data.firstName.trim()} ${data.lastName.trim()}`.toLowerCase(),roleId:2,jobTitles:[],avatarUrl:data.avatarUrl??null,status:'pending',createdAt:new Date(),updatedAt:new Date()});
    return this.rawById(row.id);
  }
  private async changeStatus(id: number,status: string,allowed: string[],roleId?:number) {
    try {
      const result=await this.db.query(`UPDATE arm_app.users SET status=$2,"roleId"=coalesce($4,"roleId"),"updatedAt"=now() WHERE id=$1 AND status=ANY($3::text[]) RETURNING id`,[id,status,allowed,roleId??null]);
      if(!result.rowCount) {await this.rawById(id);throw new ConflictException('El estado actual no permite esta operación');}
    } catch(error) {databaseError(error);}
    await this.notifications.create({userId:id,title:status==='active'?'Tu cuenta fue aprobada':'Tu solicitud de registro fue rechazada',link:'/auth/login',channel:'in_app'},0).catch(()=>this.logger.warn('No se pudo enviar notificación de estado'));
    return this.findOne(id);
  }
  approve(id: number,roleId?:number) { return this.changeStatus(id,'active',['pending','rejected'],roleId); }
  reject(id: number) { return this.changeStatus(id,'rejected',['pending']); }
  async remove(id: number) {
    try {
      await this.db.transaction(async client=>{
        await this.rawById(id,client);
        await client.query('DELETE FROM arm_app.org_memberships WHERE "userId"=$1',[id]);
        await client.query('DELETE FROM arm_app.users WHERE id=$1',[id]);
      });
    } catch(error) { databaseError(error); }
    return {id};
  }
  async uploadAvatar(id: number,file: Express.Multer.File) {
    const extensions:Record<string,string>={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','image/heic':'.heic','image/heif':'.heif'};
    if(!file||!extensions[file.mimetype]) throw new BadRequestException('Archivo de imagen inválido');
    await this.rawById(id);
    const avatarUrl=await this.storage.uploadPublic(`avatars/user-${id}-${Date.now()}${extensions[file.mimetype]}`,file.buffer,file.mimetype);
    await updateIdentity(this.db,'users',id,{avatarUrl,updatedAt:new Date()});
    return this.findOne(id);
  }
}
