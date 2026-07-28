import { Module } from '@nestjs/common';
import { JobTitlesModule } from '../job-titles/job-titles.module';
import { OrgChartService } from './orgchart.service';
import { OrgChartController } from './orgchart.controller';

@Module({
  imports: [JobTitlesModule],
  controllers: [OrgChartController],
  providers: [OrgChartService],
  exports: [OrgChartService],
})
export class OrgChartModule {}
