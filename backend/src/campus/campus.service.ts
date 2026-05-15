import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateCampusDto, UpdateCampusDto } from './dto/campus.dto';

const COL = 'campuses';

@Injectable()
export class CampusService {
  constructor(private fb: FirebaseService) {}

  async findAll() {
    const snap = await this.fb.db.collection(COL).orderBy('name').get();
    const all = this.fb.toDocs(snap);
    return all.sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || a.name.localeCompare(b.name));
  }

  async findActive() {
    const snap = await this.fb.db.collection(COL)
      .where('isActive', '==', true)
      .orderBy('name')
      .get();
    return this.fb.toDocs(snap).map(({ id, name, address }) => ({ id, name, address }));
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Campus con id ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async create(dto: CreateCampusDto) {
    const name = dto.name.trim();
    // Verificar duplicado (case-insensitive)
    const snap = await this.fb.db.collection(COL)
      .where('nameLower', '==', name.toLowerCase())
      .limit(1).get();
    if (!snap.empty) throw new ConflictException(`Ya existe un campus con el nombre "${name}"`);

    const id = await this.fb.nextId(COL);
    const doc = {
      id, name,
      nameLower: name.toLowerCase(),
      address:   dto.address?.trim() ?? null,
      isActive:  true,
      createdAt: this.fb.now(),
      updatedAt: this.fb.now(),
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
    if (dto.name    !== undefined) { data.name = dto.name.trim(); data.nameLower = dto.name.trim().toLowerCase(); }
    if (dto.address !== undefined) data.address = dto.address?.trim() ?? null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.fb.db.collection(COL).doc(String(id)).update(data);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }
}
