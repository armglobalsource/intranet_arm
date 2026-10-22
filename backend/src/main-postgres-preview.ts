import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { PostgresIdentityModule } from './postgres-identity.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { DatabaseService } from './common/database/database.service';
import { getAllowedOrigins } from './common/allowed-origins';

async function bootstrap() {
  // Migration preview must never replace the production application accidentally.
  if(process.env.NODE_ENV==='production') throw new Error('PostgreSQL identity preview is local only');
  const app=await NestFactory.create(PostgresIdentityModule);
  const config=app.get(ConfigService);
  if(config.get('NODE_ENV')==='production') {await app.close();throw new Error('PostgreSQL identity preview is local only');}
  await app.get(DatabaseService).ping();
  app.use(helmet());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableVersioning({type:VersioningType.URI,defaultVersion:'1'});
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true,transformOptions:{enableImplicitConversion:true}}));
  app.enableCors({origin:getAllowedOrigins(config),credentials:true});
  app.enableShutdownHooks();
  await app.listen(Number(config.get('POSTGRES_PREVIEW_PORT',3002)),'127.0.0.1');
}
bootstrap().catch(()=>{console.error('No se pudo iniciar la API local PostgreSQL. Verifica configuración y esquema.');process.exitCode=1;});
