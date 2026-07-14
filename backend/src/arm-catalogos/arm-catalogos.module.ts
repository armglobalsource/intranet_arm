import { Module } from '@nestjs/common';
import { ArmCatalogosController } from './arm-catalogos.controller';
import { ArmCatalogosService } from './arm-catalogos.service';

@Module({
  controllers: [ArmCatalogosController],
  providers:   [ArmCatalogosService],
  exports:     [ArmCatalogosService],
})
export class ArmCatalogosModule {}
