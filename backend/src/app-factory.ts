import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { DatabaseService } from './common/database/database.service';
import { assertRuntimeSchema } from './common/database/runtime-schema';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { getAllowedOrigins } from './common/allowed-origins';

function originHost(origin: string): string | null {
  try { return new URL(origin).host; } catch { return null; }
}

/**
 * Crea y configura la aplicación Nest sin escuchar en un puerto.
 * La usan main.ts (servidor local en 3001) y la ruta /api/v1 de Next.js,
 * que sirve la API desde el mismo proyecto Vercel que el frontend.
 */
export async function createNestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  await assertRuntimeSchema(app.get(DatabaseService));

  // ── Archivos estáticos locales (solo desarrollo) ─────────────
  if (config.get('STORAGE', 'local') === 'local') {
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    app.use('/uploads', express.static(uploadsDir));
  }

  // ── Seguridad ────────────────────────────────────────────────
  app.use(helmet());
  // Orígenes permitidos = FRONTEND_URL (CSV) ∪ allowlist fija (incluye la PWA
  // móvil armglobal.web.app) ∪ el propio dominio que atiende la petición, porque
  // el frontend y la API comparten despliegue (incluidas las URLs de Preview).
  const allowedOrigins = getAllowedOrigins(config);
  app.enableCors((req: express.Request, callback) => {
    const origin = req.header('origin');
    const host = req.header('x-forwarded-host') ?? req.header('host');
    // Permitir requests sin origin (ej: Postman, server-to-server)
    const allowed = !origin || allowedOrigins.includes(origin) || (!!host && originHost(origin) === host);
    callback(allowed ? null : new Error(`CORS: origen no permitido — ${origin}`), {
      origin: allowed,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  });

  // ── Filtro global de excepciones ─────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Versionado de API ────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  // ── Validación global ────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Swagger (solo en desarrollo) ─────────────────────────────
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Intranet Corporativa API')
      .setDescription('API del MVP de la Intranet Corporativa')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  return app;
}
