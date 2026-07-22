import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { Periodo, mapId, inPeriodo } from '../common/arm-records.util';
import { CreateSiembraDto, UpdateSiembraDto, MontoDto, MetodoPagoDto, AporteDto } from './dto/siembra.dto';

const COL = 'siembra';

@Injectable()
export class SiembraService {
  constructor(private fb: FirebaseService) {}

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
}
