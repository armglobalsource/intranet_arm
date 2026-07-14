import { Module } from '@nestjs/common';
import { EncuentrosController } from './encuentros.controller';
import { EncuentrosService } from './encuentros.service';

@Module({
  controllers: [EncuentrosController],
  providers:   [EncuentrosService],
  exports:     [EncuentrosService],
})
export class EncuentrosModule {}
