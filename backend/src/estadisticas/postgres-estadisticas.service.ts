import { BadRequestException, Injectable } from '@nestjs/common';
import { ArmRecordStore } from '../common/database/arm-record-store';
import { PostgresCampusService } from '../campus/postgres-campus.service';
import { PostgresArmCatalogosService } from '../arm-catalogos/postgres-arm-catalogos.service';
import { sumCounts } from '../common/arm-records.util';
import { isUploaded } from '../encuentros/encuentros.review';
import { countryName, statisticsRange, validDay } from './statistics-range';

export type GroupBy = 'week' | 'month' | 'year';
export type RecordType = 'all' | 'encuentro' | 'evento';

interface DashboardOptions {
  year: number;
  groupBy: GroupBy;
  type: RecordType;
  campusId?: number;
  canViewAll: boolean;
  from?: string;
  to?: string;
  country?: string;
  history?: boolean;
}

export interface Metrics {
  auditorio: number;
  encuentros: number;
  eventos: number;
  asistencia: number;
  voluntarios: number;
  manitosPresencial: number;
  manitosOnline: number;
  espectadoresOnline: number;
  kiloAmorCajas: number;
  kiloAmorRegistros: number;
}

export interface Quality {
  total: number;
  complete: number;
  incomplete: number;
  completeness: number;
  missing: Record<string, number>;
}

const emptyMetrics = (): Metrics => ({
  auditorio: 0,
  encuentros: 0,
  eventos: 0,
  asistencia: 0,
  voluntarios: 0,
  manitosPresencial: 0,
  manitosOnline: 0,
  espectadoresOnline: 0,
  kiloAmorCajas: 0,
  kiloAmorRegistros: 0,
});

const emptyQuality = (): Quality => ({
  total: 0,
  complete: 0,
  incomplete: 0,
  completeness: 0,
  missing: {
    asistencia: 0,
    voluntarios: 0,
    manitos: 0,
    espectadoresOnline: 0,
    predicador: 0,
  },
});

function normalized(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function campusCountry(campus: any): string {
  return normalized(campus.name) === 'virtual' && !campus.country ? 'Global' : countryName(campus.country);
}

function dateKey(value: unknown): string | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const key = match ? `${match[1]}-${match[2]}-${match[3]}` : '';
  return validDay(key) ? key : null;
}

function utcDate(key: string) {
  return new Date(`${key}T12:00:00Z`);
}

function isoKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

// Reportes históricos de los que solo se conoce el mes (`fechaPrecision: 'mes'`): `fecha` es el primer día
// del mes por compatibilidad con el almacén, pero no es un día real. Cuentan en el mes completo, nunca en una semana.
const isMonthOnly = (row: any) => row?.fechaPrecision === 'mes';

function monthEnd(key: string) {
  const [year, month] = key.split('-').map(Number);
  return isoKey(new Date(Date.UTC(year, month, 0, 12)));
}

// Transmisiones que el propio reporte identifica como Online o Virtual (modalidad o nombre del encuentro).
// Se atribuyen al campus Virtual sin quitarlas de su campus emisor ni duplicarlas en el total global.
const ONLINE_BROADCAST = /\b(online|virtual)\b/;
function isOnlineBroadcast(row: any) {
  return ONLINE_BROADCAST.test(normalized(`${row?.modalidad ?? ''} ${row?.encuentro ?? ''}`));
}

const countOf = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);

function startOfWeek(key: string) {
  const date = utcDate(key);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

function mergeMetrics(target: Metrics, source: Partial<Metrics>) {
  for (const key of Object.keys(target) as (keyof Metrics)[]) {
    target[key] += source[key] ?? 0;
  }
}

function addBreakdown(target: Record<string, number>, values?: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      target[key] = (target[key] ?? 0) + value;
    }
  }
}

function hasNumericValue(values?: Record<string, unknown>) {
  return Object.values(values ?? {}).some((value) =>
    typeof value === 'number' && Number.isFinite(value),
  );
}

@Injectable()
export class PostgresEstadisticasService {
  constructor(
    private store: ArmRecordStore,
    private campuses: PostgresCampusService,
    private catalogs: PostgresArmCatalogosService,
  ) {}

