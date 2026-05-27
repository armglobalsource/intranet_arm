import {
  Body, Controller, Delete, Get, Param, ParseIntPipe,
  Patch, Post, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingDto, UpdateOnboardingDto } from './dto/onboarding.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Onboarding')
@ApiBearerAuth()
@Controller({ path: 'onboarding', version: '1' })
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'Listar onboardings visibles para el usuario' })
  findAll(@CurrentUser() user: any) {
    const isAdmin  = user.role === 'admin';
    const roleName = user.roleName ?? user.role ?? '';
    if (isAdmin) return this.service.findAllAdmin();
    return this.service.findAll(roleName, false);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Obtener onboarding por slug' })
  findOne(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Post()
  @ApiOperation({ summary: 'Crear onboarding (admin)' })
  create(@Body() dto: CreateOnboardingDto, @CurrentUser() user: any) {
    if (user.role !== 'admin') throw new ForbiddenException();
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar onboarding (admin)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOnboardingDto,
    @CurrentUser() user: any,
  ) {
    if (user.role !== 'admin') throw new ForbiddenException();
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar onboarding (admin)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    if (user.role !== 'admin') throw new ForbiddenException();
    return this.service.remove(id);
  }
}
