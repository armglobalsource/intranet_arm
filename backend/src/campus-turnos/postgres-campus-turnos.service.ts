import { Injectable,BadRequestException,NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows,insertIdentity,updateIdentity,SqlConnection } from '../common/database/identity-sql';
import { CampusTurnoTipo,CreateAdministradorDto,UpdateAdministradorDto,CreateEquipoDto,UpdateEquipoDto,GenerarCalendarioDto,UpdateTurnoDto } from './dto/campus-turno.dto';

function dateOnly(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value) throw new BadRequestException('Fecha inválida');
  return value;
}
@Injectable()
export class PostgresCampusTurnosService {
  constructor(private db:DatabaseService) {}
  async findAdministradores(campusId:number,tipo:CampusTurnoTipo) {return apiRows(await this.db.query(`SELECT * FROM arm_app.campus_administradores WHERE "campusId"=$1 AND coalesce(tipo,'administradores')=$2 AND "isActive" IS DISTINCT FROM false ORDER BY nombre,id`,[campusId,tipo]));}
  createAdministrador(dto:CreateAdministradorDto) {return insertIdentity(this.db,'campus_administradores',{campusId:dto.campusId,tipo:dto.tipo,nombre:dto.nombre.trim(),isActive:true,createdAt:new Date(),updatedAt:new Date()});}
  updateAdministrador(id:number,dto:UpdateAdministradorDto) {return updateIdentity(this.db,'campus_administradores',id,{nombre:dto.nombre?.trim(),isActive:dto.isActive,updatedAt:new Date()});}
  async findEquipos(campusId:number,tipo:CampusTurnoTipo) {return apiRows(await this.db.query(`SELECT * FROM arm_app.campus_equipos WHERE "campusId"=$1 AND coalesce(tipo,'administradores')=$2 AND "isActive" IS DISTINCT FROM false ORDER BY id`,[campusId,tipo]));}
  private async validateMembers(db:SqlConnection,ids:number[],campusId:number,tipo:string) {
    if(!ids.length||new Set(ids).size!==ids.length) throw new BadRequestException('Integrantes vacíos o repetidos');
    const result=await db.query(`SELECT id FROM arm_app.campus_administradores WHERE id=ANY($1::bigint[]) AND "campusId"=$2 AND coalesce(tipo,'administradores')=$3 AND "isActive" IS DISTINCT FROM false FOR SHARE`,[ids,campusId,tipo]);
    if(result.rowCount!==ids.length) throw new BadRequestException('Los integrantes deben pertenecer al mismo campus y tipo');
  }
  createEquipo(dto:CreateEquipoDto) {
    return this.db.transaction(async client=>{
      await this.validateMembers(client,dto.administradorIds,dto.campusId,dto.tipo);
      return insertIdentity(client,'campus_equipos',{campusId:dto.campusId,tipo:dto.tipo,nombre:dto.nombre.trim(),administradorIds:dto.administradorIds,modalidad:dto.modalidad??null,isActive:true,createdAt:new Date(),updatedAt:new Date()});
    });
  }
  updateEquipo(id:number,dto:UpdateEquipoDto) {
    return this.db.transaction(async client=>{
      const row=apiRows(await client.query('SELECT * FROM arm_app.campus_equipos WHERE id=$1 FOR UPDATE',[id]))[0];
      if(!row) throw new NotFoundException('Equipo no encontrado');
      if(dto.administradorIds!==undefined) await this.validateMembers(client,dto.administradorIds,row.campusId,row.tipo??'administradores');
      return updateIdentity(client,'campus_equipos',id,{nombre:dto.nombre?.trim(),administradorIds:dto.administradorIds,modalidad:dto.modalidad,isActive:dto.isActive,updatedAt:new Date()});
    });
  }
  async findTurnos(campusId:number,tipo:CampusTurnoTipo,desde?:string,hasta?:string) {
    return apiRows(await this.db.query(`SELECT t.*,t.fecha::text AS fecha FROM arm_app.campus_turnos t WHERE "campusId"=$1 AND coalesce(tipo,'administradores')=$2 AND ($3::date IS NULL OR t.fecha >= $3) AND ($4::date IS NULL OR t.fecha <= $4) ORDER BY t.fecha,t.id`,[campusId,tipo,desde?dateOnly(desde):null,hasta?dateOnly(hasta):null]));
  }
  generar(dto:GenerarCalendarioDto) {
    dateOnly(dto.fechaInicio);
    if(!dto.equipoIds.length||!Number.isInteger(dto.semanas)||dto.semanas<1||dto.semanas>520) throw new BadRequestException('Rotación inválida (máximo 520 semanas)');
    return this.db.transaction(async client=>{
      const teams=apiRows(await client.query(`SELECT * FROM arm_app.campus_equipos WHERE id=ANY($1::bigint[]) AND "campusId"=$2 AND coalesce(tipo,'administradores')=$3 AND "isActive" IS DISTINCT FROM false AND modalidad IS NOT DISTINCT FROM $4::text ORDER BY id FOR SHARE`,[dto.equipoIds,dto.campusId,dto.tipo,dto.modalidad??null]));
      if(teams.length!==new Set(dto.equipoIds).size) throw new BadRequestException('Equipo no corresponde al campus, tipo o modalidad');
      let creados=0;
      for(let i=0;i<dto.semanas;i++) {
        const date=new Date(dto.fechaInicio+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+i*7);
        const id=dto.equipoIds[i%dto.equipoIds.length];
        const result=await client.query(`WITH identity AS (SELECT nextval(pg_get_serial_sequence('arm_app.campus_turnos','id')) AS id)
          INSERT INTO arm_app.campus_turnos(id,document_id,"campusId",tipo,modalidad,fecha,"equipoId","equipoNombreSnapshot","isManualOverride","createdAt","updatedAt")
          SELECT id,id::text,$1,$2,$3,$4::date,$5,$6,false,now(),now() FROM identity
          ON CONFLICT("campusId",tipo,modalidad,fecha) DO NOTHING`,[dto.campusId,dto.tipo,dto.modalidad??null,date.toISOString().slice(0,10),id,teams.find(t=>t.id===id).nombre]);
        creados+=result.rowCount??0;
      }
      return {creados};
    });
  }
  updateTurno(id:number,dto:UpdateTurnoDto) {
    return this.db.transaction(async client=>{
      const row=apiRows(await client.query('SELECT * FROM arm_app.campus_turnos WHERE id=$1 FOR UPDATE',[id]))[0];
      if(!row) throw new NotFoundException('Turno no encontrado');
      const team=apiRows(await client.query(`SELECT * FROM arm_app.campus_equipos WHERE id=$1 AND "campusId"=$2 AND coalesce(tipo,'administradores')=$3 AND modalidad IS NOT DISTINCT FROM $4::text AND "isActive" IS DISTINCT FROM false FOR SHARE`,[dto.equipoId,row.campusId,row.tipo??'administradores',row.modalidad]))[0];
      if(!team) throw new BadRequestException('Equipo no corresponde al turno');
      return updateIdentity(client,'campus_turnos',id,{equipoId:team.id,equipoNombreSnapshot:team.nombre,isManualOverride:true,updatedAt:new Date()});
    });
  }
}
