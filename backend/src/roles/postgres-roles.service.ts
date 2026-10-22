import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows, databaseError, insertIdentity, updateIdentity } from '../common/database/identity-sql';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

function normalize(role:any) {return {...role,isSystem:role.isSystem??false,isActive:role.isActive??true,nameLower:role.nameLower??role.name?.toLowerCase()??'',permissions:role.permissions??[]};}
@Injectable()
export class PostgresRolesService {
  constructor(private db:DatabaseService) {}
  async findAll() {
    return apiRows(await this.db.query(`SELECT r.*,(SELECT count(*)::int FROM arm_app.users u WHERE u."roleId"=r.id) AS "userCount" FROM arm_app.roles r ORDER BY r.name`)).map(normalize);
  }
  async findOne(id:number) {
    const row=apiRows(await this.db.query('SELECT * FROM arm_app.roles WHERE id=$1',[id]))[0];
    if(!row) throw new NotFoundException('Rol no encontrado');
    return normalize(row);
  }
  async create(dto:CreateRoleDto) {
    return normalize(await insertIdentity(this.db,'roles',{name:dto.name.trim(),nameLower:dto.name.trim().toLowerCase(),description:dto.description?.trim()??null,isSystem:false,isActive:true,permissions:[],createdAt:new Date(),updatedAt:new Date()}));
  }
  async update(id:number,dto:UpdateRoleDto) {
    return this.db.transaction(async client=>{
      const row=apiRows(await client.query('SELECT * FROM arm_app.roles WHERE id=$1 FOR UPDATE',[id]))[0];
      if(!row) throw new NotFoundException('Rol no encontrado');
      const before=normalize(row);
      if(before.isSystem&&((dto.name!==undefined&&dto.name.trim().toLowerCase()!==before.nameLower)||dto.isActive===false)) throw new ForbiddenException('No se puede renombrar o deshabilitar un rol del sistema');
      return normalize(await updateIdentity(client,'roles',id,{name:dto.name?.trim(),nameLower:dto.name?.trim().toLowerCase(),description:dto.description===undefined?undefined:dto.description?.trim()??null,isActive:dto.isActive,permissions:dto.permissions,updatedAt:new Date()}));
    });
  }
  async remove(id:number) {
    try {await this.db.transaction(async client=>{
      const row=apiRows(await client.query('SELECT * FROM arm_app.roles WHERE id=$1 FOR UPDATE',[id]))[0];
      if(!row) throw new NotFoundException('Rol no encontrado');
      if(row.isSystem) throw new ForbiddenException('No se puede eliminar un rol del sistema');
      await client.query('DELETE FROM arm_app.roles WHERE id=$1',[id]);
    });} catch(error) {databaseError(error);}
    return {id};
  }
}
