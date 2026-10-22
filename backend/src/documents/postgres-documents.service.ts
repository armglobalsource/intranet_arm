import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows, insertIdentity, updateIdentity, deleteIdentity } from '../common/database/identity-sql';
import { hasPermission } from '../common/permissions';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class PostgresDocumentsService {
  constructor(private db:DatabaseService) {}
  private async context(id:number){
    const u=(await this.db.query('SELECT u."departmentId",u."roleId",r.permissions FROM arm_app.users u LEFT JOIN arm_app.roles r ON r.id=u."roleId" WHERE u.id=$1 AND u.status=\'active\'',[id])).rows[0];
    if(!u)throw new ForbiddenException();
    return {departmentId:u.departmentId,roleId:u.roleId,manage:hasPermission(u.permissions??[],'documents:upload')||hasPermission(u.permissions??[],'documents:delete')};
  }
  async findAll(userId:number,_roleId?:number){
    const u=await this.context(userId);
    // Role IDs do not encode a hierarchy. Restricted documents require that role.
    return apiRows(await this.db.query(`SELECT * FROM arm_app.documents WHERE $1 OR (status='active' AND ("departmentId" IS NULL OR "departmentId"=$2) AND ("minRoleId" IS NULL OR "minRoleId"=$3)) ORDER BY "createdAt" DESC,id DESC`,[u.manage,u.departmentId,u.roleId]));
  }
  async findOne(id:number,user?:any){
    const row=apiRows(await this.db.query('SELECT * FROM arm_app.documents WHERE id=$1',[id]))[0];
    if(!row)throw new NotFoundException('Documento no encontrado');
    if(user){const u=await this.context(user.sub);if(!u.manage && (row.status!=='active'||(row.departmentId!=null&&String(row.departmentId)!==String(u.departmentId))||(row.minRoleId!=null&&String(row.minRoleId)!==String(u.roleId))))throw new ForbiddenException();}
    return row;
  }
  private fields(dto:Partial<CreateDocumentDto>){return Object.fromEntries(['name','description','departmentId','minRoleId'].filter(k=>(dto as any)[k]!==undefined).map(k=>[k,(dto as any)[k]]));}
  create(dto:CreateDocumentDto,userId:number){return insertIdentity(this.db,'documents',{...this.fields(dto),uploadedBy:userId,status:'active',createdAt:new Date(),updatedAt:new Date()});}
  update(id:number,dto:Partial<CreateDocumentDto>){return updateIdentity(this.db,'documents',id,{...this.fields(dto),updatedAt:new Date()});}
  remove(id:number){return deleteIdentity(this.db,'documents',id);}
}
