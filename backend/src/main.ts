import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // ── Seguridad ────────────────────────────────────────────────
  app.use(helmet());
  const allowedOrigins = (config.get<string>('FRONTEND_URL', 'http://localhost:3000'))
    .split(',')
    .map((o) => o.trim())
    .concat(['http://localhost:3002']);
  app.enableCors({
    origin: allowedOrigins,
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

  const port = config.get<number>('PORT', 3001);
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
