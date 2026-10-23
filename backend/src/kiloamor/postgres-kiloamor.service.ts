import { Injectable, NotFoundException } from '@nestjs/common';
import { ArmRecordStore } from '../common/database/arm-record-store';
import { Periodo, mapId, inPeriodo, inMonth } from '../common/arm-records.util';
import { CreateKiloamorDto, UpdateKiloamorDto } from './dto/kiloamor.dto';
import { PostgresCampusService } from '../campus/postgres-campus.service';

const COL = 'kiloamor';

export interface KiloamorResumen {
  count:      number;
  totalCajas: number;
}

@Injectable()
export class PostgresKiloamorService {
  constructor(
    private store: ArmRecordStore,
    private campuses: PostgresCampusService,
  ) {}

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

  /** Resumen agregado (cajas entregadas) por campus y período. */
  async resumen(campus: string, year: number, month?: number): Promise<KiloamorResumen> {
    const rows = (await this.store.list(COL,{campus})).filter((r) => inMonth(r.fecha, year, month));
    return rows.reduce<KiloamorResumen>((acc, r) => ({
      count:      acc.count + 1,
      totalCajas: acc.totalCajas + (r.cajas ?? 0),
    }), { count: 0, totalCajas: 0 });
  }

  async create(dto: CreateKiloamorDto, user: { sub: string; email: string }) {

    const campus = await this.campuses.findByName(dto.campus);
    const doc = {
      idempotencyKey:   dto.idempotencyKey ?? null,
      tipo:             'kiloamor',
      campusId:         campus.id,
      campus:           dto.campus,
      fecha:            dto.fecha,
      cajas:            dto.cajas ?? 0,
      nombre:           dto.nombre ?? '',
      apellido:         dto.apellido ?? '',
      telefono:         dto.telefono ?? '',
      observaciones:    dto.observaciones ?? '',
      registradoPor:    { uid: user.sub, email: user.email },
      fechaRegistro:    new Date().toISOString(),
      fechaRegistroISO: new Date().toISOString(),
    };

    const ref = await this.store.create(COL,doc);
    return this.findOne(ref.id);
  }

  async update(id: string, dto: UpdateKiloamorDto, user: { sub: string; email: string }) {
    await this.findOne(id);
    const data: any = {
      editadoPor:   { uid: user.sub, email: user.email },
      fechaEdicion: new Date().toISOString(),
    };
    for (const k of ['fecha', 'nombre', 'apellido', 'telefono', 'observaciones'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.cajas !== undefined) data.cajas = dto.cajas;
    await this.store.update(COL,id,data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.store.remove(COL,id);
    return { id };
  }
}
