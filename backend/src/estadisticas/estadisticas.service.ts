import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CampusService } from '../campus/campus.service';
import { ArmCatalogosService } from '../arm-catalogos/arm-catalogos.service';
import { sumCounts } from '../common/arm-records.util';

export type GroupBy = 'week' | 'month';
export type RecordType = 'all' | 'encuentro' | 'evento';

interface DashboardOptions {
  year: number;
  groupBy: GroupBy;
  type: RecordType;
  campusId?: number;
  canViewAll: boolean;
}

export interface Metrics {
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

function dateKey(value: unknown): string | null {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
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
export class EstadisticasService {
  constructor(
    private fb: FirebaseService,
    private campuses: CampusService,
    private catalogs: ArmCatalogosService,
  ) {}

  async dashboard(options: DashboardOptions) {
    const allCampuses = await this.campuses.findAll();
    const visibleCampuses = allCampuses
      .filter((campus: any) => campus.isActive !== false)
      .filter((campus: any) => !options.campusId || Number(campus.id) === options.campusId);
    const campusById = new Map(visibleCampuses.map((campus: any) => [Number(campus.id), campus]));
    const campusByName = new Map(visibleCampuses.map((campus: any) => [normalized(campus.name), campus]));

    const start = `${options.year}-01-01`;
    const end = `${options.year}-12-31`;
    const [encuentrosSnap, kiloamorSnap, asistenciaCatalog, voluntariosCatalog] = await Promise.all([
      this.fb.db.collection('encuentros')
        .where('fecha', '>=', start)
        .where('fecha', '<=', end)
        .limit(10000)
        .get(),
      this.fb.db.collection('kiloamor')
        .where('fecha', '>=', start)
        .where('fecha', '<=', end)
        .limit(10000)
        .get(),
      this.catalogs.findAll('asistencia'),
      this.catalogs.findAll('voluntarios'),
    ]);

    const resolveCampus = (row: any) => {
      const byId = campusById.get(Number(row.campusId));
      return byId ?? campusByName.get(normalized(row.campus));
    };

    const encounterRows = encuentrosSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as any))
      .filter((row) => resolveCampus(row))
      .filter((row) => options.type === 'all' || row.tipo === options.type);
    const kiloRows = kiloamorSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as any))
      .filter((row) => resolveCampus(row));

    const periods = this.buildPeriods(options.year, options.groupBy);
    const periodMap = new Map(periods.map((period) => [period.key, period]));
    const campusRows = visibleCampuses.map((campus: any) => ({
      campusId: Number(campus.id),
      campusName: campus.name,
      metrics: emptyMetrics(),
      quality: emptyQuality(),
    }));
    const campusMap = new Map(campusRows.map((campus) => [campus.campusId, campus]));
    const totals = emptyMetrics();
    const quality = emptyQuality();
    const attendanceBreakdown: Record<string, number> = {};
    const volunteerBreakdown: Record<string, number> = {};
    const records: any[] = [];

    for (const row of encounterRows) {
      const campus = resolveCampus(row);
      const key = dateKey(row.fecha);
      if (!campus || !key) continue;

      const metrics = this.encounterMetrics(row);
      const periodKey = this.periodKey(key, options.groupBy);
      const period = periodMap.get(periodKey);
      const campusSummary = campusMap.get(Number(campus.id));
      mergeMetrics(totals, metrics);
      if (period) mergeMetrics(period.metrics, metrics);
      if (campusSummary) mergeMetrics(campusSummary.metrics, metrics);
      addBreakdown(attendanceBreakdown, row.asistencia);
      addBreakdown(volunteerBreakdown, row.voluntarios);

      const rowQuality = this.quality(row);
      this.mergeQuality(quality, rowQuality);
      if (period) this.mergeQuality(period.quality, rowQuality);
      if (campusSummary) this.mergeQuality(campusSummary.quality, rowQuality);

      records.push({
        id: row.id,
        fecha: key,
        campusId: Number(campus.id),
        campusName: campus.name,
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

    return {
      meta: {
        year: options.year,
        groupBy: options.groupBy,
        type: options.type,
        campusId: options.campusId ?? null,
        canViewAll: options.canViewAll,
        generatedAt: new Date().toISOString(),
      },
      campuses: visibleCampuses.map((campus: any) => ({
        id: Number(campus.id),
        name: campus.name,
      })),
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
      quality,
      records,
    };
  }

  private encounterMetrics(row: any): Partial<Metrics> {
    return {
      encuentros: row.tipo === 'evento' ? 0 : 1,
      eventos: row.tipo === 'evento' ? 1 : 0,
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
    return groupBy === 'month'
      ? key.slice(0, 7)
      : isoKey(startOfWeek(key));
  }

  private buildPeriods(year: number, groupBy: GroupBy) {
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
