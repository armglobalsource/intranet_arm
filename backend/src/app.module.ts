import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { FirebaseModule } from './common/firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ContentModule } from './content/content.module';
import { DocumentsModule } from './documents/documents.module';
import { OrgChartModule } from './orgchart/orgchart.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './health/health.module';
import { StorageModule } from './common/storage/storage.module';
import { JobTitlesModule } from './job-titles/job-titles.module';
import { CampusModule } from './campus/campus.module';
import { RolesModule } from './roles/roles.module';
import { FichasModule } from './fichas/fichas.module';
import { CancionesModule } from './canciones/canciones.module';
import { EventsModule } from './events/events.module';
import { DisponibilidadModule } from './disponibilidad/disponibilidad.module';
import { FeedbackModule } from './feedback/feedback.module';
import { OnboardingModule } from './onboarding/onboarding.module';

const envSchema = Joi.object({
  NODE_ENV:             Joi.string().valid('development', 'production', 'test').default('development'),
  PORT:                 Joi.number().default(3001),
  FIREBASE_PROJECT_ID:  Joi.string().default('intranet-arm'),
  FIREBASE_KEY_FILE:    Joi.string().default('./service-account.json'),
  JWT_SECRET:           Joi.string().min(32).required(),
  JWT_ACCESS_TTL:       Joi.number().default(900),
  JWT_REFRESH_TTL:      Joi.number().default(28800),
  FRONTEND_URL:         Joi.string().default('http://localhost:3000'),
  GCS_PROJECT_ID:       Joi.string().optional(),
  STORAGE:              Joi.string().valid('local', 'gcs').default('local'),
  BACKEND_URL:          Joi.string().default('http://localhost:3001'),
  GCS_BUCKET_DOCUMENTS: Joi.string().default('intranet-documents'),
  GCS_BUCKET_AVATARS:   Joi.string().default('intranet-avatars'),
  THROTTLE_TTL:         Joi.number().default(60000),
  THROTTLE_LIMIT:       Joi.number().default(100),
}).unknown(true);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRoot([{
      ttl:   parseInt(process.env.THROTTLE_TTL   || '60000'),
      limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
    }]),
    FirebaseModule,
    StorageModule,
    AuthModule,
    UsersModule,
    ContentModule,
    DocumentsModule,
    OrgChartModule,
    NotificationsModule,
    SearchModule,
    JobsModule,
    HealthModule,
    JobTitlesModule,
    CampusModule,
    RolesModule,
    FichasModule,
    CancionesModule,
    EventsModule,
    DisponibilidadModule,
    FeedbackModule,
    OnboardingModule,
  ],
})
export class AppModule {}
