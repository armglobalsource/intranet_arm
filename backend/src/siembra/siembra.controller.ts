import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SiembraService } from './siembra.service';
import { CreateSiembraDto, UpdateSiembraDto } from './dto/siembra.dto';

@UseGuards(JwtAuthGuard)
@Controller('siembra')
export class SiembraController {
  constructor(private readonly siembra: SiembraService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('siembra:view')
  findAll(@Query('campusId') campusId?: string, @Query('periodo') periodo?: any) {
    return this.siembra.findAll(campusId, periodo);
  }

  @Get('mine')
  @UseGuards(PermissionsGuard)
  @RequirePermission('siembra:create')
  findMine(@CurrentUser() user: any) {
    return this.siembra.findMine(user.sub);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('siembra:view')
  findOne(@Param('id') id: string) {
    return this.siembra.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('siembra:create')
  create(@Body() dto: CreateSiembraDto, @CurrentUser() user: any) {
    return this.siembra.create(dto, { sub: user.sub, email: user.email });
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('siembra:edit')
  update(@Param('id') id: string, @Body() dto: UpdateSiembraDto, @CurrentUser() user: any) {
    return this.siembra.update(id, dto, { sub: user.sub, email: user.email });
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('siembra:delete')
  remove(@Param('id') id: string) {
    return this.siembra.remove(id);
  }
}
