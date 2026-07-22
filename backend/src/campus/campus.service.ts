import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { ArmCatalogosService } from '../arm-catalogos/arm-catalogos.service';
import { CreateCampusDto, ScheduleDto, UpdateCampusDto } from './dto/campus.dto';

const COL = 'campuses';

/** Objetos planos: los ScheduleDto son instancias de clase (class-transformer) y
 *  Firestore no serializa objetos con prototipo custom — mismo fix que encuentros.service.ts. */
function plainSchedules(schedules: ScheduleDto[]) {
  return schedules.map((s) => ({ ...s }));
}

@Injectable()
export class CampusService {
  constructor(
    private fb:           FirebaseService,
    private armCatalogos: ArmCatalogosService,
  ) {}

  /** Todas las claves activas de un catálogo ARM — default cuando un campus no especifica su selección. */
  private async allActiveKeys(tipo: 'asistencia' | 'voluntarios' | 'moneda'): Promise<string[]> {
    const entries = await this.armCatalogos.findActive(tipo);
    return entries.map((e) => e.key);
  }

  async findAll() {
    const snap = await this.fb.db.collection(COL).orderBy('name').get();
    const all = this.fb.toDocs(snap);
    return all.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || a.name.localeCompare(b.name));
  }

  async findActive() {
    const snap = await this.fb.db.collection(COL).get();
    return this.fb.toDocs(snap)
      .filter((c) => c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ id, name, siglas, address, country, phone, schedules, monedaCodes }) => ({ id, name, siglas, address, country, phone, schedules: schedules ?? [], monedaCodes: monedaCodes ?? [] }));
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Campus con id ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async create(dto: CreateCampusDto) {
    const name = dto.name.trim();
    const snap = await this.fb.db.collection(COL)
      .where('nameLower', '==', name.toLowerCase())
      .limit(1).get();
    if (!snap.empty) throw new ConflictException(`Ya existe un campus con el nombre "${name}"`);

    // Si el admin no especifica su selección de categorías/monedas, el campus parte con
    // TODAS las claves activas habilitadas — hoy todo campus las usa implícitamente
    // (están hardcodeadas para todos), así que este default preserva el comportamiento
    // actual sin requerir acción manual; el admin solo necesita desmarcar lo que no aplique.
    const asistenciaCategoriaKeys = dto.asistenciaCategoriaKeys ?? await this.allActiveKeys('asistencia');
    const voluntarioCategoriaKeys = dto.voluntarioCategoriaKeys ?? await this.allActiveKeys('voluntarios');
    const monedaCodes             = dto.monedaCodes             ?? await this.allActiveKeys('moneda');

    const id = await this.fb.nextId(COL);
    const doc = {
      id,
      name,
      nameLower:    name.toLowerCase(),
      siglas:       dto.siglas?.trim()      ?? null,
      address:      dto.address?.trim()     ?? null,
      city:         dto.city?.trim()        ?? null,
      country:      dto.country?.trim()     ?? null,
      phone:        dto.phone?.trim()       ?? null,
      email:        dto.email?.trim()       ?? null,
      website:      dto.website?.trim()     ?? null,
      description:  dto.description?.trim() ?? null,
      pastorIds:    dto.pastorIds           ?? [],
      adminIds:     dto.adminIds            ?? [],
      schedules:    dto.schedules ? plainSchedules(dto.schedules) : [],
      asistenciaCategoriaKeys,
      voluntarioCategoriaKeys,
      monedaCodes,
      isActive:     true,
      createdAt:    this.fb.now(),
      updatedAt:    this.fb.now(),
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return this.fb.toObj(await this.fb.db.collection(COL).doc(String(id)).get());
  }

  async update(id: number, dto: UpdateCampusDto) {
    await this.findOne(id);
    if (dto.name) {
      const name = dto.name.trim();
      const snap = await this.fb.db.collection(COL)
        .where('nameLower', '==', name.toLowerCase())
        .limit(1).get();
      if (!snap.empty && snap.docs[0].data().id !== id) {
        throw new ConflictException(`Ya existe un campus con el nombre "${name}"`);
      }
    }
    const data: any = { updatedAt: this.fb.now() };
    if (dto.name        !== undefined) { data.name = dto.name.trim(); data.nameLower = dto.name.trim().toLowerCase(); }
    if (dto.siglas      !== undefined) data.siglas      = dto.siglas?.trim()      ?? null;
    if (dto.address     !== undefined) data.address     = dto.address?.trim()     ?? null;
    if (dto.city        !== undefined) data.city        = dto.city?.trim()        ?? null;
    if (dto.country     !== undefined) data.country     = dto.country?.trim()     ?? null;
    if (dto.phone       !== undefined) data.phone       = dto.phone?.trim()       ?? null;
    if (dto.email       !== undefined) data.email       = dto.email?.trim()       ?? null;
    if (dto.website     !== undefined) data.website     = dto.website?.trim()     ?? null;
    if (dto.description !== undefined) data.description = dto.description?.trim() ?? null;
    if (dto.isActive    !== undefined) data.isActive    = dto.isActive;
    if (dto.pastorIds !== undefined) data.pastorIds = dto.pastorIds;
    if (dto.adminIds  !== undefined) data.adminIds  = dto.adminIds;
    if (dto.schedules !== undefined) data.schedules = plainSchedules(dto.schedules);
    if (dto.asistenciaCategoriaKeys !== undefined) data.asistenciaCategoriaKeys = dto.asistenciaCategoriaKeys;
    if (dto.voluntarioCategoriaKeys !== undefined) data.voluntarioCategoriaKeys = dto.voluntarioCategoriaKeys;
    if (dto.monedaCodes             !== undefined) data.monedaCodes             = dto.monedaCodes;

    await this.fb.db.collection(COL).doc(String(id)).update(data);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }
}
