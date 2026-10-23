import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AllowPending } from '../common/decorators/allow-pending.decorator';
import { PostgresCampusService } from './postgres-campus.service';
import { CreateCampusDto, UpdateCampusDto } from './dto/campus.dto';

@UseGuards(JwtAuthGuard)
@Controller('campus')
export class CampusController {
  constructor(private readonly campusService: PostgresCampusService) {}

  @Get()
  findAll() { return this.campusService.findAll(); }

  @AllowPending()
  @Get('active')
  findActive() { return this.campusService.findActive(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.campusService.findOne(id); }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('campus:manage')
  create(@Body() dto: CreateCampusDto) { return this.campusService.create(dto); }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('campus:manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampusDto) {
    return this.campusService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('campus:manage')
  remove(@Param('id', ParseIntPipe) id: number) { return this.campusService.remove(id); }
}
