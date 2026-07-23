import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { Periodo, mapId, sumCounts, inPeriodo, inMonth } from '../common/arm-records.util';
import { CreateEncuentroDto, UpdateEncuentroDto } from './dto/encuentro.dto';
import { CampusService } from '../campus/campus.service';

const COL = 'encuentros';

export interface ResumenTipo {
  count:            number;
  totalAsistencia:  number;
  decisiones:       number;
  totalVoluntarios: number;
}

export interface EncuentrosResumen {
  encuentros: ResumenTipo;
  eventos:    ResumenTipo;
}

@Injectable()
export class EncuentrosService {
  constructor(
    private fb: FirebaseService,
    private campuses: CampusService,
  ) {}

  // ── Lectura ──────────────────────────────────────────────────────────────

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
    if (!snap.exists) throw new NotFoundException(`Encuentro ${id} no encontrado`);
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

  /** Resumen agregado (decisiones, voluntarios, asistencia) por campus y período, separado encuentro/evento. */
  async resumen(campus: string, year: number, month?: number): Promise<EncuentrosResumen> {
    const snap = await this.fb.db.collection(COL).where('campus', '==', campus).limit(2000).get();
    const rows = this.fb.toDocs(snap).filter((r) => inMonth(r.fecha, year, month));

    const empty = (): ResumenTipo => ({ count: 0, totalAsistencia: 0, decisiones: 0, totalVoluntarios: 0 });
    const acc: EncuentrosResumen = { encuentros: empty(), eventos: empty() };

    for (const r of rows) {
      const bucket = r.tipo === 'evento' ? acc.eventos : acc.encuentros;
      bucket.count += 1;
      bucket.totalAsistencia += r.totalAsistencia ?? 0;
      bucket.totalVoluntarios += r.totalVoluntarios ?? 0;
      bucket.decisiones += (r.presencial?.acepto ?? 0) + (r.online?.acepto ?? 0);
    }

    return acc;
  }

  // ── Escritura ──────────────────────────────────────────────────────────────

  async create(dto: CreateEncuentroDto, user: { sub: string; email: string }) {
    // Idempotencia: si ya existe un registro con esta clave, devolverlo (no duplicar).
    if (dto.idempotencyKey) {
      const existing = await this.fb.db.collection(COL)
        .where('idempotencyKey', '==', dto.idempotencyKey)
        .limit(1).get();
      if (!existing.empty) return mapId(this.fb.toObj(existing.docs[0]));
    }

    const now = new Date();
    const isEvento = dto.tipo === 'evento';
    const campus = await this.campuses.findByName(dto.campus);

    const doc = {
      idempotencyKey:   dto.idempotencyKey ?? null,
      tipo:             dto.tipo,
      campusId:         campus.id,
      campus:           dto.campus,
      fecha:            dto.fecha,
      encuentro:        isEvento ? (dto.eventoHorario || 'Evento') : (dto.encuentro ?? ''),
      modalidad:        dto.modalidad ?? '',
      predicador:       dto.predicador ?? '',
      mensaje:          dto.mensaje ?? '',
      lideres:          dto.lideres ?? '',
      adm:              dto.adm ?? '',
      eventoNombre:     isEvento ? (dto.eventoNombre ?? '') : '',
      eventoDesc:       isEvento ? (dto.eventoDesc ?? '') : '',
      eventoHorario:    isEvento ? (dto.eventoHorario ?? '') : '',
      // Objetos planos: los DTO anidados son instancias de clase (class-transformer)
      // y Firestore no serializa objetos con prototipo custom.
      presencial:       { acepto: dto.presencial?.acepto ?? 0, total: dto.presencial?.total ?? 0 },
      online:           { acepto: dto.online?.acepto ?? 0, espectadores: dto.online?.espectadores ?? 0 },
      asistencia:       { ...(dto.asistencia ?? {}) },
      voluntarios:      { ...(dto.voluntarios ?? {}) },
      // Totales calculados en el servidor — nunca se confía en el cliente
      totalAsistencia:  sumCounts(dto.asistencia),
      totalVoluntarios: sumCounts(dto.voluntarios),
      // Trazabilidad automática desde el JWT
      registradoPor:    { uid: user.sub, email: user.email },
      fechaRegistro:    this.fb.now(),
      fechaRegistroISO: now.toISOString(),
    };

    const ref = await this.fb.db.collection(COL).add(doc);
    return this.findOne(ref.id);
  }

  async update(id: string, dto: UpdateEncuentroDto, user: { sub: string; email: string }) {
    const current = await this.findOne(id);

    const data: any = {
      editadoPor:   { uid: user.sub, email: user.email },
      fechaEdicion: this.fb.now(),
    };
    for (const k of ['fecha', 'encuentro', 'modalidad', 'predicador', 'mensaje',
      'lideres', 'adm', 'eventoNombre', 'eventoDesc', 'eventoHorario'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.presencial !== undefined) {
      data.presencial = { acepto: dto.presencial.acepto ?? 0, total: dto.presencial.total ?? 0 };
    }
    if (dto.online !== undefined) {
      data.online = { acepto: dto.online.acepto ?? 0, espectadores: dto.online.espectadores ?? 0 };
    }
    if (dto.asistencia !== undefined) {
      data.asistencia = { ...dto.asistencia };
      data.totalAsistencia = sumCounts(dto.asistencia);
    }
    if (dto.voluntarios !== undefined) {
      data.voluntarios = { ...dto.voluntarios };
      data.totalVoluntarios = sumCounts(dto.voluntarios);
    }

    await this.fb.db.collection(COL).doc(id).update(data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(id).delete();
    return { id };
  }
}
