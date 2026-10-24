import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { apiRows, databaseError, SqlConnection } from '../common/database/identity-sql';
import { hasPermission } from '../common/permissions';
import { CreateFichaDto, UpdateFichaDto, UpdateSectionDto, CloneFichaDto, UpdateLayoutVisualDto } from './dto/ficha.dto';
import { ALL_FICHA_SECTIONS, activeSectionsForType, deriveFichaStatus, FICHA_SECTION_LABELS, formatFichaDateLabel, missingRequiredRows, parseFichaDate } from './fichas.utils';
import { defaultRows, defaultRowsOracion, buildDefaultSections, buildDefaultCompletion, migrateMediaData, preservePrayerSections, buildGlobalSectionsFromMixedFicha } from './fichas.defaults';
import { ChangelogEntry, CHANGELOG_MERGE_WINDOW_MS, capRowChanges, diffRows, mergeRowChanges } from './fichas.changelog';
import { applyEncuentros } from './fichas.encuentros';

type Log = (seccion: string | null, entry: ChangelogEntry) => void;

interface FichaUser { sub: number; email: string; campusId?: number | null; permissions?: string[]; }
const jsonFields = new Set('encuentros hiddenSections completionStatus sections sectionLayout layoutVisual splitInto'.split(' '));
const fields = new Set(('campusName type title descripcion ubicacion createdByName status publishedByName lastModifiedByName archivedByName campusId createdBy publishedBy lastModifiedBy archivedBy published archived createdAt publishedAt date lastModifiedAt mediaMigratedAt archivedAt splitFrom '+[...jsonFields].join(' ')).split(' '));
const listing = 'document_id,"campusId","campusName",type,title,date,status,"completionStatus",archived,published,"createdBy","hiddenSections"';
const mobile = 'document_id,"campusId","campusName",type,title,date,encuentros,"publishedAt"';

@Injectable()
export class PostgresFichasService {
  constructor(private db: DatabaseService) {}

