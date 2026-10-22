import { Injectable,Logger } from '@nestjs/common';
import { DatabaseService } from '../common/database/database.service';
@Injectable()
export class PostgresJobsService {
 private logger=new Logger(PostgresJobsService.name);
 constructor(private db:DatabaseService){}
 async cleanupExpiredTokens(){return this.db.transaction(async db=>{
  const revoked=await db.query('DELETE FROM arm_app.revoked_tokens WHERE jti IN (SELECT jti FROM arm_app.revoked_tokens WHERE "expiresAt"<now() ORDER BY "expiresAt" LIMIT 100 FOR UPDATE SKIP LOCKED)');
  const refreshed=await db.query('DELETE FROM arm_app.refresh_tokens WHERE id IN (SELECT id FROM arm_app.refresh_tokens WHERE "expiresAt"<now() ORDER BY "expiresAt" LIMIT 100 FOR UPDATE SKIP LOCKED)');
  return {revoked:revoked.rowCount,refreshed:refreshed.rowCount};
 });}
 // These hooks were placeholders in the original backend; do not imply delivery.
 async queueEmail(_payload:{to:string;subject:string;html:string}){this.logger.warn('Entrega de correo en segundo plano no configurada');}
 async queueFileProcessing(_payload:{documentId:number;minioKey:string}){this.logger.warn('Procesamiento de documentos en segundo plano no configurado');}
 async queueSearchIndexing(_payload:{type:'content'|'document';id:number}){ /* Search reads PostgreSQL directly. */ }
}
