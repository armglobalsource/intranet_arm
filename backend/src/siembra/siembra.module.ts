import { Module } from '@nestjs/common';
import { SiembraController } from './siembra.controller';
import { SiembraService } from './siembra.service';

@Module({
  controllers: [SiembraController],
  providers:   [SiembraService],
  exports:     [SiembraService],
})
export class SiembraModule {}