  private global(user: FichaUser) { return hasPermission(user.permissions ?? [], 'fichas:viewAll') || hasPermission(user.permissions ?? [], 'fichas:admin'); }
  private access(f: any, u: FichaUser) {
    if (this.global(u) || f.createdBy === u.sub || (u.campusId != null && String(f.campusId) === String(u.campusId)) ||
      (f.published && Object.values(f.sections ?? {}).some((s: any) => s.assignedTo === u.sub))) return;
    throw new ForbiddenException('No tienes acceso a esta ficha');
  }
  private manage(f: any, u: FichaUser) {
    if (this.global(u) || (u.campusId != null && String(f.campusId) === String(u.campusId))) return;
    throw new ForbiddenException('No puedes modificar fichas de otro campus');
  }
  private publisher(f: any, u: FichaUser) {
    if (this.global(u) || f.createdBy === u.sub) return;
    throw new ForbiddenException('Solo el creador o un administrador puede publicar esta ficha');
  }
  private stamp(u: FichaUser) { return { lastModifiedBy: u.sub, lastModifiedByName: u.email, lastModifiedAt: new Date() }; }
  private async read(id: string, db: SqlConnection, lock = false) {
    const row = apiRows(await db.query(`SELECT * FROM arm_app.fichas WHERE document_id=$1${lock ? ' FOR UPDATE' : ''}`, [id]))[0];
    if (!row) throw new NotFoundException('Ficha no encontrada');
    // Normalize legacy sections in memory. Persist only during an authorized write.
    return { ...row, ...migrateMediaData(row) };
  }
  private async save(db: SqlConnection, id: string, data: any, insert = false) {
    const entries = Object.entries(data).filter(([k,v]) => fields.has(k) && v !== undefined);
    const values = entries.map(([k,v]) => jsonFields.has(k) && v != null ? JSON.stringify(v) : v);
    try {
      const result = insert
        ? await db.query(`INSERT INTO arm_app.fichas(document_id,"fichaId",${entries.map(([k])=>`"${k}"`).join(',')}) VALUES ($1,$1,${entries.map((_,i)=>`$${i+2}`).join(',')}) RETURNING *`, [id,...values])
        : await db.query(`UPDATE arm_app.fichas SET ${entries.map(([k],i)=>`"${k}"=$${i+2}`).join(',')} WHERE document_id=$1 RETURNING *`, [id,...values]);
      if (!result.rowCount) throw new NotFoundException('Ficha no encontrada');
      return apiRows(result)[0];
    } catch (error) { databaseError(error); }
  }
  private async change(id: string, u: FichaUser, operation: (f:any, db:SqlConnection, log:Log)=>Promise<void>|void, publish = false) {
    return this.db.transaction(async db => {
      const f = await this.read(id,db,true);
      publish ? this.publisher(f,u) : this.manage(f,u);
      const logs: [string|null, ChangelogEntry][] = [];
      await operation(f,db,(seccion,entry)=>logs.push([seccion,entry]));
      Object.assign(f,this.stamp(u));
      // Same transaction: history and ficha are committed together.
      for (const [seccion,entry] of logs) await this.log(db,id,u,seccion,entry);
      return this.save(db,id,f);
    });
  }
  private async log(db: SqlConnection, id: string, u: FichaUser, seccion: string|null, entry: ChangelogEntry) {
    if (entry.kind==='rows') {
      if (!entry.changes.length) return;
      const last=(await db.query('SELECT document_id,cambios,timestamp FROM arm_app.ficha_changelog WHERE ficha_document_id=$1 AND seccion IS NOT DISTINCT FROM $2 AND "userId"=$3 ORDER BY timestamp DESC,document_id DESC LIMIT 1',[id,seccion,u.sub])).rows[0];
      if (last?.cambios?.kind==='rows' && Date.now()-new Date(last.timestamp).getTime()<CHANGELOG_MERGE_WINDOW_MS) {
        const merged=capRowChanges(mergeRowChanges(last.cambios.changes??[],entry.changes));
        if (!merged.changes.length) await db.query('DELETE FROM arm_app.ficha_changelog WHERE document_id=$1',[last.document_id]);
        else await db.query('UPDATE arm_app.ficha_changelog SET cambios=$2,timestamp=now() WHERE document_id=$1',[last.document_id,JSON.stringify(merged)]);
        return;
      }
      entry=capRowChanges(entry.changes);
    }
    await db.query('INSERT INTO arm_app.ficha_changelog(document_id,ficha_document_id,"userId","userName",timestamp,seccion,cambios) VALUES ($1,$2,$3,$4,now(),$5,$6)',[randomUUID(),id,u.sub,u.email,seccion,JSON.stringify(entry)]);
  }
  async findAll(u: FichaUser, campusId?: string, status?: string) {
    const campus = this.global(u) ? campusId : String(u.campusId ?? '__none__');
    return apiRows(await this.db.query(`SELECT ${listing} FROM arm_app.fichas WHERE ($1::text IS NULL OR "campusId"::text=$1) AND ($2::text IS NULL OR status=$2) ORDER BY date DESC NULLS LAST,document_id`, [campus || null,status || null]));
  }
  async findMine(userId: number, isAdmin: boolean) {
    return apiRows(await this.db.query(`SELECT * FROM arm_app.fichas f WHERE archived IS DISTINCT FROM true AND ($2 OR "createdBy"=$1 OR (published AND EXISTS (SELECT 1 FROM jsonb_each(coalesce(f.sections,'{}')) s WHERE s.value->>'assignedTo'=$1::text))) ORDER BY date DESC NULLS LAST,document_id`, [userId,isAdmin]));
  }
  async findPublishedForMobile(u: FichaUser) {
    if (u.campusId == null) throw new BadRequestException('Tu cuenta no tiene un campus asignado');
    return apiRows(await this.db.query(`SELECT ${mobile} FROM arm_app.fichas WHERE "campusId"=$1 AND published AND archived IS DISTINCT FROM true ORDER BY date,document_id`, [u.campusId]));
  }
  /**
   * Fichas publicadas de una semana (lunes a domingo, hora de Santiago). Sin
   * `start` usa la semana actual. Es público: solo expone estado y fecha de
   * actualización, nunca quién la hizo.
   */
  async findPublicWeek(start?: string) {
    if (start !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new BadRequestException('Fecha de inicio inválida');
    return apiRows(await this.db.query(`WITH w AS (SELECT date_trunc('week',coalesce($1::date::timestamp,now() AT TIME ZONE 'America/Santiago')) AS s)
      SELECT ${mobile},status,"lastModifiedAt" FROM arm_app.fichas,w WHERE published AND archived IS DISTINCT FROM true
      AND date >= (w.s AT TIME ZONE 'America/Santiago') AND date < ((w.s+interval '7 days') AT TIME ZONE 'America/Santiago')
      ORDER BY date,document_id`,[start ?? null]));
  }
  findOne(id: string) { return this.read(id,this.db); }
  async findOneForUser(id: string, u: FichaUser) { const f=await this.findOne(id);this.access(f,u);return f; }
  async findPublic(id: string) {
    const f=await this.findOne(id);
    if (!f.published || f.archived) throw new ForbiddenException('Esta ficha no está publicada');
    for (const k of ['createdBy','createdByName','lastModifiedBy','lastModifiedByName','archivedBy','archivedByName','publishedBy','publishedByName']) delete f[k];
    for (const section of Object.values(f.sections ?? {}) as any[]) {
      delete section.assignedTo; delete section.completedBy; delete section.revision;
    }
    if(f.layoutVisual) delete f.layoutVisual.updatedBy;
    const paletteIds = [...new Set((f.sections?.outfit?.rows ?? []).flatMap((r:any)=>Object.values(r.values ?? {})).filter((v:any)=>typeof v==='string' && v.trim()))];
    const songs=[...(f.layoutVisual?.songs ?? []),...(f.layoutVisual?.slots ?? []).flatMap((s:any)=>s.songs ?? [])];
    const refIds=[...new Set(songs.flatMap((s:any)=>s.referenceIds ?? []).filter((v:any)=>Number.isSafeInteger(v)))];
    const paletas=apiRows(await this.db.query('SELECT id,name,colors,"order" FROM arm_app.paletas WHERE id=ANY($1::text[])',[paletteIds]));
    const visualRefs=apiRows(await this.db.query('SELECT id,name,tags,"imageUrl" FROM arm_app.visual_references WHERE id=ANY($1::bigint[])',[refIds]));
    f.publicMeta={paletas,visualRefs};return f;
  }
  async create(dto: CreateFichaDto, u: FichaUser) {
    this.manage({campusId:dto.campusId},u);
    if(dto.type==='oracion' && dto.encuentros.length!==1) throw new BadRequestException('La ficha de oración requiere un solo horario');
    const id=randomUUID();
    return this.save(this.db,id,{...dto,date:parseFichaDate(dto.date),sections:buildDefaultSections(dto.type),completionStatus:buildDefaultCompletion(dto.type),hiddenSections:[],status:'draft',published:false,archived:false,createdBy:u.sub,createdByName:u.email,createdAt:new Date(),...this.stamp(u)},true);
  }
  update(id: string, dto: UpdateFichaDto, u: FichaUser) {
    return this.change(id,u,(f,_db,log)=>{
      if(dto.title!==undefined && dto.title!==f.title) { log(null,{kind:'title',before:f.title??'',after:dto.title}); f.title=dto.title; }
      if(dto.date!==undefined) {
        const date=parseFichaDate(dto.date), before=f.date?new Date(f.date).toISOString().slice(0,10):null, after=date.toISOString().slice(0,10);
        if(before!==after) log(null,{kind:'date',before,after});
        f.date=date;
      }
      if(dto.sectionLayout!==undefined) {
        if(JSON.stringify(dto.sectionLayout)!==JSON.stringify(f.sectionLayout??null)) log(null,{kind:'layout'});
        f.sectionLayout=JSON.parse(JSON.stringify(dto.sectionLayout));
      }
      if(dto.encuentros!==undefined) {
        const {change,touched}=applyEncuentros(f,JSON.parse(JSON.stringify(dto.encuentros)));
        if(change) log(null,change);
        // Las filas cambiaron por fuera del editor de la sección: su revisión sube para que un guardado viejo no las pise.
        for(const name of touched) f.sections[name].revision=Number(f.sections[name].revision??0)+1;
        f.status=deriveFichaStatus(f.type,f.completionStatus??{},f.hiddenSections??[]);
      }
      if(dto.hiddenSections!==undefined) {
        const was=new Set<string>(f.hiddenSections??[]), now=new Set(dto.hiddenSections);
        const shown=[...was].filter(s=>!now.has(s)), hidden=[...now].filter(s=>!was.has(s));
        if(shown.length||hidden.length) log(null,{kind:'modules',shown,hidden});
        for(const name of (f.hiddenSections ?? []).filter((s:string)=>!dto.hiddenSections!.includes(s))) {
          const old=f.sections?.[name];
          if(!old?.rows?.length) {
            f.sections ??= {}; f.completionStatus ??= {};
            f.sections[name]={revision:0,assignedTo:old?.assignedTo??null,assignedName:old?.assignedName??null,isCompleted:false,completedBy:null,completedAt:null,rows:(f.type==='oracion'?defaultRowsOracion:defaultRows)(name)};
            f.completionStatus[name]=false;
          }
        }
        f.hiddenSections=dto.hiddenSections;
        f.status=deriveFichaStatus(f.type,f.completionStatus??{},f.hiddenSections);
      }
    });
  }
  async remove(id: string, u: FichaUser) {
    return this.db.transaction(async db=>{
      const f=await this.read(id,db,true);this.manage(f,u);
      await db.query('DELETE FROM arm_app.ficha_changelog WHERE ficha_document_id=$1',[id]);
      await db.query('DELETE FROM arm_app.fichas WHERE document_id=$1',[id]);return {fichaId:id};
    });
  }
  async clone(id: string, u: FichaUser, dto: CloneFichaDto={}) {
    const f=await this.findOneForUser(id,u);this.manage(f,u);
    if(f.type==='oracion' && f.encuentros?.length>1) throw new BadRequestException('Separa primero los encuentros de esta ficha');
    for(const s of Object.values(f.sections ?? {}) as any[]) {
      Object.assign(s,{revision:0,isCompleted:false,completedBy:null,completedAt:null,rows:(s.rows??[]).map((r:any)=>({...r,values:{}}))});
      if(!dto.keepAssignees) Object.assign(s,{assignedTo:null,assignedName:null});
    }
    const newId=randomUUID();
    return this.save(this.db,newId,{...f,title:dto.title??(dto.date?`${f.title.replace(/\s*\(copia\).*$/,'').trim()} — ${formatFichaDateLabel(dto.date)}`:`${f.title} (copia)`),date:dto.date?parseFichaDate(dto.date):f.date,completionStatus:buildDefaultCompletion(f.type),status:'draft',published:false,publishedAt:null,publishedBy:null,publishedByName:null,archived:false,archivedAt:null,archivedBy:null,archivedByName:null,splitFrom:null,splitInto:null,createdBy:u.sub,createdByName:u.email,createdAt:new Date(),...this.stamp(u)},true);
  }
  async splitPrayerAndGlobal(id: string, u: FichaUser) {
    if(!this.global(u) && !hasPermission(u.permissions??[],'fichas:create')) throw new ForbiddenException('Necesitas permiso para crear la ficha separada');
    return this.db.transaction(async db=>{
      const f=await this.read(id,db,true);this.manage(f,u);
      if(f.type!=='oracion' || f.encuentros?.length!==2 || f.archived) throw new BadRequestException('Se requiere una ficha de oración no archivada con dos encuentros');
      let i=f.encuentros.findIndex((e:any)=>/oraci[oó]n/i.test(e.label??'') && !/global/i.test(e.label??''));if(i<0)i=0;
      const prayer=f.encuentros[i],global=f.encuentros[1-i],newId=randomUUID();
      const reset={status:'draft',published:false,publishedAt:null,publishedBy:null,publishedByName:null,...this.stamp(u)};
      const globalFicha=await this.save(db,newId,{campusId:f.campusId,campusName:f.campusName,type:'unico',title:String(global.label||'Miércoles Global').replace(/\s*[·|-]\s*\d{1,2}:\d{2}.*$/i,''),date:f.date,encuentros:[{...global,id:'unico'}],sections:buildGlobalSectionsFromMixedFicha(f.sections??{},global.id),completionStatus:buildDefaultCompletion('unico'),hiddenSections:[],archived:false,splitFrom:id,createdBy:u.sub,createdByName:u.email,createdAt:new Date(),...reset},true);
      const prayerFicha=await this.save(db,id,{...f,...reset,title:'Encuentro de Oración',encuentros:[{...prayer,id:'unico'}],sections:preservePrayerSections(f.sections??{},prayer.id),completionStatus:buildDefaultCompletion('oracion'),splitInto:[newId]});
      return {prayerFicha,globalFicha};
    });
  }
  updateLayoutVisual(id: string, dto: UpdateLayoutVisualDto, u: FichaUser) {
    return this.change(id,u,(f,_db,log)=>{
      log(null,{kind:'layoutVisual'});
      const input=dto.slots?.length ? dto.slots : [{id:'default',label:'',encuentroIds:[],songs:dto.songs??[],producerNotes:dto.producerNotes??''}];
      const slots=input.map(s=>({id:s.id,label:s.label??'',encuentroIds:s.encuentroIds??[],producerNotes:s.producerNotes??'',songs:(s.songs??[]).map(song=>({songRowId:song.songRowId,iluminacion:song.iluminacion??'',illuminationColors:song.illuminationColors??[],visualDescription:song.visualDescription??'',referenceIds:song.referenceIds??[]}))}));
      f.layoutVisual={slots,updatedAt:new Date().toISOString(),updatedBy:u.sub};
    });
  }
  async updateSection(id: string, name: string, dto: UpdateSectionDto, u: FichaUser) {
    if(!ALL_FICHA_SECTIONS.includes(name as any)) throw new NotFoundException('Sección no encontrada');
    const {expectedRevision,...sectionDto}=JSON.parse(JSON.stringify(dto));
    // Row lock serializes modifications; history is committed with the section.
    return this.change(id,u,async(f,db,log)=>{
      const s=f.sections?.[name];if(!s) throw new NotFoundException('Sección no activa');
      const revision=Number(s.revision??0);
      if(expectedRevision!==undefined && Number(expectedRevision)!==revision) throw new ConflictException('La sección cambió. Recarga la ficha antes de continuar.');
      const changed=Array.isArray(sectionDto.rows);
      if(changed) {
        const incoming=new Map(sectionDto.rows.map((r:any)=>[r.id,r]));
        if(incoming.size!==sectionDto.rows.length) throw new BadRequestException('La sección contiene filas duplicadas');
        if((s.rows??[]).some((r:any)=>r.required && (incoming.get(r.id) as any)?.required!==true)) throw new BadRequestException('No puedes eliminar ni volver opcional una fila obligatoria');
      }
      if(changed) log(name,{kind:'rows',changes:diffRows(s.rows??[],sectionDto.rows,f.encuentros??[])});
      if('assignedTo' in sectionDto && sectionDto.assignedTo!==s.assignedTo) log(name,{kind:'assign',before:s.assignedName??null,after:sectionDto.assignedName??null});
      f.sections[name]={...s,...sectionDto,revision:revision+1,...(changed?{isCompleted:false,completedBy:null,completedAt:null}:{})};
      if(changed) {
        f.completionStatus={...(f.completionStatus??{}),[name]:false};
        f.status=deriveFichaStatus(f.type,f.completionStatus,f.hiddenSections??[]);
      }
      if(sectionDto.assignedTo && sectionDto.assignedTo!==s.assignedTo && sectionDto.assignedTo!==u.sub) {
        // Same transaction: a failed notification cannot leave an unaudited section.
        await db.query(`WITH seq AS (SELECT nextval(pg_get_serial_sequence('arm_app.notifications','id')) AS id) INSERT INTO arm_app.notifications(id,document_id,"userId",title,body,link,channel,read,"createdAt") SELECT id,id::text,$1,$2,$3,$4,'in_app',false,now() FROM seq`,[sectionDto.assignedTo,'Te asignaron una sección',`Quedaste como responsable de "${FICHA_SECTION_LABELS[name as keyof typeof FICHA_SECTION_LABELS]??name}" en la ficha "${f.title}".`,`/dashboard/fichas-tecnicas/${id}`]);
      }
    });
  }
  completeSection(id: string, name: string, u: FichaUser) { return this.completion(id,name,u,true); }
  reopenSection(id: string, name: string, u: FichaUser) { return this.completion(id,name,u,false); }
  private completion(id: string, name: string, u: FichaUser, complete: boolean) {
    return this.change(id,u,(f,_db,log)=>{
      const s=f.sections?.[name];
      if(!activeSectionsForType(f.type).includes(name as any) || !s) throw new NotFoundException('Sección no activa');
      log(name,{kind:complete?'complete':'reopen'});
      if(complete) {
        const missing=missingRequiredRows(s.rows??[],(f.encuentros??[]).map((e:any)=>e.id));
        if(missing.length) throw new BadRequestException(`Completa los campos obligatorios: ${missing.join(', ')}`);
      }
      Object.assign(s,{revision:Number(s.revision??0)+1,isCompleted:complete,completedBy:complete?u.sub:null,completedAt:complete?new Date().toISOString():null});
      f.completionStatus={...(f.completionStatus??{}),[name]:complete};
      f.status=deriveFichaStatus(f.type,f.completionStatus,f.hiddenSections??[]);
    });
  }
  archive(id: string, u: FichaUser) {return this.change(id,u,(f,_db,log)=>{log(null,{kind:'archive'});Object.assign(f,{archived:true,archivedBy:u.sub,archivedByName:u.email,archivedAt:new Date(),published:false,publishedBy:null,publishedByName:null,publishedAt:null});});}
  unarchive(id: string, u: FichaUser) {return this.change(id,u,(f,_db,log)=>{log(null,{kind:'unarchive'});Object.assign(f,{archived:false,archivedBy:null,archivedByName:null,archivedAt:null});});}
  publish(id: string, u: FichaUser) {return this.change(id,u,(f,_db,log)=>{if(f.archived)throw new BadRequestException('Desarchiva la ficha antes de publicarla');log(null,{kind:'publish'});Object.assign(f,{published:true,publishedBy:u.sub,publishedByName:u.email,publishedAt:new Date()});},true);}
  unpublish(id: string, u: FichaUser) {return this.change(id,u,(f,_db,log)=>{log(null,{kind:'unpublish'});Object.assign(f,{published:false,publishedBy:null,publishedByName:null,publishedAt:null});},true);}
  async getChangelog(id: string, u: FichaUser) {
    await this.findOneForUser(id,u);
    return apiRows(await this.db.query(`SELECT c.document_id,c.ficha_document_id,c."userId",c.seccion,c.cambios,c.timestamp,
      coalesce(nullif(btrim(concat_ws(' ',u."firstName",u."lastName")),''),c."userName") AS "userName"
      FROM arm_app.ficha_changelog c LEFT JOIN arm_app.users u ON u.id=c."userId"
      WHERE c.ficha_document_id=$1 ORDER BY c.timestamp DESC,c.document_id LIMIT 100`,[id]));
  }
}