  async dashboard(options: DashboardOptions) {
    if (!options.canViewAll && (!Number.isSafeInteger(options.campusId) || options.campusId! <= 0)) throw new BadRequestException('Campus requerido');
    const range = statisticsRange(options.year, options.from, options.to, options.history);
    const allCampuses = await this.campuses.findAll();
    // Resolve legacy names against the FULL catalog, never a filtered subset.
    // This prevents homonymous campuses from crossing an authorization boundary.
    const campusById = new Map(allCampuses.map((campus: any) => [Number(campus.id), campus]));
    const campusByName = new Map<string, any[]>();
    for (const campus of allCampuses) {
      const key = normalized(campus.name);
      campusByName.set(key, [...(campusByName.get(key) ?? []), campus]);
    }
    const authorizedCampuses = allCampuses.filter((campus: any) => options.canViewAll || Number(campus.id) === options.campusId);
    const visibleCampuses = authorizedCampuses
      .filter((campus: any) => !options.country || normalized(campusCountry(campus)) === normalized(countryName(options.country)))
      .filter((campus: any) => !options.campusId || Number(campus.id) === options.campusId);
    const visibleIds = new Set(visibleCampuses.map((campus: any) => Number(campus.id)));

    const { start, end } = range;
    const [encuentrosSnap, kiloamorSnap, asistenciaCatalog, voluntariosCatalog] = await Promise.all([
      this.store.list('encuentros',{start: range.previousStart,end: `${end}T23:59:59.999Z`}),
      this.store.list('kiloamor',{start: range.previousStart,end: `${end}T23:59:59.999Z`}),
      this.catalogs.findAll('asistencia'),
      this.catalogs.findAll('voluntarios'),
    ]);

    // Campus del reporte según el catálogo completo (sin filtrar por permisos); la visibilidad se aplica aparte.
    const campusOf = (row: any) => {
      const matches = campusByName.get(normalized(row.campus)) ?? [];
      return row.campusId != null && row.campusId !== '' ? campusById.get(Number(row.campusId)) : matches.length === 1 ? matches[0] : undefined;
    };
    const resolveCampus = (row: any) => {
      const campus = campusOf(row);
      return campus && visibleIds.has(Number(campus.id)) ? campus : undefined;
    };
    // Un reporte de solo mes entra únicamente si el rango cubre el mes completo.
    const inRange = (row: any, from: string, to: string) => {
      const key = dateKey(row.fecha);
      if (!key || key < from) return false;
      return isMonthOnly(row) ? to >= monthEnd(key) : key <= to;
    };
    const scopedRows = encuentrosSnap
      .filter((row) => resolveCampus(row))
      .filter((row) => options.type === 'all' || row.tipo === options.type);
    // Cuentan los reportes que el administrador del campus ya subió (los importados de Asana
    // cuentan como subidos), los validados y los registros antiguos sin estado. Los que esperan
    // revisión u observados quedan como excluidos.
    const eligible = (row: any) => !row.estado || row.estado === 'validado' || isUploaded(row);
    const encounterRows = scopedRows.filter(eligible).filter((row) => inRange(row, start, end));
    const kiloRows = kiloamorSnap
      .filter((row) => resolveCampus(row)).filter((row) => inRange(row, start, end));
    const previous = emptyMetrics();
    for (const row of scopedRows.filter(eligible).filter((row) => inRange(row, range.previousStart, range.previousEnd))) mergeMetrics(previous, this.encounterMetrics(row));
    for (const row of kiloamorSnap.filter((row) => resolveCampus(row)).filter((row) => inRange(row, range.previousStart, range.previousEnd))) mergeMetrics(previous, { kiloAmorCajas: row.cajas ?? 0, kiloAmorRegistros: 1 });

    const periods = Array.from({ length: Number(end.slice(0, 4)) - Number(start.slice(0, 4)) + 1 }, (_, i) => Number(start.slice(0, 4)) + i)
      .flatMap((year) => this.buildPeriods(year, options.groupBy))
      .filter((period, index, all) => period.end >= start && period.start <= end && all.findIndex((p) => p.key === period.key) === index)
      .map((period) => ({ ...period, start: period.start < start ? start : period.start, end: period.end > end ? end : period.end }));
    const periodMap = new Map(periods.map((period) => [period.key, period]));
    const campusRows = visibleCampuses.map((campus: any) => ({
      campusId: Number(campus.id),
      campusName: campus.name,
      country: campusCountry(campus),
      isActive: campus.isActive !== false,
      metrics: emptyMetrics(),
      quality: emptyQuality(),
    }));
    const campusMap = new Map(campusRows.map((campus) => [campus.campusId, campus]));
    const totals = emptyMetrics();
    const quality = emptyQuality();
    const attendanceBreakdown: Record<string, number> = {};
    const volunteerBreakdown: Record<string, number> = {};
    const records: any[] = [];
    // Reportes de solo mes incluidos: suman en totales y campus, y en períodos solo si se agrupa por mes.
    const monthOnlyMetrics = emptyMetrics();
    let monthOnlyReports = 0;

    for (const row of encounterRows) {
      const campus = resolveCampus(row);
      const key = dateKey(row.fecha);
      if (!campus || !key) continue;

      const metrics = this.encounterMetrics(row);
      const monthOnly = isMonthOnly(row);
      const periodKey = this.periodKey(key, options.groupBy);
      const period = monthOnly && options.groupBy === 'week' ? undefined : periodMap.get(periodKey);
      const campusSummary = campusMap.get(Number(campus.id));
      mergeMetrics(totals, metrics);
      if (period) mergeMetrics(period.metrics, metrics);
      if (campusSummary) mergeMetrics(campusSummary.metrics, metrics);
      if (monthOnly) { mergeMetrics(monthOnlyMetrics, metrics); monthOnlyReports++; }
      addBreakdown(attendanceBreakdown, row.asistencia);
      addBreakdown(volunteerBreakdown, row.voluntarios);

      const rowQuality = this.quality(row);
      this.mergeQuality(quality, rowQuality);
      if (period) this.mergeQuality(period.quality, rowQuality);
      if (campusSummary) this.mergeQuality(campusSummary.quality, rowQuality);

      records.push({
        id: row.id,
        fecha: key,
        fechaPrecision: monthOnly ? 'mes' : 'dia',
        periodo: monthOnly ? String(row.periodo ?? key.slice(0, 7)) : null,
        campusId: Number(campus.id),
        campusName: campus.name,
        country: campusCountry(campus),
        tipo: row.tipo === 'evento' ? 'evento' : 'encuentro',
        encuentro: row.encuentro ?? '',
        predicador: row.predicador ?? '',
        mensaje: row.mensaje ?? '',
        asistencia: metrics.asistencia,
        voluntarios: metrics.voluntarios,
        manitosPresencial: metrics.manitosPresencial,
        manitosOnline: metrics.manitosOnline,
        espectadoresOnline: metrics.espectadoresOnline,
        completeness: rowQuality.completeness,
        registradoPor: row.registradoPor?.email ?? null,
        fechaRegistroISO: row.fechaRegistroISO ?? null,
      });
    }

    for (const row of kiloRows) {
      const campus = resolveCampus(row);
      const key = dateKey(row.fecha);
      if (!campus || !key) continue;
      const metrics = {
        kiloAmorCajas: typeof row.cajas === 'number' ? row.cajas : 0,
        kiloAmorRegistros: 1,
      };
      mergeMetrics(totals, metrics);
      const period = periodMap.get(this.periodKey(key, options.groupBy));
      if (period) mergeMetrics(period.metrics, metrics);
      const campusSummary = campusMap.get(Number(campus.id));
      if (campusSummary) mergeMetrics(campusSummary.metrics, metrics);
    }

    this.finishQuality(quality);
    for (const period of periods) this.finishQuality(period.quality);
    for (const campus of campusRows) this.finishQuality(campus.quality);

    records.sort((a, b) => b.fecha.localeCompare(a.fecha));
    campusRows.sort((a, b) =>
      b.metrics.asistencia - a.metrics.asistencia ||
      a.campusName.localeCompare(b.campusName, 'es'),
    );

    // Campus Virtual: solo se calcula si el usuario ya puede ver ese campus; son totales, no registros de otros campus.
    const virtualMatches = campusByName.get('virtual') ?? [];
    const virtualCampus = virtualMatches.length === 1 ? virtualMatches[0] : undefined;
    const virtual = virtualCampus && visibleIds.has(Number(virtualCampus.id))
      ? this.virtualAttribution(
        encuentrosSnap.filter(eligible).filter((row) => options.type === 'all' || row.tipo === options.type).filter((row) => inRange(row, start, end)),
        campusOf,
        virtualCampus,
      )
      : null;

    return {
      meta: {
        year: options.year,
        from: start, to: end, days: range.days,
        history: options.history === true,
        monthOnly: { reports: monthOnlyReports, metrics: this.withDerived(monthOnlyMetrics) },
        country: options.country ? countryName(options.country) : null,
        excludedReports: scopedRows.filter((row) => inRange(row, start, end) && !eligible(row)).length,
        legacyReports: encounterRows.filter((row) => !row.estado || row.source?.provider === 'asana' || String(row.id ?? '').startsWith('asana:')).length,
        groupBy: options.groupBy,
        type: options.type,
        campusId: options.campusId ?? null,
        canViewAll: options.canViewAll,
        generatedAt: new Date().toISOString(),
      },
      countries: [...new Set(authorizedCampuses.map((campus: any) => campusCountry(campus)))].sort((a, b) => a.localeCompare(b, 'es')),
      campuses: authorizedCampuses.map((campus: any) => ({
        id: Number(campus.id),
        name: campus.name,
        country: campusCountry(campus),
        isActive: campus.isActive !== false,
      })),
      comparison: options.history ? null : { from: range.previousStart, to: range.previousEnd, totals: this.withDerived(previous) },
      totals: this.withDerived(totals),
      periods: periods.map((period) => ({
        ...period,
        metrics: this.withDerived(period.metrics),
      })),
      byCampus: campusRows.map((campus) => ({
        ...campus,
        metrics: this.withDerived(campus.metrics),
      })),
      attendanceBreakdown: this.labelBreakdown(attendanceBreakdown, asistenciaCatalog),
      volunteerBreakdown: this.labelBreakdown(volunteerBreakdown, voluntariosCatalog),
      virtual,
      quality,
      records,
    };
  }

