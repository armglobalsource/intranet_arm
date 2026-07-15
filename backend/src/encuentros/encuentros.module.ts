import { Module } from '@nestjs/common';
import { CampusModule } from '../campus/campus.module';
import { EncuentrosController } from './encuentros.controller';
import { EncuentrosService } from './encuentros.service';

@Module({
  imports:     [CampusModule],
  controllers: [EncuentrosController],
  providers:   [EncuentrosService],
  exports:     [EncuentrosService],
})
export class EncuentrosModule {}
