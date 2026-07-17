import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateJobTitleDto, UpdateJobTitleDto } from './dto/job-title.dto';

const COL = 'job_titles';

@Injectable()
export class JobTitlesService {
  constructor(private fb: FirebaseService) {}

  async findAll() {
    const snap = await this.fb.db.collection(COL).get();
    return this.fb.toDocs(snap).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async findActive(): Promise<string[]> {
    const snap = await this.fb.db.collection(COL).where('isActive', '==', true).get();
    return this.fb.toDocs(snap)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((r) => r.name);
  }

  async findAllWithIds() {
    const snap = await this.fb.db.collection(COL).where('isActive', '==', true).get();
    return this.fb.toDocs(snap)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Cargo con id ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async create(dto: CreateJobTitleDto) {
    const name = dto.name.trim();
    const snap = await this.fb.db.collection(COL)
      .where('nameLower', '==', name.toLowerCase()).limit(1).get();
    if (!snap.empty) throw new ConflictException(`Ya existe el cargo "${name}"`);

    const id = await this.fb.nextId(COL);
    const doc = {
      id, name,
      nameLower:  name.toLowerCase(),
      sortOrder:  dto.sortOrder ?? 0,
      isActive:   true,
      createdAt:  this.fb.now(),
      updatedAt:  this.fb.now(),
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return this.fb.toObj(await this.fb.db.collection(COL).doc(String(id)).get());
  }

  async update(id: number, dto: UpdateJobTitleDto) {
    await this.findOne(id);
    if (dto.name) {
      const name = dto.name.trim();
      const snap = await this.fb.db.collection(COL)
        .where('nameLower', '==', name.toLowerCase()).limit(1).get();
      if (!snap.empty && snap.docs[0].data().id !== id) {
        throw new ConflictException(`Ya existe el cargo "${name}"`);
      }
    }
    const data: any = { updatedAt: this.fb.now() };
    if (dto.name      !== undefined) { data.name = dto.name.trim(); data.nameLower = dto.name.trim().toLowerCase(); }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive  !== undefined) data.isActive = dto.isActive;

    await this.fb.db.collection(COL).doc(String(id)).update(data);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }

  /** Busca un cargo por nombre (case/espacios-insensitive) o lo crea si no existe. */
  async findOrCreateByName(rawName: string): Promise<{ id: number; name: string }> {
    const name = rawName.trim();
    const nameLower = name.toLowerCase();
    const snap = await this.fb.db.collection(COL).where('nameLower', '==', nameLower).limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      return { id: data.id, name: data.name };
    }
    const id = await this.fb.nextId(COL);
    const doc = {
      id, name,
      nameLower,
      sortOrder:  0,
      isActive:   true,
      createdAt:  this.fb.now(),
      updatedAt:  this.fb.now(),
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return { id, name };
  }
}
