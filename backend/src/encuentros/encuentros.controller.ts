import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EncuentrosService } from './encuentros.service';
import { CreateEncuentroDto, UpdateEncuentroDto } from './dto/encuentro.dto';

@UseGuards(JwtAuthGuard)
@Controller('encuentros')
export class EncuentrosController {
  constructor(private readonly encuentros: EncuentrosService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:view')
  findAll(
    @Query('campusId') campusId?: string,
    @Query('periodo')  periodo?: any,
  ) {
    return this.encuentros.findAll(campusId, periodo);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:view')
  findOne(@Param('id') id: string) {
    return this.encuentros.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:create')
  create(@Body() dto: CreateEncuentroDto, @CurrentUser() user: any) {
    return this.encuentros.create(dto, { sub: user.sub, email: user.email });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:edit')
  update(@Param('id') id: string, @Body() dto: UpdateEncuentroDto, @CurrentUser() user: any) {
    return this.encuentros.update(id, dto, { sub: user.sub, email: user.email });
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('encuentros:delete')
  remove(@Param('id') id: string) {
    return this.encuentros.remove(id);
  }
}
