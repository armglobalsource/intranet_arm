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
    this.notifications.create({
      userId:  0,
      title:   `${typeLabel}: ${userName}`,
      body:    dto.message.slice(0, 80) + (dto.message.length > 80 ? '…' : ''),
      link:    '/dashboard/soporte',
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

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Feedback ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async updateStatus(id: number, dto: UpdateFeedbackStatusDto, userId: number, userName: string) {
    await this.findOne(id);
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
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }
}
