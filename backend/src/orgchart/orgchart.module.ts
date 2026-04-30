import { Module } from '@nestjs/common';
import { OrgChartService } from './orgchart.service';
import { OrgChartController } from './orgchart.controller';

@Module({
  controllers: [OrgChartController],
  providers: [OrgChartService],
  exports: [OrgChartService],
})
export class OrgChartModule {}
