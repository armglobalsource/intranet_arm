import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { StorageService } from '../common/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateFeedbackDto, UpdateFeedbackStatusDto } from './dto/feedback.dto';

const COL = 'feedback';

@Injectable()
export class FeedbackService {
  constructor(
    private fb: FirebaseService,
    private storage: StorageService,
    private notifications: NotificationsService,
  ) {}

  async create(
    dto: CreateFeedbackDto,
    userId: number,
    userName: string,
    userEmail: string,
    screenshotBuffer?: Buffer,
    screenshotMime?: string,
  ) {
    const id = await this.fb.nextId(COL);

    let screenshotUrl: string | null = null;
    if (screenshotBuffer && screenshotMime) {
      const ext = screenshotMime.includes('png') ? 'png' : 'jpg';
      screenshotUrl = await this.storage.uploadPublic(
        `feedback/${id}.${ext}`,
        screenshotBuffer,
        screenshotMime,
      );
    }

    const data = {
      id,
      userId,
      userName,
      userEmail,
      type:         dto.type,
      message:      dto.message,
      screenshotUrl,
      status:       'open',
      note:         null,
      createdAt:    this.fb.now(),
      updatedAt:    this.fb.now(),
      resolvedAt:   null,
      resolvedBy:   null,
      resolvedByName: null,
    };

    await this.fb.db.collection(COL).doc(String(id)).set(data);

    const typeLabel = dto.type === 'bug' ? 'Problema reportado' : 'Sugerencia recibida';
    this.notifications.createForPermission('feedback:manage', {
      title:   `${typeLabel}: ${userName}`,
      body:    dto.message.slice(0, 80) + (dto.message.length > 80 ? '…' : ''),
      link:    '/dashboard/soporte',
      channel: 'in_app',
    }).catch(() => {});

    this.notifications.create({
      userId,
      title: dto.type === 'bug' ? 'Recibimos tu reporte' : 'Recibimos tu sugerencia',
      body: 'Puedes seguir su estado y leer la respuesta del equipo de soporte aquí.',
      link: `/notificaciones?feedback=${id}`,
      channel: 'in_app',
    }, 0).catch(() => {});

    return { ...data, id };
  }

  async findAll() {
    const snap = await this.fb.db.collection(COL).limit(500).get();
    return this.fb.toDocs(snap).sort((a: any, b: any) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }

  async findMine(userId: number) {
    const snap = await this.fb.db.collection(COL)
      .where('userId', '==', userId)
      .limit(100)
      .get();
    return this.fb.toDocs(snap).sort((a: any, b: any) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Feedback ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async updateStatus(id: number, dto: UpdateFeedbackStatusDto, userId: number, userName: string) {
    const current: any = await this.findOne(id);
    const data: any = {
      status:    dto.status,
      note:      dto.note ?? null,
      updatedAt: this.fb.now(),
    };
    if (dto.status === 'resolved') {
      data.resolvedAt     = this.fb.now();
      data.resolvedBy     = userId;
      data.resolvedByName = userName;
    } else {
      data.resolvedAt     = null;
      data.resolvedBy     = null;
      data.resolvedByName = null;
    }
    await this.fb.db.collection(COL).doc(String(id)).update(data);

    const responseChanged = (current.note ?? null) !== (data.note ?? null);
    const statusChanged = current.status !== dto.status;
    if (responseChanged || statusChanged) {
      const statusLabel = {
        open: 'abierto',
        in_progress: 'en revisión',
        resolved: 'resuelto',
      }[dto.status];
      const typeLabel = current.type === 'suggestion' ? 'sugerencia' : 'reporte';
      this.notifications.create({
        userId: current.userId,
        title: data.note
          ? `Nueva respuesta a tu ${typeLabel}`
          : `Tu ${typeLabel} está ${statusLabel}`,
        body: data.note ?? `El estado cambió a ${statusLabel}.`,
        link: `/notificaciones?feedback=${id}`,
        channel: 'in_app',
      }, userId).catch(() => {});
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }
}
