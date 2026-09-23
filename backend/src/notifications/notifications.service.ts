import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { hasPermission } from '../common/permissions';

@Injectable()
export class NotificationsService {
  constructor(private fb: FirebaseService) {}

  // Sin bypass de admin: ver createForPermission para el reparto por destinatario.
  async findAll(userId: number) {
    const snap = await this.fb.db.collection('notifications')
      .where('userId', '==', userId).limit(100).get();
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

  async findOneForUser(id: number, userId: number) {
    const notification: any = await this.findOne(id);
    if (notification.userId !== userId) {
      throw new ForbiddenException('No puedes acceder a esta notificación');
    }
    return notification;
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

  // Un documento propio por destinatario, para cada usuario activo cuyo rol tenga el permiso.
  async createForPermission(permission: string, dto: Omit<CreateNotificationDto, 'userId'>) {
    const userIds = await this.resolveUserIdsByPermission(permission);
    return Promise.all(userIds.map((userId) => this.create({ ...dto, userId }, userId)));
  }

  private async resolveUserIdsByPermission(permission: string): Promise<number[]> {
    const [rolesSnap, usersSnap] = await Promise.all([
      this.fb.db.collection('roles').get(),
      this.fb.db.collection('users').select('id', 'roleId', 'status').get(),
    ]);
    const matchingRoleIds = new Set(
      this.fb.toDocs(rolesSnap)
        .filter((r: any) => hasPermission(r.permissions ?? [], permission))
        .map((r: any) => r.id),
    );
    return this.fb.toDocs(usersSnap)
      .filter((u: any) => u.status === 'active' && matchingRoleIds.has(u.roleId))
      .map((u: any) => u.id);
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

  async markRead(id: number, userId: number) {
    await this.findOneForUser(id, userId);
    await this.fb.db.collection('notifications').doc(String(id)).update({
      read: true,
      readAt: this.fb.now(),
      updatedAt: this.fb.now(),
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection('notifications').doc(String(id)).delete();
    return { id };
  }
}
