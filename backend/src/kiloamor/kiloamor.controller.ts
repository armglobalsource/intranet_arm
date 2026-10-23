import {
  BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PostgresCampusService } from '../campus/postgres-campus.service';
import { resolveCampusScope, applyLimit } from '../common/campus-scope';
import { PostgresKiloamorService } from './postgres-kiloamor.service';
import { CreateKiloamorDto, UpdateKiloamorDto } from './dto/kiloamor.dto';

@UseGuards(JwtAuthGuard)
@Controller('kiloamor')
export class KiloamorController {
  constructor(
    private readonly kiloamor: PostgresKiloamorService,
    private readonly campusService: PostgresCampusService,
  ) {}

  /** Resumen agregado del campus del usuario autenticado (nunca del campus que el cliente pida). */
  @Get('resumen')
  @UseGuards(PermissionsGuard)
  @RequirePermission('kiloamor:create')
  async resumen(
    @Query('year')  yearStr: string,
    @Query('month') monthStr: string | undefined,
    @CurrentUser()  user: any,
  ) {
    if (!user.campusId) throw new BadRequestException('Tu cuenta no tiene un campus asignado.');
    const year  = parseInt(yearStr, 10);
    const month = monthStr !== undefined ? parseInt(monthStr, 10) : undefined;
    if (!Number.isInteger(year)) throw new BadRequestException('year inválido');
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
      throw new BadRequestException('month inválido (1-12)');
    }
    const campus = await this.campusService.findOne(user.campusId);
    return this.kiloamor.resumen(campus.name, year, month);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('kiloamor:view')
  async findAll(
    @CurrentUser()     user: any,
    @Query('campusId') campusId?: string,
    @Query('periodo')  periodo?: any,
    @Query('limit')    limit?: string,
  ) {
    const campus = await resolveCampusScope(user, campusId, this.campusService);
    if (campus === null) return [];
    return applyLimit(await this.kiloamor.findAll(campus, periodo), limit);
  }

  @Get('mine')
  @UseGuards(PermissionsGuard)
  @RequirePermission('kiloamor:create')
  findMine(@CurrentUser() user: any) {
    return this.kiloamor.findMine(user.sub);
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