  /**
   * Audiencia online que otros campus transmiten como Online/Virtual, atribuida al campus Virtual.
   * Es una vista paralela: no se suma a `totals` ni a `byCampus`, así el total global cuenta cada cifra una sola vez.
   */
  private virtualAttribution(rows: any[], campusOf: (row: any) => any, virtualCampus: any) {
    const emitters = new Map<number, { campusId: number; campusName: string; reports: number; espectadoresOnline: number; manitosOnline: number }>();
    for (const row of rows) {
      const emitter = campusOf(row);
      if (!emitter || !['santiago', 'puente alto'].includes(normalized(emitter.name)) || !isOnlineBroadcast(row)) continue;
      const viewers = countOf(row.online?.espectadores);
      const decisions = countOf(row.online?.acepto);
      if (!viewers && !decisions) continue;
      const entry = emitters.get(Number(emitter.id)) ?? { campusId: Number(emitter.id), campusName: emitter.name, reports: 0, espectadoresOnline: 0, manitosOnline: 0 };
      entry.reports += 1;
      entry.espectadoresOnline += viewers;
      entry.manitosOnline += decisions;
      emitters.set(Number(emitter.id), entry);
    }
    const byEmitter = [...emitters.values()].sort((a, b) => b.espectadoresOnline - a.espectadoresOnline || a.campusName.localeCompare(b.campusName, 'es'));
    return {
      campusId: Number(virtualCampus.id),
      campusName: virtualCampus.name,
      reports: byEmitter.reduce((sum, e) => sum + e.reports, 0),
      espectadoresOnline: byEmitter.reduce((sum, e) => sum + e.espectadoresOnline, 0),
      manitosOnline: byEmitter.reduce((sum, e) => sum + e.manitosOnline, 0),
      emitters: byEmitter,
      criterion: 'Reportes de Santiago y Puente Alto identificados como Online o Virtual en su nombre o modalidad, incluidos Presencial + Online. Solo se atribuyen espectadores a la vez y decisiones online; las cifras presenciales permanecen en el campus emisor.',
    };
  }

