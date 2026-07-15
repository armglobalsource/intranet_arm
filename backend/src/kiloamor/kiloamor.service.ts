import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { Periodo, mapId, inPeriodo, inMonth } from '../common/arm-records.util';
import { CreateKiloamorDto, UpdateKiloamorDto } from './dto/kiloamor.dto';

const COL = 'kiloamor';

export interface KiloamorResumen {
  count:      number;
  totalCajas: number;
}

@Injectable()
export class KiloamorService {
  constructor(private fb: FirebaseService) {}

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
    if (!snap.exists) throw new NotFoundException(`Registro Kilo de Amor ${id} no encontrado`);
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

  /** Resumen agregado (cajas entregadas) por campus y período. */
  async resumen(campus: string, year: number, month?: number): Promise<KiloamorResumen> {
    const snap = await this.fb.db.collection(COL).where('campus', '==', campus).limit(2000).get();
    const rows = this.fb.toDocs(snap).filter((r) => inMonth(r.fecha, year, month));
    return rows.reduce<KiloamorResumen>((acc, r) => ({
      count:      acc.count + 1,
      totalCajas: acc.totalCajas + (r.cajas ?? 0),
    }), { count: 0, totalCajas: 0 });
  }

  async create(dto: CreateKiloamorDto, user: { sub: string; email: string }) {
    if (dto.idempotencyKey) {
      const existing = await this.fb.db.collection(COL)
        .where('idempotencyKey', '==', dto.idempotencyKey).limit(1).get();
      if (!existing.empty) return mapId(this.fb.toObj(existing.docs[0]));
    }

    const doc = {
      idempotencyKey:   dto.idempotencyKey ?? null,
      tipo:             'kiloamor',
      campus:           dto.campus,
      fecha:            dto.fecha,
      cajas:            dto.cajas ?? 0,
      nombre:           dto.nombre ?? '',
      apellido:         dto.apellido ?? '',
      telefono:         dto.telefono ?? '',
      observaciones:    dto.observaciones ?? '',
      registradoPor:    { uid: user.sub, email: user.email },
      fechaRegistro:    this.fb.now(),
      fechaRegistroISO: new Date().toISOString(),
    };

    const ref = await this.fb.db.collection(COL).add(doc);
    return this.findOne(ref.id);
  }

  async update(id: string, dto: UpdateKiloamorDto, user: { sub: string; email: string }) {
    await this.findOne(id);
    const data: any = {
      editadoPor:   { uid: user.sub, email: user.email },
      fechaEdicion: this.fb.now(),
    };
    for (const k of ['fecha', 'nombre', 'apellido', 'telefono', 'observaciones'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.cajas !== undefined) data.cajas = dto.cajas;
    await this.fb.db.collection(COL).doc(id).update(data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(id).delete();
    return { id };
  }
}
