import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TipoCambioService } from './tipo-cambio.service';
import { UpdateTipoCambioDto } from './dto/tipo-cambio.dto';

@UseGuards(JwtAuthGuard)
@Controller('tipo-cambio')
export class TipoCambioController {
  constructor(private readonly tipoCambio: TipoCambioService) {}

  @Get()
  findAll() {
    return this.tipoCambio.findAll();
  }

  @Patch(':moneda')
  @UseGuards(PermissionsGuard)
  @RequirePermission('arm-catalogos:manage')
  upsert(@Param('moneda') moneda: string, @Body() dto: UpdateTipoCambioDto, @CurrentUser() user: any) {
    return this.tipoCambio.upsert(moneda, dto, { sub: user.sub, email: user.email });
  }

  @Post('refresh')
  @UseGuards(PermissionsGuard)
  @RequirePermission('arm-catalogos:manage')
  refresh() {
    return this.tipoCambio.refreshFromApi();
  }
}
