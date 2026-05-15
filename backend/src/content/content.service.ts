import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateContentDto } from './dto/create-content.dto';

const COL = 'content';

@Injectable()
export class ContentsService {
  constructor(private fb: FirebaseService) {}

  async findAll(_userId: number, _roleId: number) {
    const snap = await this.fb.db.collection(COL).orderBy('createdAt', 'desc').get();
    return this.fb.toDocs(snap);
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Content con id ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async create(dto: CreateContentDto, userId: number) {
    const id = await this.fb.nextId(COL);
    const doc = { id, ...dto, authorId: userId, createdAt: this.fb.now(), updatedAt: this.fb.now() };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return this.findOne(id);
  }

  async update(id: number, dto: Partial<CreateContentDto>) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(String(id)).update({ ...dto, updatedAt: this.fb.now() });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }
}
