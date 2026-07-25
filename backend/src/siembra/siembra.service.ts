import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { TipoCambioService } from '../tipo-cambio/tipo-cambio.service';
import { ArmCatalogosService } from '../arm-catalogos/arm-catalogos.service';
import { Periodo, mapId, inPeriodo } from '../common/arm-records.util';
import { CreateSiembraDto, UpdateSiembraDto, MontoDto, MetodoPagoDto, AporteDto } from './dto/siembra.dto';

const COL = 'siembra';

// ── Dashboard: agregación por moneda/categoría/método + serie por período ────

type GroupBy = 'week' | 'month';

interface Totales {
  ofrendas: number;
  diezmos: number;
  otros: number;
  total: number;
  efectivo: number;
  sumup: number;
  metodoDesconocido: number;
}

const emptyTotales = (): Totales => ({
  ofrendas: 0, diezmos: 0, otros: 0, total: 0, efectivo: 0, sumup: 0, metodoDesconocido: 0,
});

function addLine(acc: Totales, n: Totales, factor = 1) {
  acc.ofrendas += n.ofrendas * factor;
  acc.diezmos += n.diezmos * factor;
  acc.otros += n.otros * factor;
  acc.total += n.total * factor;
  acc.efectivo += n.efectivo * factor;
  acc.sumup += n.sumup * factor;
  acc.metodoDesconocido += n.metodoDesconocido * factor;
}

/**
 * Normaliza una línea de `montos[]` a totales planos, soportando tanto la forma
 * itemizada actual (efectivo/sumup como objeto) como la forma vieja pre-rewrite
 * (efectivo/sumup como número plano, sin distinguir ofrendas/otros ni atribuir
 * el diezmo a un método de pago — se marca "metodoDesconocido" para que
 * efectivo + sumup + metodoDesconocido siempre sume el total).
 */
function normalizeMonto(raw: any): Totales & { moneda: string; isLegacy: boolean } {
  const moneda = String(raw?.moneda ?? '').trim().toUpperCase();
  const isItemized = !!(raw?.efectivo && typeof raw.efectivo === 'object');

  if (isItemized) {
    const ef = raw.efectivo ?? {};
    const su = raw.sumup ?? {};
    const efectivoTotal = Number(ef.total ?? 0);
    const sumupTotal = Number(su.total ?? 0);
    return {
      moneda,
      ofrendas: Number(ef.ofrendas ?? 0) + Number(su.ofrendas ?? 0),
      diezmos: Number(ef.totalDiezmos ?? 0) + Number(su.totalDiezmos ?? 0),
      otros: Number(ef.totalOtros ?? 0) + Number(su.totalOtros ?? 0),
      efectivo: efectivoTotal,
      sumup: sumupTotal,
      metodoDesconocido: 0,
      total: Number(raw.total ?? efectivoTotal + sumupTotal),
      isLegacy: false,
    };
  }

  const efectivoNum = Number(raw?.efectivo) || 0;
  const sumupNum = Number(raw?.sumup) || 0;
  const diezmoNum = Number(raw?.diezmo) || 0;
  return {
    moneda,
    ofrendas: efectivoNum + sumupNum,
    diezmos: diezmoNum,
    otros: 0,
    efectivo: efectivoNum,
    sumup: sumupNum,
    metodoDesconocido: diezmoNum,
    total: Number(raw?.total ?? efectivoNum + sumupNum + diezmoNum),
    isLegacy: true,
  };
}

function utcDate(key: string) { return new Date(`${key}T12:00:00Z`); }
function isoKey(date: Date) { return date.toISOString().slice(0, 10); }
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

function periodKey(fecha: string, groupBy: GroupBy) {
  const key = String(fecha ?? '').slice(0, 10);
  return groupBy === 'month' ? key.slice(0, 7) : isoKey(startOfWeek(key));
}

