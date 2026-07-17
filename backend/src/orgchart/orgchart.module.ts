import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { JobTitlesModule } from '../job-titles/job-titles.module';
import { OrgChartService } from './orgchart.service';
import { OrgChartController } from './orgchart.controller';

@Module({
  imports: [UsersModule, JobTitlesModule],
  controllers: [OrgChartController],
  providers: [OrgChartService],
  exports: [OrgChartService],
})
export class OrgChartModule {}
