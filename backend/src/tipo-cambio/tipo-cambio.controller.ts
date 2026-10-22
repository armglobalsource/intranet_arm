import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
  findAll(@Query('monedas') monedas?: string) {
    const codigos = (monedas || 'USD,ARS,BRL,VES,UYU,EUR').split(',').filter(Boolean);
    return this.tipoCambio.getTasasClp(codigos);
  }

  @Post('refresh')
  @UseGuards(PermissionsGuard)
  @RequirePermission('arm-catalogos:manage')
  async refresh() {
    const doc = await this.tipoCambio.refreshFromApi();
    const fetchedAt: any = doc.fetchedAt;
    return { clpPorUsd: doc.rates.CLP, actualizado: (fetchedAt instanceof Date ? fetchedAt : fetchedAt.toDate()).toISOString() };
  }

  @Patch(':moneda')
  @UseGuards(PermissionsGuard)
  @RequirePermission('arm-catalogos:manage')
  setManual(@Param('moneda') moneda: string, @Body() dto: UpdateTipoCambioDto, @CurrentUser() user: any) {
    return this.tipoCambio.setManual(moneda, dto, { sub: user.sub, email: user.email });
  }

  @Delete(':moneda')
  @UseGuards(PermissionsGuard)
  @RequirePermission('arm-catalogos:manage')
  clearManual(@Param('moneda') moneda: string) {
    return this.tipoCambio.clearManual(moneda);
  }
}
