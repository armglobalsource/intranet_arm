import { Module } from '@nestjs/common';
import { ContentsService } from './content.service';
import { ContentsController } from './content.controller';

@Module({
  controllers: [ContentsController],
  providers: [ContentsService],
  exports: [ContentsService],
})
export class ContentModule {}
