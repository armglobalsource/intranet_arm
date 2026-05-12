import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

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
  });

  // ── Versionado de API ────────────────────────────────────────
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  // ── Validación global ────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // elimina campos no declarados en el DTO
      forbidNonWhitelisted: true,
      transform: true,          // convierte tipos automáticamente
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
    console.log(`📚 Swagger disponible en: http://localhost:${config.get('PORT', 3001)}/api/docs`);
  }

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`🚀 Backend escuchando en: http://localhost:${port}/api/v1`);
}

bootstrap();
