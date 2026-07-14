import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { mapId } from '../common/arm-records.util';
import { CreateAnuncioDto, UpdateAnuncioDto } from './dto/anuncio.dto';

const COL = 'anuncios';

@Injectable()
export class AnunciosService {
  constructor(private fb: FirebaseService) {}

  private noVencido(a: any): boolean {
    if (!a.vence) return true;
    const v = new Date(a.vence);
    if (isNaN(v.getTime())) return true;
    // vigente si vence hoy o después
    return v >= new Date(new Date().toDateString());
  }

  /** Todos (para administración). */
  async findAll(campusId?: string) {
    let query: FirebaseFirestore.Query = this.fb.db.collection(COL);
    if (campusId) query = query.where('campus', '==', campusId);
    const snap = await query.limit(500).get();
    return this.fb.toDocs(snap)
      .map((r) => mapId(r))
      .sort((a, b) => String(b.fechaCreacionISO ?? '').localeCompare(String(a.fechaCreacionISO ?? '')));
  }

  /** Activos y no vencidos, para un campus (incluye los de 'todos'). */
  async findActive(campus?: string) {
    const snap = await this.fb.db.collection(COL).where('activo', '==', true).get();
    return this.fb.toDocs(snap)
      .map((r) => mapId(r))
      .filter((a: any) => this.noVencido(a))
      .filter((a: any) => !campus || a.campus === 'todos' || a.campus === campus)
      .sort((a, b) => String(b.fechaCreacionISO ?? '').localeCompare(String(a.fechaCreacionISO ?? '')));
  }

  async findOne(id: string) {
    const snap = await this.fb.db.collection(COL).doc(id).get();
    if (!snap.exists) throw new NotFoundException(`Anuncio ${id} no encontrado`);
    return mapId(this.fb.toObj(snap));
  }

  async create(dto: CreateAnuncioDto, user: { sub: string; email: string }) {
    const doc = {
      titulo:           dto.titulo,
      texto:            dto.texto,
      campus:           dto.campus ?? 'todos',
      vence:            dto.vence || null,
      activo:           true,
      creadoPor:        { uid: user.sub, email: user.email },
      fechaCreacion:    this.fb.now(),
      fechaCreacionISO: new Date().toISOString(),
    };
    const ref = await this.fb.db.collection(COL).add(doc);
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
    await this.fb.db.collection(COL).doc(id).update(data);
    return this.findOne(id);
  }

  /** Baja lógica (activo=false) — equivale a "archivar" el anuncio. */
  async deactivate(id: string) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(id).update({ activo: false });
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(id).delete();
    return { id };
  }
}
