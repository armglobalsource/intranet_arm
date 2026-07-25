import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { ArmCatalogosService } from '../arm-catalogos/arm-catalogos.service';
import { UpdateTipoCambioDto } from './dto/tipo-cambio.dto';

const COL = 'tipo_cambio';
const META_DOC = '_meta';
const REFRESH_TTL_MS = 24 * 60 * 60 * 1000; // una vez al día
const API_URL = 'https://open.er-api.com/v6/latest/USD';

@Injectable()
export class TipoCambioService {
  private readonly logger = new Logger(TipoCambioService.name);

  constructor(
    private fb: FirebaseService,
    private armCatalogos: ArmCatalogosService,
  ) {}

  async findAll() {
    await this.ensureFresh();
    const snap = await this.fb.db.collection(COL).get();
    return this.fb.toDocs(snap)
      .filter((r) => r.fichaId !== META_DOC)
      .sort((a, b) => String(a.moneda).localeCompare(String(b.moneda)));
  }

  /** moneda -> unitsPerUSD, para que SiembraService convierta sin ida y vuelta a Firestore. */
  async findMap(): Promise<Record<string, number>> {
    const rows = await this.findAll();
    return Object.fromEntries(rows.map((r) => [r.moneda, Number(r.unitsPerUSD) || 0]));
  }

  async upsert(moneda: string, dto: UpdateTipoCambioDto, user: { sub: string; email: string }) {
    const codigo = moneda.trim().toUpperCase();
    const doc = {
      moneda: codigo,
      unitsPerUSD: dto.unitsPerUSD,
      source: 'manual',
      updatedAt: this.fb.now(),
      updatedBy: { uid: user.sub, email: user.email },
    };
    await this.fb.db.collection(COL).doc(codigo).set(doc, { merge: true });
    return this.fb.toObj(await this.fb.db.collection(COL).doc(codigo).get());
  }

  /**
   * Refresca automáticamente si el último fetch pasó el TTL (una vez al día).
   * No bloquea si la API pública falla — se queda con lo que ya había en Firestore.
   */
  private async ensureFresh() {
    const metaSnap = await this.fb.db.collection(COL).doc(META_DOC).get();
    const lastRefreshedAt = metaSnap.exists ? metaSnap.data()!.lastRefreshedAt?.toMillis?.() ?? 0 : 0;
    if (Date.now() - lastRefreshedAt < REFRESH_TTL_MS) return;

    try {
      await this.refreshFromApi();
    } catch (e) {
      this.logger.warn(`No se pudo refrescar tasas de cambio desde la API pública: ${(e as Error).message}`);
    }
  }

  /**
   * Trae tasas frescas (unidades por 1 USD) desde una API pública gratuita y
   * las guarda para cada moneda que el sistema realmente usa (catálogo
   * `arm_catalogos` tipo=moneda), sin necesitar API key. Los códigos que la
   * API no reconozca se dejan tal cual estaban (no se pisan a ciegas).
   */
  async refreshFromApi(): Promise<{ updated: string[]; skipped: string[] }> {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`API de tipo de cambio respondió ${res.status}`);
    const body = await res.json();
    const rates: Record<string, number> = body?.rates ?? {};
    if (!Object.keys(rates).length) throw new Error('La API de tipo de cambio no devolvió tasas');

    const monedas = await this.armCatalogos.findActive('moneda');
    const updated: string[] = [];
    const skipped: string[] = [];

    for (const m of monedas) {
      const codigo = m.key.trim().toUpperCase();
      const unitsPerUSD = codigo === 'USD' ? 1 : rates[codigo];
      if (!unitsPerUSD) { skipped.push(codigo); continue; }

      await this.fb.db.collection(COL).doc(codigo).set({
        moneda: codigo,
        unitsPerUSD,
        source: 'api',
        updatedAt: this.fb.now(),
      }, { merge: true });
      updated.push(codigo);
    }

    await this.fb.db.collection(COL).doc(META_DOC).set({ lastRefreshedAt: this.fb.now() }, { merge: true });
    this.logger.log(`Tasas de cambio actualizadas: ${updated.join(', ') || '(ninguna)'}`);
    return { updated, skipped };
  }
}