function buildPeriods(year: number, groupBy: GroupBy) {
  if (groupBy === 'month') {
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      return {
        key: `${year}-${String(month).padStart(2, '0')}`,
        label: new Date(Date.UTC(year, index, 1)).toLocaleDateString('es-CL', { month: 'short', timeZone: 'UTC' }),
        start: `${year}-${String(month).padStart(2, '0')}-01`,
        end: isoKey(new Date(Date.UTC(year, month, 0, 12))),
        referenceCLP: 0,
        referenceUSD: 0,
      };
    });
  }

  const periods: { key: string; label: string; start: string; end: string; referenceCLP: number; referenceUSD: number }[] = [];
  let cursor = startOfWeek(`${year}-01-01`);
  const last = utcDate(`${year}-12-31`);
  while (cursor <= last) {
    const end = addDays(cursor, 6);
    periods.push({
      key: isoKey(cursor),
      label: cursor.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
      start: isoKey(cursor),
      end: isoKey(end),
      referenceCLP: 0,
      referenceUSD: 0,
    });
    cursor = addDays(cursor, 7);
  }
  return periods;
}

@Injectable()
export class SiembraService {
  constructor(
    private fb: FirebaseService,
    private tipoCambio: TipoCambioService,
    private armCatalogos: ArmCatalogosService,
  ) {}

  /** Objetos planos (no instancias de clase) para que Firestore pueda serializarlos — mismo fix que encuentros.service.ts. */
  private plainAportes(aportes?: AporteDto[]) {
    return (aportes ?? []).map((a) => ({ nombre: a.nombre ?? '', monto: a.monto ?? 0, nota: a.nota ?? '' }));
  }

  /** Arma un método de pago (Efectivo/Sobres o SumUp) con sus totales calculados en el servidor. */
  private buildMetodo(m?: MetodoPagoDto) {
    const diezmos = this.plainAportes(m?.diezmos);
    const otrosAportes = this.plainAportes(m?.otrosAportes);
    const ofrendas = m?.ofrendas ?? 0;
    const totalDiezmos = diezmos.reduce((acc, a) => acc + a.monto, 0);
    const totalOtros = otrosAportes.reduce((acc, a) => acc + a.monto, 0);
    return {
      ofrendas,
      diezmos,
      otrosAportes,
      totalDiezmos,
      totalOtros,
      total: ofrendas + totalDiezmos + totalOtros,
    };
  }

  /** Arma cada línea de moneda como objeto plano, con efectivo/sumup y sus totales calculados en el servidor. */
  private buildMontos(montos: MontoDto[]) {
    return montos.map((m) => {
      const efectivo = this.buildMetodo(m.efectivo);
      const sumup = this.buildMetodo(m.sumup);
      return {
        moneda: m.moneda,
        efectivo,
        sumup,
        total: efectivo.total + sumup.total,
      };
    });
  }

  async findAll(campusId?: string, periodo: Periodo = 'todo') {
    let query: FirebaseFirestore.Query = this.fb.db.collection(COL);
    if (campusId) query = query.where('campus', '==', campusId);
    const snap = await query.limit(2000).get();
    return this.fb.toDocs(snap)
      .map((r) => mapId(r))
      .filter((r) => inPeriodo(r.fecha, periodo))
      .sort((a, b) => String(b.fechaRegistroISO ?? '').localeCompare(String(a.fechaRegistroISO ?? '')));
  }

  async findOne(id: string) {
    const snap = await this.fb.db.collection(COL).doc(id).get();
    if (!snap.exists) throw new NotFoundException(`Siembra ${id} no encontrada`);
    return mapId(this.fb.toObj(snap));
  }

  /** Registros creados por el usuario autenticado — para la sección "Mis registros" del perfil. */
  async findMine(userId: number | string) {
    const snap = await this.fb.db.collection(COL)
      .where('registradoPor.uid', '==', userId).limit(500).get();
    return this.fb.toDocs(snap)
      .map((r) => mapId(r))
      .sort((a, b) => String(b.fechaRegistroISO ?? '').localeCompare(String(a.fechaRegistroISO ?? '')));
  }

  async create(dto: CreateSiembraDto, user: { sub: string; email: string }) {
    if (dto.idempotencyKey) {
      const existing = await this.fb.db.collection(COL)
        .where('idempotencyKey', '==', dto.idempotencyKey).limit(1).get();
      if (!existing.empty) return mapId(this.fb.toObj(existing.docs[0]));
    }

    const doc = {
      idempotencyKey:   dto.idempotencyKey ?? null,
      tipo:             'siembra',
      campus:           dto.campus,
      fecha:            dto.fecha,
      encuentro:        dto.encuentro ?? '',
      montos:           this.buildMontos(dto.montos), // totales calculados en servidor
      observaciones:    dto.observaciones ?? '',
      registradoPor:    { uid: user.sub, email: user.email },
      fechaRegistro:    this.fb.now(),
      fechaRegistroISO: new Date().toISOString(),
    };

    const ref = await this.fb.db.collection(COL).add(doc);
    return this.findOne(ref.id);
  }

