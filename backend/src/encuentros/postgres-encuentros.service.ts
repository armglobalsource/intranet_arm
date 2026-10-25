import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ArmRecordStore } from '../common/database/arm-record-store';
import { Periodo, mapId, sumCounts, inPeriodo, inMonth } from '../common/arm-records.util';
import { CreateEncuentroDto, UpdateEncuentroDto } from './dto/encuentro.dto';
import { PostgresCampusService } from '../campus/postgres-campus.service';
import { allCampus, RecordUser, sameEncuentroLabel } from './encuentros.scope';
import { doubtfulDates, nowInSantiago, pendingEncuentros } from './encuentros.pending';

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
export class PostgresEncuentrosService {
  constructor(
    private store: ArmRecordStore,
    private campuses: PostgresCampusService,
  ) {}

  // ── Lectura ──────────────────────────────────────────────────────────────

  async findAll(campusId?: string, periodo: Periodo = 'todo') {
    return (await this.store.list(COL,{campus:campusId}))
      .map((r) => mapId(r))
      .filter((r) => inPeriodo(r.fecha, periodo))
      .sort((a, b) => String(b.fechaRegistroISO ?? '').localeCompare(String(a.fechaRegistroISO ?? '')));
  }

  async findOne(id: string) {
    return mapId(await this.store.find(COL,id));
  }

  /** Registros creados por el usuario autenticado — para la sección "Mis registros" del perfil. */
  async findMine(userId: number | string) {
    return (await this.store.list(COL,{userId}))
      .map((r) => mapId(r))
      .sort((a, b) => String(b.fechaRegistroISO ?? '').localeCompare(String(a.fechaRegistroISO ?? '')));
  }

  /** Resumen agregado (decisiones, voluntarios, asistencia) por campus y período, separado encuentro/evento. */
  async resumen(campus: string, year: number, month?: number): Promise<EncuentrosResumen> {
    const rows = (await this.store.list(COL,{campus})).filter((r) => inMonth(r.fecha, year, month));

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

  /**
   * Encuentros de los últimos `days` días que según los horarios debieron ocurrir y no tienen
   * registro, y registros del mismo período cuya fecha no calza con el día que dice su nombre.
   */
  async pendientes(user: RecordUser, days = 14) {
    const all = allCampus(user);
    if (!all && user.campusId == null) return { pendientes: [], revisar: [] };
    const now = nowInSantiago();
    const start = new Date(`${now.date}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const from = start.toISOString().slice(0, 10);
    const campuses = all ? await this.campuses.findAll() : [await this.campuses.findOne(Number(user.campusId))];
    const records = await this.store.list(COL, { campus: all ? undefined : campuses[0].name, start: from, end: `${now.date}T23:59:59.999Z` });
    return { pendientes: pendingEncuentros(campuses, records, from, now.date, now), revisar: doubtfulDates(records, campuses) };
  }

  // ── Escritura ──────────────────────────────────────────────────────────────

  async create(dto: CreateEncuentroDto, user: RecordUser) {
    // Idempotencia: si ya existe un registro con esta clave, el store lo devuelve (no duplica).

    const now = new Date();
    const isEvento = dto.tipo === 'evento';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.fecha)) throw new BadRequestException('La fecha debe tener el formato AAAA-MM-DD');
    let campus: any;
    if (allCampus(user)) campus = await this.campuses.findByName(dto.campus);
    else {
      // Cada campus reporta lo suyo: el campus sale de la cuenta, no del formulario.
      if (user.campusId == null) throw new BadRequestException('Tu cuenta no tiene un campus asignado');
      campus = await this.campuses.findOne(Number(user.campusId));
      if (dto.campus && dto.campus.trim().toLowerCase() !== String(campus.name).trim().toLowerCase()) {
        throw new ForbiddenException('Solo puedes registrar encuentros de tu campus');
      }
    }
    if (!isEvento && dto.encuentro?.trim()) {
      const duplicate = (await this.store.list(COL,{campus:campus.name,start:dto.fecha,end:`${dto.fecha}T23:59:59.999Z`})).find((r) =>
        r.tipo !== 'evento' && String(r.fecha ?? '').slice(0,10) === dto.fecha && sameEncuentroLabel(r.encuentro, dto.encuentro)
        && !(dto.idempotencyKey && r.idempotencyKey === dto.idempotencyKey));
      if (duplicate) throw new ConflictException(`Ya existe un registro de «${dto.encuentro}» del ${dto.fecha}. Edítalo en vez de crear otro.`);
    }

    const doc = {
      idempotencyKey:   dto.idempotencyKey ?? null,
      tipo:             dto.tipo,
      campusId:         campus.id,
      campus:           campus.name,
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
      fechaRegistro:    new Date().toISOString(),
      fechaRegistroISO: now.toISOString(),
    };

    const ref = await this.store.create(COL,doc);
    return this.findOne(ref.id);
  }

  async update(id: string, dto: UpdateEncuentroDto, user: { sub: string | number; email: string }) {
    const current = await this.findOne(id);

    const data: any = {
      editadoPor:   { uid: user.sub, email: user.email },
      fechaEdicion: new Date().toISOString(),
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

    await this.store.update(COL,id,data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.store.remove(COL,id);
    return { id };
  }
}
