import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { KiloamorService } from './kiloamor.service';
import { CreateKiloamorDto, UpdateKiloamorDto } from './dto/kiloamor.dto';

@UseGuards(JwtAuthGuard)
@Controller('kiloamor')
export class KiloamorController {
  constructor(private readonly kiloamor: KiloamorService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('kiloamor:view')
  findAll(@Query('campusId') campusId?: string, @Query('periodo') periodo?: any) {
    return this.kiloamor.findAll(campusId, periodo);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('kiloamor:view')
  findOne(@Param('id') id: string) {
    return this.kiloamor.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('kiloamor:create')
  create(@Body() dto: CreateKiloamorDto, @CurrentUser() user: any) {
    return this.kiloamor.create(dto, { sub: user.sub, email: user.email });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('kiloamor:edit')
  update(@Param('id') id: string, @Body() dto: UpdateKiloamorDto, @CurrentUser() user: any) {
    return this.kiloamor.update(id, dto, { sub: user.sub, email: user.email });
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('kiloamor:delete')
  remove(@Param('id') id: string) {
    return this.kiloamor.remove(id);
  }
}
