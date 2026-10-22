import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows } from '../common/database/identity-sql';
import { hasPermission } from '../common/permissions';
@Injectable()
export class PostgresSearchService {
  constructor(private db:DatabaseService) {}
  async globalSearch(query:string,userId:number) {
    if(!query || query.trim().length<2) return {users:[],content:[],documents:[]};
    const u=(await this.db.query('SELECT u."campusId",u."departmentId",u."roleId",r.permissions FROM arm_app.users u LEFT JOIN arm_app.roles r ON r.id=u."roleId" WHERE u.id=$1 AND u.status=\'active\'',[userId])).rows[0];
    if(!u)throw new ForbiddenException();
    const q=query.trim().toLowerCase();
    const docAdmin=['documents:upload','documents:delete'].some(p=>hasPermission(u.permissions??[],p));
    const [users,content,documents]=await Promise.all([
      hasPermission(u.permissions??[],'users:view') ? this.db.query(`SELECT id,"firstName","lastName","avatarUrl","jobTitles"->0->>'name' AS "jobTitle" FROM arm_app.users WHERE status='active' AND (strpos(lower(concat_ws(' ',"firstName","lastName")),$1)>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce("jobTitles",'[]')) j WHERE strpos(lower(j->>'name'),$1)>0)) ORDER BY "firstName","lastName",id LIMIT 10`,[q]) : Promise.resolve({rows:[],fields:[]} as any),
      this.db.query(`SELECT id,title,excerpt,type,"publishedAt" FROM arm_app.content WHERE status='published' AND ("campusId" IS NULL OR "campusId"=$2 OR $3) AND strpos(lower(concat_ws(' ',title,excerpt)),$1)>0 ORDER BY "publishedAt" DESC,id DESC LIMIT 10`,[q,u.campusId,hasPermission(u.permissions??[],'*')]),
      this.db.query(`SELECT id,name,description,"mimeType","sizeBytes" FROM arm_app.documents WHERE status='active' AND ($4 OR (("departmentId" IS NULL OR "departmentId"=$2) AND ("minRoleId" IS NULL OR "minRoleId"=$3))) AND strpos(lower(concat_ws(' ',name,description)),$1)>0 ORDER BY "createdAt" DESC,id DESC LIMIT 10`,[q,u.departmentId,u.roleId,docAdmin]),
    ]);
    return {users:apiRows(users),content:apiRows(content),documents:apiRows(documents),query};
  }
}
