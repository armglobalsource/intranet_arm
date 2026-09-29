import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { UpdateTipoCambioDto } from './dto/tipo-cambio.dto';

const COL = 'tipo_cambio';
const API_DOC = '_api';        // tasas completas de la API pública (unidades por 1 USD)
const REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
const API_URL = 'https://open.er-api.com/v6/latest/USD';

export interface TasaClp {
  moneda: string;
  /** Pesos chilenos por 1 unidad de la moneda (null si no hay tasa disponible). */
  clpPorUnidad: number | null;
  fuente: 'api' | 'manual';
  updatedAt: string | null;
}

@Injectable()
export class TipoCambioService {
  private readonly logger = new Logger(TipoCambioService.name);

  constructor(private fb: FirebaseService) {}

  /** Tasa en CLP de cada moneda pedida. Un ajuste manual tiene prioridad sobre la API. */
  async getTasasClp(monedas: string[]): Promise<{ tasas: Record<string, TasaClp>; actualizadoApi: string | null }> {
    const api = await this.ensureFresh();
    const snap = await this.fb.db.collection(COL).get();
    const manuales = new Map<string, any>();
    for (const doc of snap.docs) {
      const d = doc.data();
      if (doc.id !== API_DOC && d.source === 'manual' && Number(d.clpPorUnidad) > 0) manuales.set(doc.id, d);
    }

    const rates: Record<string, number> = api?.rates ?? {};
    const apiAt = api?.fetchedAt?.toDate?.()?.toISOString?.() ?? null;
    const tasas: Record<string, TasaClp> = {};
    for (const raw of monedas) {
      const moneda = raw.trim().toUpperCase();
      if (moneda === 'CLP') continue;
      const manual = manuales.get(moneda);
      if (manual) {
        tasas[moneda] = {
          moneda, clpPorUnidad: Number(manual.clpPorUnidad), fuente: 'manual',
          updatedAt: manual.updatedAt?.toDate?.()?.toISOString?.() ?? null,
        };
        continue;
      }
      const porUsd = moneda === 'USD' ? 1 : Number(rates[moneda]);
      const clpPorUsd = Number(rates.CLP);
      tasas[moneda] = {
        moneda,
        clpPorUnidad: porUsd > 0 && clpPorUsd > 0 ? clpPorUsd / porUsd : null,
        fuente: 'api',
        updatedAt: apiAt,
      };
    }
    return { tasas, actualizadoApi: apiAt };
  }

  async setManual(moneda: string, dto: UpdateTipoCambioDto, user: { sub: string; email: string }) {
    const codigo = moneda.trim().toUpperCase();
    await this.fb.db.collection(COL).doc(codigo).set({
      moneda: codigo,
      clpPorUnidad: dto.clpPorUnidad,
      source: 'manual',
      updatedAt: this.fb.now(),
      updatedBy: { uid: user.sub, email: user.email },
    });
    return { moneda: codigo, clpPorUnidad: dto.clpPorUnidad, fuente: 'manual' };
  }

  /** Quita el ajuste manual: la moneda vuelve a usar la tasa automática. */
  async clearManual(moneda: string) {
    const codigo = moneda.trim().toUpperCase();
    await this.fb.db.collection(COL).doc(codigo).delete();
    return { moneda: codigo, fuente: 'api' };
  }

  private async ensureFresh() {
    const snap = await this.fb.db.collection(COL).doc(API_DOC).get();
    const current = snap.exists ? snap.data() : undefined;
    const fetchedAt = current?.fetchedAt?.toMillis?.() ?? 0;
    if (Date.now() - fetchedAt < REFRESH_TTL_MS) return current;
    try {
      return await this.refreshFromApi();
    } catch (e) {
      this.logger.warn(`No se pudo actualizar el tipo de cambio: ${(e as Error).message}`);
      return current;
    }
  }

  async refreshFromApi() {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`La API de tipo de cambio respondió ${res.status}`);
    const body = await res.json();
    const rates: Record<string, number> = body?.rates ?? {};
    if (!(Number(rates.CLP) > 0)) throw new Error('La API de tipo de cambio no devolvió la tasa CLP');

    const doc = { rates, fetchedAt: this.fb.ts(new Date()) };
    await this.fb.db.collection(COL).doc(API_DOC).set(doc);
    this.logger.log(`Tipo de cambio actualizado: 1 USD = ${rates.CLP} CLP`);
    return doc;
  }
}
