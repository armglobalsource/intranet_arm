import { Module } from '@nestjs/common';
import { ArmCatalogosModule } from '../arm-catalogos/arm-catalogos.module';
import { TipoCambioController } from './tipo-cambio.controller';
import { TipoCambioService } from './tipo-cambio.service';

@Module({
  imports:     [ArmCatalogosModule],
  controllers: [TipoCambioController],
  providers:   [TipoCambioService],
  exports:     [TipoCambioService],
})
export class TipoCambioModule {}
