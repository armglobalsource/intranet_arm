import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{
      ttl:   parseInt(process.env.THROTTLE_TTL  || '60000'),
      limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
    }]),
    PrismaModule,
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
  ],
})
export class AppModule {}
