import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ArmRecordStore } from '../common/database/arm-record-store';
import { Periodo, mapId, sumCounts, inPeriodo, inMonth } from '../common/arm-records.util';
import { CreateEncuentroDto, UpdateEncuentroDto } from './dto/encuentro.dto';
import { PostgresCampusService } from '../campus/postgres-campus.service';
import { allCampus, assertRecordCampus, RecordUser, sameEncuentroLabel } from './encuentros.scope';
import { hasPermission } from '../common/permissions';
import { doubtfulDates, nowInSantiago, pendingEncuentros } from './encuentros.pending';
import { canDeleteReport, canEditReport, canReview, estadoDe, isUploaded } from './encuentros.review';
import { validDay } from '../estadisticas/statistics-range';
import { PostgresNotificationsService } from '../notifications/postgres-notifications.service';

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
    @Optional() private notifications?: PostgresNotificationsService,
  ) {}
  private readonly logger = new Logger(PostgresEncuentrosService.name);

  /** Estado de revisión calculado (los importados de Asana cuentan como subidos). */
  private withEstado<T extends { id?: string; estado?: string }>(r: T) { return { ...r, estado: estadoDe(r) }; }

  /** Avisos de revisión: nunca impiden guardar el reporte. */
  private async notify(task: () => Promise<unknown> | undefined) {
    try { await task(); } catch (error) { this.logger.warn(`No se pudo enviar la notificación: ${(error as Error).message}`); }
  }

  // ── Lectura ──────────────────────────────────────────────────────────────

  async findAll(campusId?: string, periodo: Periodo = 'todo') {
    return (await this.store.list(COL,{campus:campusId}))
      .map((r) => this.withEstado(mapId(r)))
      .filter((r) => inPeriodo(r.fecha, periodo, r.fechaPrecision))
      .sort((a, b) => String(b.fechaRegistroISO ?? '').localeCompare(String(a.fechaRegistroISO ?? '')));
  }

  async findOne(id: string) {
    return this.withEstado(mapId<any>(await this.store.find(COL,id)));
  }

  async findOneFor(id: string, user: RecordUser) {
    const record = await this.findOne(id);
    const campus = await this.campuses.findOne(Number(record.campusId));
    if (canReview(user, campus)) return record;
    const mine = String(record.registradoPor?.uid ?? '') === String(user.sub);
    if (!mine && !hasPermission(user.permissions ?? [], 'encuentros:view')) throw new ForbiddenException('No tienes acceso a este reporte');
    assertRecordCampus(record, user);
    return record;
  }

  /** Registros creados por el usuario autenticado — para la sección "Mis registros" del perfil. */
  async findMine(userId: number | string) {
    return (await this.store.list(COL,{userId}))
      .map((r) => this.withEstado(mapId(r)))
      .sort((a, b) => String(b.fechaRegistroISO ?? '').localeCompare(String(a.fechaRegistroISO ?? '')));
  }

  /** Resumen agregado (decisiones, voluntarios, asistencia) por campus y período, separado encuentro/evento. */
  async resumen(campus: string, year: number, month?: number): Promise<EncuentrosResumen> {
    const rows = (await this.store.list(COL,{campus})).filter(isUploaded).filter((r) => inMonth(r.fecha, year, month));

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
    if (!validDay(dto.fecha)) throw new BadRequestException('Ingresa una fecha válida con formato AAAA-MM-DD');
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
        && !(dto.idempotencyKey && r.idempotencyKey === dto.idempotencyKey && String(r.registradoPor?.uid) === String(user.sub)));
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
      presencial:       { acepto: dto.presencial?.acepto ?? 0, total: sumCounts(dto.asistencia) + sumCounts(dto.voluntarios) },
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

    const ref = await this.store.create(COL,{ ...doc, estado: 'enviado' });
    const created = await this.findOne(ref.id);
    // Un reintento con la misma clave devuelve el registro anterior: solo se avisa cuando esta llamada lo creó.
    if (created.fechaRegistroISO === doc.fechaRegistroISO) {
      await this.notify(() => this.notifications?.createForCampusPermission(Number(campus.id), 'encuentros:review', campus.adminIds ?? [], {
        title: 'Reporte por revisar',
        body: `${created.encuentro} del ${created.fecha} (${campus.name}) espera tu revisión.`,
        link: '/dashboard/produccion-general/estadisticas/revisar',
      }));
    }
    return created;
  }

  async update(id: string, dto: UpdateEncuentroDto, user: RecordUser) {
    const current = await this.findOne(id);
    const campus = await this.campuses.findOne(Number(current.campusId));
    const reviewer = canReview(user, campus);
    const denied = canEditReport(user, current, reviewer);
    if (denied) throw new ForbiddenException(denied);
    if (dto.fecha !== undefined && !validDay(dto.fecha)) throw new BadRequestException('Ingresa una fecha válida con formato AAAA-MM-DD');
    if (current.fechaPrecision === 'mes' && dto.fecha !== undefined && dto.fecha !== current.fecha) {
      throw new BadRequestException('Este histórico solo tiene mes conocido; no se puede asignar un día desde este formulario');
    }
    if (current.tipo !== 'evento' && (dto.fecha !== undefined || dto.encuentro !== undefined)) {
      const fecha = dto.fecha ?? current.fecha;
      const duplicate = (await this.store.list(COL, { campus: current.campus, start: fecha, end: `${fecha}T23:59:59.999Z` }))
        .find((r) => r.id !== id && r.fechaPrecision !== 'mes' && r.tipo !== 'evento' && sameEncuentroLabel(r.encuentro, dto.encuentro ?? current.encuentro));
      if (current.fechaPrecision !== 'mes' && duplicate) throw new ConflictException('Ya existe un reporte de ese encuentro y fecha');
    }

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
    if (dto.presencial !== undefined || dto.asistencia !== undefined || dto.voluntarios !== undefined) {
      data.presencial = {
        ...(current.presencial ?? {}), ...(data.presencial ?? {}),
        total: (data.totalAsistencia ?? current.totalAsistencia ?? sumCounts(current.asistencia))
          + (data.totalVoluntarios ?? current.totalVoluntarios ?? sumCounts(current.voluntarios)),
      };
    }

    // Un reporte observado que corrige quien lo envió vuelve a quedar por revisar.
    const resubmitted = !reviewer && current.estado === 'observado';
    if (resubmitted) Object.assign(data, { estado: 'enviado', observacion: null });
    await this.store.update(COL,id,data,current);
    const updated = await this.findOne(id);
    if (resubmitted) {
      await this.notify(() => this.notifications?.createForCampusPermission(Number(campus.id), 'encuentros:review', campus.adminIds ?? [], {
        title: 'Reporte corregido por revisar',
        body: `${updated.encuentro} del ${updated.fecha} (${campus.name}) fue corregido y espera tu revisión.`,
        link: '/dashboard/produccion-general/estadisticas/revisar',
      }));
    }
    return updated;
  }

  async remove(id: string, user: RecordUser) {
    const current = await this.findOne(id);
    const campus = await this.campuses.findOne(Number(current.campusId));
    const denied = canDeleteReport(user, current, canReview(user, campus));
    if (denied) throw new ForbiddenException(denied);
    await this.store.remove(COL,id,current);
    return { id };
  }

  // ── Revisión del administrador del campus ────────────────────────────────

  /** Reportes por revisar u observados de los campus que el usuario puede revisar. */
  async revision(user: RecordUser) {
    const campuses = (await this.campuses.findAll()).filter((c: any) => c.isActive !== false && canReview(user, c));
    if (!campuses.length) return { campusIds: [], items: [] };
    const all = campuses.length > 1;
    // Un pendiente no caduca por la fecha del encuentro; incluye cargas tardías.
    const rows = await this.store.list(COL, all ? {} : { campus: campuses[0].name });
    const ids = new Set(campuses.map((c: any) => String(c.id)));
    const items = rows
      .map((r) => this.withEstado(mapId<any>(r)))
      .filter((r) => r.estado !== 'subido' && ids.has(String(r.campusId)))
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return { campusIds: campuses.map((c: any) => Number(c.id)), items };
  }

  private async reviewable(id: string, user: RecordUser) {
    const current = await this.findOne(id);
    const campus = await this.campuses.findOne(Number(current.campusId));
    if (!canReview(user, campus)) throw new ForbiddenException('Solo el administrador del campus puede revisar este reporte');
    return { current, campus };
  }

  async subir(id: string, user: RecordUser) {
    const { current } = await this.reviewable(id, user);
    await this.store.update(COL, id, { estado: 'subido', observacion: null, revisadoPor: { uid: user.sub, email: user.email }, fechaRevision: new Date().toISOString() }, current);
    return this.findOne(id);
  }

  async observar(id: string, observacion: string, user: RecordUser) {
    const { current, campus } = await this.reviewable(id, user);
    const text = observacion.trim();
    if (!text) throw new BadRequestException('Escribe qué hay que corregir');
    await this.store.update(COL, id, { estado: 'observado', observacion: text, revisadoPor: { uid: user.sub, email: user.email }, fechaRevision: new Date().toISOString() }, current);
    const author = Number(current.registradoPor?.uid);
    if (Number.isFinite(author) && String(author) !== String(user.sub)) {
      await this.notify(() => this.notifications?.create({
        userId: author, title: 'Tu reporte tiene observaciones',
        body: `${current.encuentro} del ${current.fecha} (${campus.name}): ${text}`,
        link: `/dashboard/produccion-general/estadisticas/registrar?editar=${encodeURIComponent(id)}`,
      }, Number(user.sub)));
    }
    return this.findOne(id);
  }
}
