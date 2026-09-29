import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CampusService } from '../campus/campus.service';
import { resolveCampusScope, applyLimit } from '../common/campus-scope';
import { SiembraService } from './siembra.service';
import { CreateSiembraDto, UpdateSiembraDto } from './dto/siembra.dto';

@UseGuards(JwtAuthGuard)
@Controller('siembra')
export class SiembraController {
  constructor(
    private readonly siembra: SiembraService,
    private readonly campusService: CampusService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('siembra:view')
  async findAll(
    @CurrentUser()     user: any,
    @Query('campusId') campusId?: string,
    @Query('periodo')  periodo?: any,
    @Query('limit')    limit?: string,
  ) {
    const campus = await resolveCampusScope(user, campusId, this.campusService);
    if (campus === null) return [];
    return applyLimit(await this.siembra.findAll(campus, periodo), limit);
  }

  @Get('mine')
  @UseGuards(PermissionsGuard)
  @RequirePermission('siembra:create')
  findMine(@CurrentUser() user: any) {
    return this.siembra.findMine(user.sub);
  }

  @Get('dashboard')
  @UseGuards(PermissionsGuard)
  @RequirePermission('finanzas:view')
  dashboard(
    @Query('year') yearText?: string,
    @Query('groupBy') groupByText?: string,
    @Query('campus') campus?: string,
  ) {
    const year = Number(yearText) || new Date().getFullYear();
    const groupBy = groupByText === 'week' ? 'week' : groupByText === 'day' ? 'day' : 'month';
    return this.siembra.dashboard(year, groupBy, campus);
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
