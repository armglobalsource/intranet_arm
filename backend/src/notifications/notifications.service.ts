import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private fb: FirebaseService) {}

  async findAll(userId: number, roleId: number) {
    // Return notifications for this user (or all for admins, role=1)
    const col = this.fb.db.collection('notifications');
    const snap = roleId === 1
      ? await col.limit(200).get()
      : await col.where('userId', '==', userId).limit(100).get();
    return this.fb.toDocs(snap).sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection('notifications').doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Notification con id ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async create(dto: CreateNotificationDto, userId: number) {
    const id = await this.fb.nextId('notifications');
    const data = {
      id,
      userId:  dto.userId,
      title:   dto.title,
      body:    dto.body    ?? null,
      link:    dto.link    ?? null,
      channel: dto.channel ?? 'in_app',
      read:    false,
      createdAt: this.fb.now(),
      updatedAt: this.fb.now(),
    };
    await this.fb.db.collection('notifications').doc(String(id)).set(data);
    return { ...data, id };
  }

  async update(id: number, dto: Partial<CreateNotificationDto>) {
    await this.findOne(id);
    const data: Record<string, any> = { updatedAt: this.fb.now() };
    if (dto.title   !== undefined) data['title']   = dto.title;
    if (dto.body    !== undefined) data['body']     = dto.body;
    if (dto.link    !== undefined) data['link']     = dto.link;
    if (dto.channel !== undefined) data['channel']  = dto.channel;
    await this.fb.db.collection('notifications').doc(String(id)).update(data);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection('notifications').doc(String(id)).delete();
    return { id };
  }
}
