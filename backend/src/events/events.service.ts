import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const COL = 'events';

@Injectable()
export class EventsService {
  constructor(private fb: FirebaseService) {}

  async findAll(year?: string) {
    let query: FirebaseFirestore.Query;

    if (year) {
      query = this.fb.db
        .collection(COL)
        .where('date', '>=', `${year}-01-01`)
        .where('date', '<=', `${year}-12-31`)
        .orderBy('date');
    } else {
      query = this.fb.db.collection(COL).orderBy('date');
    }

    const snap = await query.get();
    return this.fb.toDocs(snap);
  }

  async findOne(id: string) {
    const snap = await this.fb.db.collection(COL).doc(id).get();
    if (!snap.exists) throw new NotFoundException(`Evento ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async create(dto: CreateEventDto, userId: number, userRole: string) {
    if (userRole !== 'admin') {
      throw new ForbiddenException('Solo administradores pueden crear eventos');
    }

    const ref  = this.fb.db.collection(COL).doc();
    const data = {
      id:          ref.id,
      title:       dto.title,
      description: dto.description  ?? null,
      date:        dto.date,
      endDate:     dto.endDate      ?? null,
      time:        dto.time         ?? null,
      category:    dto.category,
      customLabel: dto.customLabel  ?? null,
      location:    dto.location     ?? null,
      createdBy:   userId,
      createdAt:   this.fb.now(),
      updatedAt:   this.fb.now(),
    };

    await ref.set(data);
    return data;
  }

  async update(id: string, dto: UpdateEventDto, userRole: string) {
    if (userRole !== 'admin') {
      throw new ForbiddenException('Solo administradores pueden editar eventos');
    }

    await this.findOne(id);
    await this.fb.db
      .collection(COL)
      .doc(id)
      .update({ ...dto, updatedAt: this.fb.now() });

    return this.findOne(id);
  }

  async remove(id: string, userRole: string) {
    if (userRole !== 'admin') {
      throw new ForbiddenException('Solo administradores pueden eliminar eventos');
    }

    await this.findOne(id);
    await this.fb.db.collection(COL).doc(id).delete();
    return { id };
  }
}
