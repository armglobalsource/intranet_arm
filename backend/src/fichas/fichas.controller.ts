import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PostgresFichasService } from './postgres-fichas.service';
import { CreateFichaDto, UpdateFichaDto, UpdateSectionDto, CloneFichaDto, UpdateLayoutVisualDto, UpdateEquipoDto } from './dto/ficha.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fichas')
export class FichasController {
  constructor(private readonly fichasService: PostgresFichasService) {}

  @Get()
  @RequirePermission('fichas:view')
  findAll(
    @CurrentUser() user: any,
    @Query('campusId') campusId?: string,
    @Query('status')   status?: string,
  ) {
    return this.fichasService.findAll(user, campusId, status);
  }

  @Get('mine')
  findMine(@CurrentUser() user: any) {
    const isAdmin = (user?.permissions ?? []).includes('*');
    return this.fichasService.findMine(user.sub, isAdmin);
  }

  @Get('mobile/published')
  findPublishedForMobile(@CurrentUser() user: any) {
    return this.fichasService.findPublishedForMobile(user);
  }

  @Public()
  @Get('public/week')
  findPublicWeek(@Query('start') start?: string) {
    return this.fichasService.findPublicWeek(start);
  }

  @Public()
  @Get('public/:fichaId')
  findOnePublic(@Param('fichaId') fichaId: string) {
    return this.fichasService.findPublic(fichaId);
  }

  // Quién puede ver cada ficha (publicada o no) lo decide el servicio según su rol en ella.
  @Get(':fichaId')
  findOne(@Param('fichaId') fichaId: string, @CurrentUser() user: any) {
    return this.fichasService.findOneForUser(fichaId, user);
  }

  @Post()
  @RequirePermission('fichas:create')
  create(@Body() dto: CreateFichaDto, @CurrentUser() user: any) {
    return this.fichasService.create(dto, user);
  }

  @Patch(':fichaId')
  @RequirePermission('fichas:edit')
  update(@Param('fichaId') fichaId: string, @Body() dto: UpdateFichaDto, @CurrentUser() user: any) {
    return this.fichasService.update(fichaId, dto, user);
  }

  @Delete(':fichaId')
  @RequirePermission('fichas:delete')
  remove(@Param('fichaId') fichaId: string, @CurrentUser() user: any) {
    return this.fichasService.remove(fichaId, user);
  }

  @Post(':fichaId/clone')
  @RequirePermission('fichas:create')
  clone(
    @Param('fichaId') fichaId: string,
    @Body()           dto: CloneFichaDto,
    @CurrentUser()    user: any,
  ) {
    return this.fichasService.clone(fichaId, user, dto);
  }

  @Post(':fichaId/split-prayer-global')
  @RequirePermission('fichas:edit')
  splitPrayerAndGlobal(
    @Param('fichaId') fichaId: string,
    @CurrentUser() user: any,
  ) {
    return this.fichasService.splitPrayerAndGlobal(fichaId, user);
  }

  @Patch(':fichaId/publish')
  publish(@Param('fichaId') fichaId: string, @CurrentUser() user: any) {
    return this.fichasService.publish(fichaId, user);
  }

  @Patch(':fichaId/unpublish')
  unpublish(@Param('fichaId') fichaId: string, @CurrentUser() user: any) {
    return this.fichasService.unpublish(fichaId, user);
  }

  @Patch(':fichaId/archive')
  @RequirePermission('fichas:edit')
  archive(@Param('fichaId') fichaId: string, @CurrentUser() user: any) {
    return this.fichasService.archive(fichaId, user);
  }

  @Patch(':fichaId/unarchive')
  @RequirePermission('fichas:edit')
  unarchive(@Param('fichaId') fichaId: string, @CurrentUser() user: any) {
    return this.fichasService.unarchive(fichaId, user);
  }

  // Los permisos por ficha (área, visuales, encargado) se validan en el servicio.
  @Patch(':fichaId/layout-visual')
  updateLayoutVisual(
    @Param('fichaId') fichaId: string,
    @Body()           dto: UpdateLayoutVisualDto,
    @CurrentUser()    user: any,
  ) {
    return this.fichasService.updateLayoutVisual(fichaId, dto, user);
  }

  @Patch(':fichaId/sections/:sectionName')
  updateSection(
    @Param('fichaId')     fichaId: string,
    @Param('sectionName') sectionName: string,
    @Body()               dto: UpdateSectionDto,
    @CurrentUser()        user: any,
  ) {
    return this.fichasService.updateSection(fichaId, sectionName, dto, user);
  }

  @Patch(':fichaId/sections/:sectionName/complete')
  completeSection(
    @Param('fichaId')     fichaId: string,
    @Param('sectionName') sectionName: string,
    @CurrentUser()        user: any,
  ) {
    return this.fichasService.completeSection(fichaId, sectionName, user);
  }

  @Patch(':fichaId/sections/:sectionName/reopen')
  reopenSection(
    @Param('fichaId')     fichaId: string,
    @Param('sectionName') sectionName: string,
    @CurrentUser()        user: any,
  ) {
    return this.fichasService.reopenSection(fichaId, sectionName, user);
  }

  @Patch(':fichaId/equipo')
  updateEquipo(@Param('fichaId') fichaId: string, @Body() dto: UpdateEquipoDto, @CurrentUser() user: any) {
    return this.fichasService.updateEquipo(fichaId, dto, user);
  }

  @Get(':fichaId/changelog')
  getChangelog(@Param('fichaId') fichaId: string, @CurrentUser() user: any) {
    return this.fichasService.getChangelog(fichaId, user);
  }
}
