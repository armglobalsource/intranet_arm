import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../common/database/database.service';
import { apiRows,insertIdentity,updateIdentity,deleteIdentity } from '../common/database/identity-sql';
import { StorageService } from '../common/storage/storage.service';
import { CreateVisualReferenceDto,UpdateVisualReferenceDto } from './dto/visual-reference.dto';
const tags=(raw?:string)=>[...new Set((raw??'').split(',').map(t=>t.trim().toLowerCase()).filter(Boolean).slice(0,20))];
@Injectable()
export class PostgresVisualReferencesService {
 constructor(private db:DatabaseService,private storage:StorageService){}
 async findAll(search?:string){return apiRows(await this.db.query(`SELECT * FROM arm_app.visual_references WHERE $1='' OR strpos(lower(name),$1)>0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(tags,'[]')) t WHERE strpos(lower(t),$1)>0) ORDER BY "uploadedAt" DESC,id DESC`,[(search??'').trim().toLowerCase()]));}
 async findOne(id:number){const row=apiRows(await this.db.query('SELECT * FROM arm_app.visual_references WHERE id=$1',[id]))[0];if(!row)throw new NotFoundException('Referencia visual no encontrada');return row;}
 async create(dto:CreateVisualReferenceDto,file:Express.Multer.File,userId:number,userName?:string){
  if(!file)throw new BadRequestException('Falta el archivo de imagen');
  const formats:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
  if(!formats[file.mimetype])throw new BadRequestException('Formato de imagen no permitido');
  const storageKey=`visual-references/${randomUUID()}.${formats[file.mimetype]}`;
  const imageUrl=await this.storage.uploadPublic(storageKey,file.buffer,file.mimetype);
  return insertIdentity(this.db,'visual_references',{name:dto.name.trim(),tags:tags(dto.tags),imageUrl,storageKey,uploadedBy:userId,uploadedByName:userName??null,uploadedAt:new Date(),usageCount:0,isActive:true});
 }
 update(id:number,dto:UpdateVisualReferenceDto){const data:any={};if(dto.name!==undefined)data.name=dto.name.trim();if(dto.tags!==undefined)data.tags=tags(dto.tags);if(dto.isActive!==undefined)data.isActive=dto.isActive;return Object.keys(data).length?updateIdentity(this.db,'visual_references',id,data):this.findOne(id);}
 // Original and migrated fichas share file URLs. Retain the object when deleting
 // a catalog entry; file garbage collection must verify references separately.
 remove(id:number){return deleteIdentity(this.db,'visual_references',id);}
 async incrementUsage(id:number){await this.db.query('UPDATE arm_app.visual_references SET "usageCount"=coalesce("usageCount",0)+1 WHERE id=$1',[id]);}
}
