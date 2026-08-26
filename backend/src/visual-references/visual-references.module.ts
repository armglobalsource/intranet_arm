import { Module } from '@nestjs/common';
import { VisualReferencesController } from './visual-references.controller';
import { VisualReferencesService } from './visual-references.service';

@Module({
  controllers: [VisualReferencesController],
  providers:   [VisualReferencesService],
  exports:     [VisualReferencesService], // exponer para que fichas lo use en la Fase 2
})
export class VisualReferencesModule {}
