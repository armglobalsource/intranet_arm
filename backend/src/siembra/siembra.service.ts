import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { Periodo, mapId, inPeriodo } from '../common/arm-records.util';
import { CreateSiembraDto, UpdateSiembraDto, MontoDto } from './dto/siembra.dto';

const COL = 'siembra';

@Injectable()
export class SiembraService {
  constructor(private fb: FirebaseService) {}

  /** Arma cada línea como objeto plano (no instancia de MontoDto) para que Firestore pueda serializarla. */
  private buildMontos(montos: MontoDto[]) {
    return montos.map((m) => ({
      moneda:   m.moneda,
      sumup:    m.sumup ?? 0,
      efectivo: m.efectivo ?? 0,
      diezmo:   m.diezmo ?? 0,
      total:    (m.sumup ?? 0) + (m.efectivo ?? 0) + (m.diezmo ?? 0),
    }));
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
