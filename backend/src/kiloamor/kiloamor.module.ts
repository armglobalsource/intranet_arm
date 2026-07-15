import { Module } from '@nestjs/common';
import { CampusModule } from '../campus/campus.module';
import { KiloamorController } from './kiloamor.controller';
import { KiloamorService } from './kiloamor.service';

@Module({
  imports:     [CampusModule],
  controllers: [KiloamorController],
  providers:   [KiloamorService],
  exports:     [KiloamorService],
})
export class KiloamorModule {}
