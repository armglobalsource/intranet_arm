import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { hasPermission } from '../common/permissions';
import { FichasService } from './fichas.service';
import { CreateFichaDto, UpdateFichaDto, UpdateSectionDto, CloneFichaDto } from './dto/ficha.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fichas')
export class FichasController {
  constructor(private readonly fichasService: FichasService) {}

  @Get()
  @RequirePermission('fichas:viewAll')
  findAll(
    @Query('campusId') campusId?: string,
    @Query('status')   status?: string,
  ) {
    return this.fichasService.findAll(campusId, status);
  }

  @Get('mine')
  @RequirePermission('fichas:view')
  findMine(@CurrentUser() user: any) {
    const canViewAll = hasPermission(user?.permissions ?? [], 'fichas:viewAll');
    return this.fichasService.findMine(user.sub, canViewAll);
  }

  @Public()
  @Get('public/:fichaId')
  findOnePublic(@Param('fichaId') fichaId: string) {
    return this.fichasService.findOne(fichaId);
  }

  @Get(':fichaId')
  @RequirePermission('fichas:view')
  findOne(@Param('fichaId') fichaId: string) {
    return this.fichasService.findOne(fichaId);
  }

  @Post()
  @RequirePermission('fichas:create')
  create(@Body() dto: CreateFichaDto, @CurrentUser() user: any) {
    return this.fichasService.create(dto, user.sub, user.email);
  }

  @Patch(':fichaId')
  @RequirePermission('fichas:edit')
  update(@Param('fichaId') fichaId: string, @Body() dto: UpdateFichaDto, @CurrentUser() user: any) {
    return this.fichasService.update(fichaId, dto, user.sub, user.email);
  }

  @Delete(':fichaId')
  @RequirePermission('fichas:delete')
  remove(@Param('fichaId') fichaId: string) {
    return this.fichasService.remove(fichaId);
  }

  @Post(':fichaId/clone')
  @RequirePermission('fichas:create')
  clone(
    @Param('fichaId') fichaId: string,
    @Body()           dto: CloneFichaDto,
    @CurrentUser()    user: any,
  ) {
    return this.fichasService.clone(fichaId, user.sub, user.email, dto);
  }

  @Patch(':fichaId/archive')
  archive(@Param('fichaId') fichaId: string, @CurrentUser() user: any) {
    return this.fichasService.archive(fichaId, user.sub, user.email);
  }

  @Patch(':fichaId/unarchive')
  unarchive(@Param('fichaId') fichaId: string, @CurrentUser() user: any) {
    return this.fichasService.unarchive(fichaId, user.sub, user.email);
  }

  @Patch(':fichaId/sections/:sectionName')
  @RequirePermission('fichas:edit')
  updateSection(
    @Param('fichaId')     fichaId: string,
    @Param('sectionName') sectionName: string,
    @Body()               dto: UpdateSectionDto,
    @CurrentUser()        user: any,
  ) {
    return this.fichasService.updateSection(fichaId, sectionName, dto, user.sub, user.email);
  }

  @Patch(':fichaId/sections/:sectionName/complete')
  @RequirePermission('fichas:edit')
  completeSection(
    @Param('fichaId')     fichaId: string,
    @Param('sectionName') sectionName: string,
    @CurrentUser()        user: any,
  ) {
    return this.fichasService.completeSection(fichaId, sectionName, user.sub, user.email);
  }

  @Get(':fichaId/changelog')
  @RequirePermission('fichas:view')
  getChangelog(@Param('fichaId') fichaId: string) {
    return this.fichasService.getChangelog(fichaId);
  }
}
