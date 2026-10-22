import { Injectable,NotFoundException,BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows,insertIdentity,updateIdentity,deleteIdentity,SqlConnection } from '../common/database/identity-sql';
import { StorageService } from '../common/storage/storage.service';
import { PostgresUsersService } from '../users/postgres-users.service';
import { CreateOrgAreaDto,UpdateOrgAreaDto,CreateOrgTeamDto,UpdateOrgTeamDto,CreateOrgMembershipDto,UpdateOrgMembershipDto } from './dto/create-orgchart.dto';

const clean=(alias:string)=>`(to_jsonb(${alias}) - ARRAY['document_id','source_path','source_run_sha256','source_record_sha256','source_fields','source_timestamps','passwordHash','nameLower'])`;
const membershipSelect=`SELECT m.*,
 CASE WHEN a.id IS NULL THEN NULL ELSE ${clean('a')} END AS area,
 CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'name',t.name,'area',${clean('ta')}) END AS team,
 CASE WHEN j.id IS NULL THEN NULL ELSE jsonb_build_object('id',j.id,'name',j.name) END AS "jobTitle",
 ${clean('u')} AS "memberUser"
 FROM arm_app.org_memberships m JOIN arm_app.users u ON u.id=m."userId"
 LEFT JOIN arm_app.org_areas a ON a.id=m."areaId"
 LEFT JOIN arm_app.org_teams t ON t.id=m."teamId"
 LEFT JOIN arm_app.org_areas ta ON ta.id=t."areaId"
 LEFT JOIN arm_app.job_titles j ON j.id=m."jobTitleId"`;
