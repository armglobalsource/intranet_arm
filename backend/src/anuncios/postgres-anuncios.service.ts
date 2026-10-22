import { Injectable, NotFoundException } from '@nestjs/common';
import { ArmRecordStore } from '../common/database/arm-record-store';
import { mapId } from '../common/arm-records.util';
import { CreateAnuncioDto, UpdateAnuncioDto } from './dto/anuncio.dto';

const COL = 'anuncios';

@Injectable()
export class PostgresAnunciosService {
  constructor(private store: ArmRecordStore) {}

  private noVencido(a: any): boolean {
    if (!a.vence) return true;
    const v = new Date(a.vence);
    if (isNaN(v.getTime())) return true;
    // vigente si vence hoy o después
    return v >= new Date(new Date().toDateString());
  }

  /** Todos (para administración). */
  async findAll(campusId?: string) {
    return (await this.store.list(COL,{campus:campusId}))
      .map((r) => mapId(r))
      .sort((a, b) => String(b.fechaCreacionISO ?? '').localeCompare(String(a.fechaCreacionISO ?? '')));
  }

  /** Activos y no vencidos, para un campus (incluye los de 'todos'). */
  async findActive(campus?: string) {
    return (await this.store.list(COL,{active:true}))
      .map((r) => mapId(r))
      .filter((a: any) => this.noVencido(a))
      .filter((a: any) => !campus || a.campus === 'todos' || a.campus === campus)
      .sort((a, b) => String(b.fechaCreacionISO ?? '').localeCompare(String(a.fechaCreacionISO ?? '')));
  }

  async findOne(id: string) {
    return mapId(await this.store.find(COL,id));
  }

  async create(dto: CreateAnuncioDto, user: { sub: string; email: string }) {
    const doc = {
      titulo:           dto.titulo,
      texto:            dto.texto,
      campus:           dto.campus ?? 'todos',
      vence:            dto.vence || null,
      activo:           true,
      creadoPor:        { uid: user.sub, email: user.email },
      fechaCreacion:    new Date().toISOString(),
      fechaCreacionISO: new Date().toISOString(),
    };
    const ref = await this.store.create(COL,doc);
    // TODO(push): disparar notificación push (módulo notifications) segmentada
    // por campus/rol al publicar. Ver plan Fase 2.
    return this.findOne(ref.id);
  }

  async update(id: string, dto: UpdateAnuncioDto) {
    await this.findOne(id);
    const data: any = {};
    for (const k of ['titulo', 'texto', 'campus'] as const) {
      if (dto[k] !== undefined) data[k] = dto[k];
    }
    if (dto.vence !== undefined) data.vence = dto.vence || null;
    await this.store.update(COL,id,data);
    return this.findOne(id);
  }

  /** Baja lógica (activo=false) — equivale a "archivar" el anuncio. */
  async deactivate(id: string) {
    await this.findOne(id);
    await this.store.update(COL,id,{ activo: false });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.store.remove(COL,id);
    return { id };
  }
}
