import { Module } from '@nestjs/common';
import { KiloamorController } from './kiloamor.controller';
import { KiloamorService } from './kiloamor.service';

@Module({
  controllers: [KiloamorController],
  providers:   [KiloamorService],
  exports:     [KiloamorService],
})
export class KiloamorModule {}
