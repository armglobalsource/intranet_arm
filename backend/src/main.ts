import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // ── Archivos estáticos locales (solo desarrollo) ─────────────
  if (config.get('STORAGE', 'local') === 'local') {
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    app.use('/uploads', express.static(uploadsDir));
  }

  // ── Seguridad ────────────────────────────────────────────────
  app.use(helmet());
  // FRONTEND_URL puede ser una lista separada por comas (ej: prod,dev)
  const allowedOrigins = (config.get<string>('FRONTEND_URL', 'http://localhost:3000'))
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
    .concat([
      'http://localhost:3000',
      'http://localhost:3002',
      'https://intranet-arm.web.app',
      'https://intranet-arm-dev.web.app',
    ]);
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (ej: Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origen no permitido — ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
    console.log(`Swagger disponible en: http://localhost:${config.get('PORT', 3001)}/api/docs`);
  }

  // ── Graceful shutdown (Cloud Run envía SIGTERM) ───────────────
  app.enableShutdownHooks();

  // Cloud Run inyecta PORT dinámicamente (ej: 8080). Localmente cae a 3001.
  const port = parseInt(process.env.PORT ?? '') || config.get<number>('PORT', 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`Backend escuchando en puerto ${port}`);

  // Cloud Run da 10s tras SIGTERM; cerramos conexiones limpiamente
  process.on('SIGTERM', async () => {
    console.log('SIGTERM recibido — cerrando servidor...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();

