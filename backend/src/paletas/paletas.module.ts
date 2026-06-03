import { Module } from '@nestjs/common';
import { PaletasController } from './paletas.controller';
import { PaletasService } from './paletas.service';

@Module({
  controllers: [PaletasController],
  providers:   [PaletasService],
  exports:     [PaletasService],
})
export class PaletasModule {}