  private encounterMetrics(row: any): Partial<Metrics> {
    return {
      encuentros: row.tipo === 'evento' ? 0 : 1,
      eventos: row.tipo === 'evento' ? 1 : 0,
      auditorio: row.asistencia?.auditorio ?? 0,
      asistencia: typeof row.totalAsistencia === 'number'
        ? row.totalAsistencia
        : sumCounts(row.asistencia),
      voluntarios: typeof row.totalVoluntarios === 'number'
        ? row.totalVoluntarios
        : sumCounts(row.voluntarios),
      manitosPresencial: row.presencial?.acepto ?? 0,
      manitosOnline: row.online?.acepto ?? 0,
      espectadoresOnline: row.online?.espectadores ?? 0,
    };
  }

  private quality(row: any): Quality {
    const missing: Record<string, number> = {
      asistencia: hasNumericValue(row.asistencia) ? 0 : 1,
      voluntarios: hasNumericValue(row.voluntarios) ? 0 : 1,
      manitos: typeof row.presencial?.acepto === 'number' || typeof row.online?.acepto === 'number' ? 0 : 1,
      espectadoresOnline: typeof row.online?.espectadores === 'number' ? 0 : 1,
      predicador: String(row.predicador ?? '').trim() ? 0 : 1,
    };
    const present = Object.values(missing).filter((value) => value === 0).length;
    const completeness = Math.round((present / Object.keys(missing).length) * 100);
    return {
      total: 1,
      complete: completeness === 100 ? 1 : 0,
      incomplete: completeness === 100 ? 0 : 1,
      completeness,
      missing,
    };
  }

