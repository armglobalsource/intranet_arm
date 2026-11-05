import {
  BadRequestException, Body, Controller, Get, Post, Query, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ResendMailerService } from '../auth/resend-mailer.service';
import { SendWeeklyReportDto } from './dto/weekly-report.dto';
import { renderWeeklyReportHtml, renderWeeklyReportText, weekLabel } from './weekly-report.html';
import { validDay } from './statistics-range';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { hasPermission } from '../common/permissions';
import { PostgresEstadisticasService } from './postgres-estadisticas.service';
import { GroupBy } from './postgres-estadisticas.service';
import { RecordType } from './postgres-estadisticas.service';
import { statisticsRange } from './statistics-range';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('estadisticas:view')
@Controller('estadisticas')
export class EstadisticasController {
  constructor(
    private readonly estadisticas: PostgresEstadisticasService,
    private readonly mailer: ResendMailerService,
    private readonly config: ConfigService,
  ) {}

  private reportUrl(semana: string) {
    const origin = (this.config.get<string>('FRONTEND_URL') ?? '').replace(/\/+$/, '');
    return /^https:\/\//.test(origin) ? `${origin}/dashboard/produccion-general/estadisticas/reporte-semanal?semana=${semana}` : undefined;
  }

  /** Reporte semanal de todos los campus (lo que antes se armaba a mano). */
  @Get('reporte-semanal')
  @RequirePermission('estadisticas:viewAll')
  async weeklyReport(@Query('semana') semana: string, @Query('porRevisar') porRevisar?: string) {
    if (!validDay(semana ?? '')) throw new BadRequestException('Semana inválida');
    const report = await this.estadisticas.weeklyReport(semana, porRevisar === '1' || porRevisar === 'true');
    return { ...report, html: renderWeeklyReportHtml(report) };
  }

  @Post('reporte-semanal/enviar')
  @RequirePermission('estadisticas:viewAll')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async sendWeeklyReport(@Body() dto: SendWeeklyReportDto, @CurrentUser() user: any) {
    if (!validDay(dto.semana)) throw new BadRequestException('Semana inválida');
    const report = await this.estadisticas.weeklyReport(dto.semana, !!dto.porRevisar);
    const to = [...new Set(dto.destinatarios.map((d) => d.trim().toLowerCase()))];
    const sent = await this.mailer.sendHtml({
      to,
      subject: `Reporte semanal ARM · Sem. ${weekLabel(report.semana)}`,
      html: renderWeeklyReportHtml(report, { appUrl: this.reportUrl(report.semana.desde) }),
      text: renderWeeklyReportText(report),
      // Evita un doble envío por doble clic; un reenvío un minuto después sí sale.
      idempotencyKey: `weekly-report/${user?.sub ?? 'user'}/${report.semana.desde}/${Math.floor(Date.now() / 60000)}`,
    });
    return { enviado: true, id: sent.id, destinatarios: to.length, semana: report.semana };
  }

  @Get()
  async dashboard(
    @Query('year') yearText: string,
    @Query('groupBy') groupByText: string | undefined,
    @Query('campusId') campusIdText: string | undefined,
    @Query('type') typeText: string | undefined,
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('country') country?: string,
    @Query('period') period?: string,
  ) {
    const year = Number(yearText);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException('year inválido');
    }

    const groupBy: GroupBy = groupByText === 'year' ? 'year' : groupByText === 'week' ? 'week' : 'month';
    if (groupByText && !['week', 'month', 'year'].includes(groupByText)) {
      throw new BadRequestException('groupBy inválido');
    }

    const type: RecordType = ['encuentro', 'evento'].includes(typeText ?? '')
      ? typeText as RecordType
      : 'all';
    if (typeText && !['all', 'encuentro', 'evento'].includes(typeText)) {
      throw new BadRequestException('type inválido');
    }

    const canViewAll = hasPermission(user.permissions ?? [], 'estadisticas:viewAll');
    const requestedCampusId = campusIdText ? Number(campusIdText) : undefined;
    if (campusIdText !== undefined && (!/^\d+$/.test(campusIdText) || !Number.isSafeInteger(requestedCampusId) || requestedCampusId! <= 0)) {
      throw new BadRequestException('campusId inválido');
    }

    if (!canViewAll && (!Number.isSafeInteger(Number(user.campusId)) || Number(user.campusId) <= 0)) {
      throw new BadRequestException('Tu cuenta no tiene un campus asignado');
    }
    if (!canViewAll && requestedCampusId && requestedCampusId !== Number(user.campusId)) {
      throw new BadRequestException('No puedes consultar otro campus');
    }

    if (period !== undefined && period !== 'history') throw new BadRequestException('Período inválido');
    const history = period === 'history';
    statisticsRange(year, from, to, history);
    if (country && country.length > 100) throw new BadRequestException('País inválido');
    return this.estadisticas.dashboard({
      year,
      groupBy,
      type,
      campusId: canViewAll ? requestedCampusId : Number(user.campusId),
      canViewAll,
      from, to, country, history,
    });
  }
}
