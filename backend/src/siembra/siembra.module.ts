import { Module } from '@nestjs/common';
import { TipoCambioModule } from '../tipo-cambio/tipo-cambio.module';
import { ArmCatalogosModule } from '../arm-catalogos/arm-catalogos.module';
import { SiembraController } from './siembra.controller';
import { SiembraService } from './siembra.service';

@Module({
  imports:     [TipoCambioModule, ArmCatalogosModule],
  controllers: [SiembraController],
  providers:   [SiembraService],
  exports:     [SiembraService],
})
export class SiembraModule {}