  private mergeQuality(target: Quality, source: Quality) {
    target.total += source.total;
    target.complete += source.complete;
    target.incomplete += source.incomplete;
    for (const [key, value] of Object.entries(source.missing)) {
      target.missing[key] = (target.missing[key] ?? 0) + value;
    }
  }

  private finishQuality(quality: Quality) {
    quality.completeness = quality.total
      ? Math.round((quality.complete / quality.total) * 100)
      : 0;
  }

  private withDerived(metrics: Metrics) {
    const meetings = metrics.encuentros + metrics.eventos;
    return {
      ...metrics,
      manitosTotal: metrics.manitosPresencial + metrics.manitosOnline,
      promedioAsistencia: meetings ? Math.round(metrics.asistencia / meetings) : 0,
      promedioVoluntarios: meetings ? Math.round(metrics.voluntarios / meetings) : 0,
    };
  }

  private periodKey(key: string, groupBy: GroupBy) {
    if (groupBy === 'year') return key.slice(0, 4);
    return groupBy === 'month'
      ? key.slice(0, 7)
      : isoKey(startOfWeek(key));
  }

  private buildPeriods(year: number, groupBy: GroupBy) {
    if (groupBy === 'year') return [{
      key: String(year), label: String(year), start: `${year}-01-01`, end: `${year}-12-31`,
      metrics: emptyMetrics(), quality: emptyQuality(),
    }];
    if (groupBy === 'month') {
      return Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        return {
          key: `${year}-${String(month).padStart(2, '0')}`,
          label: new Date(Date.UTC(year, index, 1)).toLocaleDateString('es-CL', {
            month: 'short',
            timeZone: 'UTC',
          }),
          start: `${year}-${String(month).padStart(2, '0')}-01`,
          end: isoKey(new Date(Date.UTC(year, month, 0, 12))),
          metrics: emptyMetrics(),
          quality: emptyQuality(),
        };
      });
    }

    const periods = [];
    let cursor = startOfWeek(`${year}-01-01`);
    const last = utcDate(`${year}-12-31`);
    while (cursor <= last) {
      const end = addDays(cursor, 6);
      periods.push({
        key: isoKey(cursor),
        label: `${cursor.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' })}`,
        start: isoKey(cursor),
        end: isoKey(end),
        metrics: emptyMetrics(),
        quality: emptyQuality(),
      });
      cursor = addDays(cursor, 7);
    }
    return periods;
  }

  private labelBreakdown(
    values: Record<string, number>,
    catalog: { key: string; label: string; sortOrder?: number }[],
  ) {
    const labels = new Map(catalog.map((item) => [item.key, item.label]));
    const order = new Map(catalog.map((item, index) => [item.key, item.sortOrder ?? index]));
    return Object.entries(values)
      .map(([key, value]) => ({ key, label: labels.get(key) ?? key, value }))
      .sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
  }
}
