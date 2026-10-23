import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PostgresReconciliationService } from './postgres-reconciliation.service';
import { MatchRequestDto, ApplyRequestDto } from './dto/reconciliation.dto';

@ApiTags('Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller({ path: 'reconciliation', version: '1' })
export class ReconciliationController {
  constructor(private readonly service: PostgresReconciliationService) {}

  @Post('match')
  @ApiOperation({ summary: 'Admin: proponer matches entre filas de Excel y usuarios existentes (sin escribir en la BD)' })
  match(@Body() dto: MatchRequestDto) {
    return this.service.match(dto.rows);
  }

  @Post('apply')
  @ApiOperation({ summary: 'Admin: aplicar los matches confirmados (actualizar o crear personas)' })
  apply(@Body() dto: ApplyRequestDto, @CurrentUser() user: any) {
    return this.service.apply(dto.matches, user.sub);
  }
}