  async update(id: string, dto: UpdateSiembraDto, user: { sub: string; email: string }) {
    await this.findOne(id);
    const data: any = {
      editadoPor:   { uid: user.sub, email: user.email },
      fechaEdicion: this.fb.now(),
    };
    for (const k of ['fecha', 'encuentro', 'observaciones'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    // Reemplazo total del array (no upsert por línea) — recalculado en servidor.
    if (dto.montos !== undefined) data.montos = this.buildMontos(dto.montos);

    await this.fb.db.collection(COL).doc(id).update(data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(id).delete();
    return { id };
  }

  /**
   * Agregación para el dashboard "Siembras" del intranet: totales por moneda
   * (ofrendas/diezmos/otros, efectivo/sumup), serie por período (semana/mes),
   * y un total de referencia convertido a CLP/USD vía las tasas manuales de
   * TipoCambioService. Sin restricción por campus (se filtra solo si se pide).
   */
  async dashboard(year: number, groupBy: GroupBy, campus?: string) {
    const snap = await this.fb.db.collection(COL).limit(5000).get();
    const rows = this.fb.toDocs(snap)
      .map((r) => mapId(r))
      .filter((r) => String(r.fecha ?? '').slice(0, 4) === String(year))
      .filter((r) => !campus || r.campus === campus);

    const rates = await this.tipoCambio.findMap();
    const monedaCatalog = await this.armCatalogos.findActive('moneda');
    const labelByMoneda = new Map(monedaCatalog.map((m) => [m.key.toUpperCase(), m.label]));

    const periods = buildPeriods(year, groupBy);
    const periodByKey = new Map(periods.map((p) => [p.key, p]));

    const byCurrency = new Map<string, Totales & { moneda: string }>();
    const referenceClp = emptyTotales();
    const referenceUsd = emptyTotales();
    const missingRateCurrencies = new Set<string>();
    let legacyRecordCount = 0;

    for (const row of rows) {
      const montos = Array.isArray(row.montos) ? row.montos : [];
      const periodo = periodByKey.get(periodKey(String(row.fecha ?? ''), groupBy));
      let rowIsLegacy = false;

      for (const raw of montos) {
        const n = normalizeMonto(raw);
        if (!n.moneda) continue;
        if (n.isLegacy) rowIsLegacy = true;

        const acc = byCurrency.get(n.moneda) ?? { moneda: n.moneda, ...emptyTotales() };
        addLine(acc, n);
        byCurrency.set(n.moneda, acc);

        const rate = rates[n.moneda];
        if (!rate) { missingRateCurrencies.add(n.moneda); continue; }

        const usdFactor = 1 / rate;
        addLine(referenceUsd, n, usdFactor);
        if (periodo) periodo.referenceUSD += n.total * usdFactor;

        const clpRate = rates.CLP;
        if (clpRate) {
          addLine(referenceClp, n, usdFactor * clpRate);
          if (periodo) periodo.referenceCLP += n.total * usdFactor * clpRate;
        }
      }
      if (rowIsLegacy) legacyRecordCount++;
    }

    const currencies = Array.from(byCurrency.values())
      .map((acc) => ({ ...acc, label: labelByMoneda.get(acc.moneda) ?? acc.moneda, hasRate: !!rates[acc.moneda] }))
      .sort((a, b) => a.moneda.localeCompare(b.moneda));

    const missingList = Array.from(missingRateCurrencies);
    const clpMissingList = rates.CLP ? missingList : Array.from(new Set([...missingList, 'CLP']));

    return {
      meta: {
        year, groupBy, campus: campus ?? null,
        generatedAt: new Date().toISOString(),
        recordCount: rows.length,
        legacyRecordCount,
      },
      currencies,
      reference: {
        clp: { ...referenceClp, missingRateCurrencies: clpMissingList },
        usd: { ...referenceUsd, missingRateCurrencies: missingList },
      },
      periods: periods.map((p) => ({
        key: p.key, label: p.label, start: p.start, end: p.end,
        referenceCLP: p.referenceCLP, referenceUSD: p.referenceUSD,
      })),
      fxRates: await this.tipoCambio.findAll(),
    };
  }
}
