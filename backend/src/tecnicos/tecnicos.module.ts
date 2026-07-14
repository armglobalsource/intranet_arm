import { Module } from '@nestjs/common';
import { CampusModule } from '../campus/campus.module';
import { TecnicosController } from './tecnicos.controller';
import { TecnicosService } from './tecnicos.service';

@Module({
  imports:     [CampusModule],
  controllers: [TecnicosController],
  providers:   [TecnicosService],
  exports:     [TecnicosService],
})
export class TecnicosModule {}
