import {
  Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe,
  UseInterceptors, UploadedFile, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { PostgresFeedbackService } from './postgres-feedback.service';
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './dto/feedback.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Feedback')
@ApiBearerAuth()
@Controller({ path: 'feedback', version: '1' })
export class FeedbackController {
  constructor(private readonly service: PostgresFeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Enviar reporte o sugerencia' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('screenshot', { limits: { fileSize: 5 * 1024 * 1024 } }))
  create(
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() user: any,
    @UploadedFile() screenshot?: Express.Multer.File,
  ) {
    const userName  = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
    return this.service.create(
      dto,
      user.sub,
      userName,
      user.email,
      screenshot?.buffer,
      screenshot?.mimetype,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar todo el feedback (admin)' })
  findAll(@CurrentUser() user: any) {
    if (user.role !== 'admin') throw new ForbiddenException();
    return this.service.findAll();
  }

  @Get('mine')
  @ApiOperation({ summary: 'Listar reportes y sugerencias del usuario autenticado' })
  findMine(@CurrentUser() user: any) {
    return this.service.findMine(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener feedback por ID (admin)' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    if (user.role !== 'admin') throw new ForbiddenException();
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Actualizar estado del feedback (admin)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFeedbackStatusDto,
    @CurrentUser() user: any,
  ) {
    if (user.role !== 'admin') throw new ForbiddenException();
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
    return this.service.updateStatus(id, dto, user.sub, name);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar feedback (admin)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    if (user.role !== 'admin') throw new ForbiddenException();
    return this.service.remove(id);
  }
}
