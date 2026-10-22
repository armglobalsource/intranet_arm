import { Injectable,NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows,insertIdentity,updateIdentity,deleteIdentity } from '../common/database/identity-sql';
import { CreateJobTitleDto,UpdateJobTitleDto } from './dto/job-title.dto';

@Injectable()
export class PostgresJobTitlesService {
  constructor(private db:DatabaseService) {}
  async findAll() {return apiRows(await this.db.query('SELECT * FROM arm_app.job_titles ORDER BY "sortOrder",name,id'));}
  async findAllWithIds() {return apiRows(await this.db.query('SELECT * FROM arm_app.job_titles WHERE "isActive"=true ORDER BY "sortOrder",name,id'));}
  async findActive():Promise<string[]> {return (await this.findAllWithIds()).map(r=>r.name);}
  async findOne(id:number) {
    const row=apiRows(await this.db.query('SELECT * FROM arm_app.job_titles WHERE id=$1',[id]))[0];
    if(!row) throw new NotFoundException('Cargo no encontrado');return row;
  }
  create(dto:CreateJobTitleDto) {return insertIdentity(this.db,'job_titles',{name:dto.name.trim(),nameLower:dto.name.trim().toLowerCase(),sortOrder:dto.sortOrder??0,isActive:true,createdAt:new Date(),updatedAt:new Date()});}
  async update(id:number,dto:UpdateJobTitleDto) {
    return this.db.transaction(async client=>{
      const row=await updateIdentity(client,'job_titles',id,{name:dto.name?.trim(),nameLower:dto.name?.trim().toLowerCase(),sortOrder:dto.sortOrder,isActive:dto.isActive,updatedAt:new Date()});
      if(dto.name!==undefined) await client.query(`UPDATE arm_app.users u SET "jobTitles"=(SELECT jsonb_agg(CASE WHEN (j->>'jobTitleId')::bigint=$1 THEN jsonb_set(j,'{name}',to_jsonb($2::text)) ELSE j END ORDER BY ord) FROM jsonb_array_elements(u."jobTitles") WITH ORDINALITY a(j,ord)) WHERE u."jobTitles" @> $3::jsonb`,[id,dto.name.trim(),JSON.stringify([{jobTitleId:id}])]);
      return row;
    });
  }
  async remove(id:number) {
    return this.db.transaction(async client=>{
      await client.query('SELECT id FROM arm_app.job_titles WHERE id=$1 FOR UPDATE',[id]);
      await client.query(`UPDATE arm_app.users u SET "jobTitles"=coalesce((SELECT jsonb_agg(j ORDER BY ord) FROM jsonb_array_elements(u."jobTitles") WITH ORDINALITY a(j,ord) WHERE (j->>'jobTitleId')::bigint IS DISTINCT FROM $1),'[]'),"updatedAt"=now() WHERE u."jobTitles" @> $2::jsonb`,[id,JSON.stringify([{jobTitleId:id}])]);
      await client.query('UPDATE arm_app.org_memberships SET "jobTitleId"=null,"updatedAt"=now() WHERE "jobTitleId"=$1',[id]);
      return deleteIdentity(client,'job_titles',id);
    });
  }
  async getAffectedUsers(id:number) {
    await this.findOne(id);
    return apiRows(await this.db.query(`SELECT u.id,u."firstName",u."lastName",array_remove(ARRAY[CASE WHEN u."jobTitles" @> $2::jsonb THEN 'manual' END,CASE WHEN EXISTS(SELECT 1 FROM arm_app.org_memberships m WHERE m."userId"=u.id AND m."jobTitleId"=$1) THEN 'orgchart' END],NULL) AS sources FROM arm_app.users u WHERE u."jobTitles" @> $2::jsonb OR EXISTS(SELECT 1 FROM arm_app.org_memberships m WHERE m."userId"=u.id AND m."jobTitleId"=$1) ORDER BY u."firstName",u.id`,[id,JSON.stringify([{jobTitleId:id}])]));
  }
  async getActiveByMembershipUserIds(ids:number[]):Promise<Record<number,{jobTitleId:number;name:string}[]>> {
    const rows=apiRows(await this.db.query(`SELECT DISTINCT m."userId",j.id AS "jobTitleId",j.name FROM arm_app.org_memberships m JOIN arm_app.job_titles j ON j.id=m."jobTitleId" WHERE m."userId"=ANY($1::bigint[])`,[ids]));
    const result:Record<number,{jobTitleId:number;name:string}[]>={};
    for(const r of rows) (result[r.userId]??=[]).push({jobTitleId:r.jobTitleId,name:r.name});
    return result;
  }
  async findOrCreateByName(rawName:string) {
    const name=rawName.trim();
    return this.db.transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,11))',[name.toLowerCase()]);
      const row=apiRows(await client.query('SELECT id,name FROM arm_app.job_titles WHERE lower(btrim(name))=$1',[name.toLowerCase()]))[0];
      if(row) return row;
      const created=await insertIdentity(client,'job_titles',{name,nameLower:name.toLowerCase(),sortOrder:0,isActive:true,createdAt:new Date(),updatedAt:new Date()});
      return {id:created.id,name:created.name};
    });
  }
}