@Injectable()
export class PostgresOrgChartService {
  constructor(private db:DatabaseService,private storage:StorageService,private users:PostgresUsersService) {}
  async getAreas() {return apiRows(await this.db.query('SELECT * FROM arm_app.org_areas WHERE "isActive"=true ORDER BY "sortOrder",id'));}
  async getAllAreas() {return apiRows(await this.db.query('SELECT * FROM arm_app.org_areas ORDER BY "isActive" DESC NULLS LAST,"sortOrder",id'));}
  private async getRow(table:'org_areas'|'org_teams'|'org_memberships',id:number,db:SqlConnection=this.db) {
    const row=apiRows(await db.query(`SELECT * FROM arm_app.${table} WHERE id=$1`,[id]))[0];
    if(!row) throw new NotFoundException('Registro del organigrama no encontrado');return row;
  }
  private formatMembership(row:any,withUser=false) {
    const {memberUser,...membership}=row;
    if(withUser) membership.user={...memberUser,jobTitles:(memberUser?.jobTitles??[]).map((t:any)=>({jobTitle:{id:t.jobTitleId,name:t.name}}))};
    return membership;
  }
  async getAreaTree(slug:string) {
    const area=apiRows(await this.db.query('SELECT * FROM arm_app.org_areas WHERE slug=$1',[slug]))[0];
    if(!area) throw new NotFoundException('Área no encontrada');
    const teams=apiRows(await this.db.query('SELECT * FROM arm_app.org_teams WHERE "areaId"=$1 AND "isActive"=true ORDER BY "colPosition","sortOrder",id',[area.id]));
    const members=apiRows(await this.db.query(`${membershipSelect} WHERE m."areaId"=$1 OR m."teamId"=ANY($2::bigint[]) ORDER BY m."sortOrder",m.id`,[area.id,teams.map(t=>t.id)]));
    const build=(parent:number|null,visited=new Set<number>()):any[]=>teams.filter(t=>(t.parentTeamId??null)===parent&&!visited.has(t.id)).map(t=>({...t,memberships:members.filter(m=>m.teamId===t.id).map(m=>this.formatMembership(m,true)),children:build(t.id,new Set([...visited,t.id]))}));
    return {...area,leaders:members.filter(m=>m.areaId===area.id&&m.role==='area_leader').map(m=>this.formatMembership(m,true)),teams:build(null)};
  }
  createArea(dto:CreateOrgAreaDto) {return insertIdentity(this.db,'org_areas',{...dto,sortOrder:dto.sortOrder??0,isActive:true,createdAt:new Date(),updatedAt:new Date()});}
  updateArea(id:number,dto:UpdateOrgAreaDto) {return updateIdentity(this.db,'org_areas',id,{...dto,updatedAt:new Date()});}
  async deleteArea(id:number) {
    return this.db.transaction(async client=>{
      await this.getRow('org_areas',id,client);
      await client.query('DELETE FROM arm_app.org_memberships WHERE "areaId"=$1 OR "teamId" IN(SELECT id FROM arm_app.org_teams WHERE "areaId"=$1)',[id]);
      await client.query('DELETE FROM arm_app.org_teams WHERE "areaId"=$1',[id]);
      await deleteIdentity(client,'org_areas',id);return {id,deleted:true};
    });
  }
  async getTeams() {return apiRows(await this.db.query(`SELECT t.*,${clean('a')} AS area FROM arm_app.org_teams t JOIN arm_app.org_areas a ON a.id=t."areaId" WHERE t."isActive"=true ORDER BY t."areaId",t."sortOrder",t.id`));}
  async getAllTeams() {return apiRows(await this.db.query(`SELECT t.*,${clean('a')} AS area,(SELECT count(*)::int FROM arm_app.org_memberships m WHERE m."teamId"=t.id) AS "memberCount" FROM arm_app.org_teams t JOIN arm_app.org_areas a ON a.id=t."areaId" ORDER BY t."isActive" DESC NULLS LAST,t."areaId",t."sortOrder",t.id`));}
  createTeam(dto:CreateOrgTeamDto) {
    return this.db.transaction(async client=>{
      if(dto.parentTeamId) {
        const parent=await this.getRow('org_teams',dto.parentTeamId,client);
        if(parent.areaId!==dto.areaId) throw new BadRequestException('El equipo padre debe pertenecer a la misma área');
      }
      return insertIdentity(client,'org_teams',{...dto,parentTeamId:dto.parentTeamId??null,colPosition:dto.colPosition??0,sortOrder:dto.sortOrder??0,isActive:true,createdAt:new Date(),updatedAt:new Date()});
    });
  }
  updateTeam(id:number,dto:UpdateOrgTeamDto) {return updateIdentity(this.db,'org_teams',id,{...dto,updatedAt:new Date()});}
  deleteTeam(id:number) {return this.updateTeam(id,{isActive:false});}
  private async uploadLogo(table:'org_areas'|'org_teams',id:number,file:Express.Multer.File) {
    await this.getRow(table,id);
    const extensions:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
    if(!file||!extensions[file.mimetype]) throw new BadRequestException('Imagen inválida');
    const url=await this.storage.uploadPublic(`${table}/${id}-${Date.now()}.${extensions[file.mimetype]}`,file.buffer,file.mimetype);
    return updateIdentity(this.db,table,id,{iconUrl:url,updatedAt:new Date()});
  }
  uploadAreaLogo(id:number,file:Express.Multer.File) {return this.uploadLogo('org_areas',id,file);}
  uploadTeamLogo(id:number,file:Express.Multer.File) {return this.uploadLogo('org_teams',id,file);}
  private async membership(id:number,db:SqlConnection=this.db) {
    const row=apiRows(await db.query(`${membershipSelect} WHERE m.id=$1`,[id]))[0];
    if(!row) throw new NotFoundException('Membresía no encontrada');return this.formatMembership(row);
  }
  async createMembership(dto:CreateOrgMembershipDto) {
    if((dto.areaId==null)===(dto.teamId==null)||(dto.areaId!=null&&dto.role!=='area_leader')) throw new BadRequestException('Indica un área con rol de líder o un equipo');
    const row=await insertIdentity(this.db,'org_memberships',{userId:dto.userId,areaId:dto.areaId??null,teamId:dto.teamId??null,role:dto.role,jobTitleId:dto.jobTitleId??null,sortOrder:dto.sortOrder??0,createdAt:new Date(),updatedAt:new Date()});
    return this.membership(row.id);
  }
  updateMembership(id:number,dto:UpdateOrgMembershipDto) {
    return this.db.transaction(async client=>{
      await updateIdentity(client,'org_memberships',id,{...dto,updatedAt:new Date()});return this.membership(id,client);
    });
  }
  deleteMembership(id:number) {return deleteIdentity(this.db,'org_memberships',id);}
  async getUserOrgProfile(userId:number) {
    const user=await this.users.findOne(userId);
    const rows=apiRows(await this.db.query(`${membershipSelect} WHERE m."userId"=$1 ORDER BY m."sortOrder",m.id`,[userId]));
    return {...user,orgMemberships:rows.map(r=>this.formatMembership(r))};
  }
  async getUserAreaCategoryMap():Promise<Record<number,'worship'|'tecnico'>> {
    const rows=apiRows(await this.db.query(`SELECT m."userId",CASE WHEN bool_or(a.slug='worship') THEN 'worship' ELSE 'tecnico' END AS category FROM arm_app.org_memberships m LEFT JOIN arm_app.org_teams t ON t.id=m."teamId" JOIN arm_app.org_areas a ON a.id=coalesce(m."areaId",t."areaId") WHERE a.slug IN('worship','produccion') GROUP BY m."userId"`));
    return Object.fromEntries(rows.map(r=>[r.userId,r.category]));
  }
  async search(q:string) {
    const term=q?.trim().toLowerCase();if(!term||term.length<2) return [];
    const rows=apiRows(await this.db.query(`SELECT u.id FROM arm_app.users u WHERE u.status='active' AND EXISTS(SELECT 1 FROM arm_app.org_memberships m LEFT JOIN arm_app.job_titles j ON j.id=m."jobTitleId" WHERE m."userId"=u.id AND (position($1 in lower(concat_ws(' ',u."firstName",u."lastName")))>0 OR position($1 in lower(j.name))>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(u."jobTitles",'[]')) jt WHERE position($1 in lower(jt->>'name'))>0))) ORDER BY u."firstName",u.id LIMIT 40`,[term]));
    const result=[];for(const row of rows) result.push(await this.getUserOrgProfile(row.id));return result;
  }
}
