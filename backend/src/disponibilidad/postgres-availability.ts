import { BadRequestException,Injectable,NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
import { apiRows } from '../common/database/identity-sql';
import { PostgresCampusService } from '../campus/postgres-campus.service';
import { EncounterSlot } from './disponibilidad.service';
import { BulkSubmitDto } from './dto/disponibilidad.dto';

export function isoWeekMonday(label:string) {
  const match=/^(\d{4})-W(\d{2})$/.exec(label??'');
  if(!match) throw new BadRequestException('Semana ISO inválida');
  const year=Number(match[1]),week=Number(match[2]);
  if(year<1900||year>9998||week<1||week>53) throw new BadRequestException('Semana ISO inválida');
  const monday=(y:number)=>{const d=new Date(Date.UTC(y,0,4));d.setUTCDate(d.getUTCDate()-((d.getUTCDay()||7)-1));return d;};
  const result=monday(year);result.setUTCDate(result.getUTCDate()+(week-1)*7);
  if(result>=monday(year+1)) throw new BadRequestException('Semana inexistente en ese año');
  return result;
}

export function buildEncounters(schedules:any[],week:string):EncounterSlot[] {
  const start=isoWeekMonday(week);
  const days:Record<string,number>={lunes:0,martes:1,miercoles:2,jueves:3,viernes:4,sabado:5,domingo:6};
  const groups=new Map<string,any[]>();
  for(const s of schedules??[]) {
    const key=s.bloque?`${s.dia}_${s.bloque}`:`${s.dia}_${s.hora}`;
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key)!.push(s);
  }
  const result:EncounterSlot[]=[];
  for(const [key,items] of groups) {
    items.sort((a,b)=>String(a.hora).localeCompare(String(b.hora)));
    const first=items[0];
    const day=days[String(first.dia).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()];
    if(day===undefined) continue;
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(first.hora)) throw new BadRequestException('Horario de campus inválido');
    const [h,m]=first.hora.split(':').map(Number);
    const date=new Date(start);date.setUTCDate(date.getUTCDate()+day);date.setUTCHours(h,m,0,0);
    result.push({scheduleKey:key,dia:first.dia,hora:items.map(s=>s.hora).join(' · '),bloque:first.bloque??undefined,encounterDate:date,fichaType:first.fichaType??undefined});
  }
  return result.sort((a,b)=>a.encounterDate.getTime()-b.encounterDate.getTime());
}

class PostgresAvailability {
  constructor(protected db:DatabaseService,protected campus:PostgresCampusService,private table:'disponibilidades'|'disponibilidades_tecnicos',private matrixKey:'volunteers'|'tecnicos') {}
  async getEncounters(campusId:number,week:string) {return buildEncounters((await this.campus.findOne(campusId)).schedules??[],week);}
  async bulkSubmit(userId:number,userName:string,dto:BulkSubmitDto) {
    isoWeekMonday(dto.weekLabel);
    if(new Set(dto.slots.map(s=>s.scheduleKey)).size!==dto.slots.length) throw new BadRequestException('Horario repetido');
    return this.db.transaction(async client=>{
      const campus=apiRows(await client.query('SELECT * FROM arm_app.campuses WHERE id=$1 FOR SHARE',[dto.campusId]))[0];
      if(!campus) throw new NotFoundException('Campus no encontrado');
      const encounters=new Map(buildEncounters(campus.schedules??[],dto.weekLabel).map(e=>[e.scheduleKey,e]));
      for(const s of dto.slots) if(!encounters.has(s.scheduleKey)) throw new BadRequestException('Horario no pertenece al campus');
      const results=new Map<string,any>();
      for(const slot of [...dto.slots].sort((a,b)=>a.scheduleKey.localeCompare(b.scheduleKey))) {
        const enc=encounters.get(slot.scheduleKey)!;
        const query=`WITH identity AS (SELECT nextval(pg_get_serial_sequence('arm_app.${this.table}','id')) AS id)
          INSERT INTO arm_app.${this.table}(id,document_id,"userId","userName","campusId","campusName","weekLabel","scheduleKey",dia,hora,bloque,available,nota,"encounterDate","createdAt","updatedAt")
          SELECT id,id::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now() FROM identity
          ON CONFLICT("userId","campusId","weekLabel","scheduleKey") DO UPDATE SET
          "userName"=excluded."userName","campusName"=excluded."campusName",dia=excluded.dia,hora=excluded.hora,bloque=excluded.bloque,available=excluded.available,nota=excluded.nota,"encounterDate"=excluded."encounterDate","updatedAt"=now() RETURNING *`;
        results.set(slot.scheduleKey,apiRows(await client.query(query,[userId,userName,dto.campusId,campus.name,dto.weekLabel,slot.scheduleKey,enc.dia,enc.hora,enc.bloque??null,slot.available,slot.nota??null,enc.encounterDate]))[0]);
      }
      return dto.slots.map(s=>results.get(s.scheduleKey));
    });
  }
  async getMyWeek(userId:number,campusId:number,week:string) {
    isoWeekMonday(week);
    return apiRows(await this.db.query(`SELECT * FROM arm_app.${this.table} WHERE "userId"=$1 AND "campusId"=$2 AND "weekLabel"=$3 ORDER BY "encounterDate",id`,[userId,campusId,week]));
  }
  async getMyCommitments(userId:number,campusId:number) {return apiRows(await this.db.query(`SELECT * FROM arm_app.${this.table} WHERE "userId"=$1 AND "campusId"=$2 AND available=true ORDER BY "encounterDate",id`,[userId,campusId]));}
  async getMatrix(campusId:number,week:string) {
    const encounters=await this.getEncounters(campusId,week);
    const rows=apiRows(await this.db.query(`SELECT * FROM arm_app.${this.table} WHERE "campusId"=$1 AND "weekLabel"=$2 ORDER BY "userName",id`,[campusId,week]));
    const people=new Map<number,any>();
    for(const row of rows) {
      if(!people.has(row.userId)) people.set(row.userId,{userId:row.userId,userName:row.userName,slots:Object.create(null)});
      people.get(row.userId).slots[row.scheduleKey]={available:row.available,nota:row.nota??null};
    }
    return {encounters:encounters.map(e=>({...e,encounterDate:e.encounterDate.toISOString()})),[this.matrixKey]:[...people.values()]};
  }
  async getWeeks(campusId:number):Promise<string[]> {return (await this.db.query(`SELECT DISTINCT "weekLabel" FROM arm_app.${this.table} WHERE "campusId"=$1 ORDER BY "weekLabel" DESC`,[campusId])).rows.map(r=>r.weekLabel);}
}
@Injectable()
export class PostgresDisponibilidadService extends PostgresAvailability {
  constructor(db:DatabaseService,campus:PostgresCampusService) {super(db,campus,'disponibilidades','volunteers');}
}
@Injectable()
export class PostgresTecnicosService extends PostgresAvailability {
  constructor(db:DatabaseService,campus:PostgresCampusService) {super(db,campus,'disponibilidades_tecnicos','tecnicos');}
}
