import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateContentDto } from './dto/create-content.dto';

const COL = 'content';

@Injectable()
export class ContentsService {
  constructor(private fb: FirebaseService) {}

  // ── Admin: lista completa ────────────────────────────────────────────────────

  async findAll(_userId: number, _roleId: number) {
    const snap = await this.fb.db.collection(COL).orderBy('createdAt', 'desc').get();
    return this.fb.toDocs(snap);
  }

  /** Lista todas las noticias (admin) con filtros opcionales */
  async findNews(campusId?: string | 'global', status?: string) {
    const snap = await this.fb.db
      .collection(COL)
      .where('type', '==', 'news')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    let list = this.fb.toDocs(snap) as any[];

    if (status) list = list.filter((n) => n.status === status);

    if (campusId === 'global') {
      list = list.filter((n) => n.campusId == null);
    } else if (campusId) {
      list = list.filter((n) => n.campusId === campusId);
    }

    return list;
  }

  // ── Público: noticias publicadas por scope ───────────────────────────────────

  async findPublished(scope: 'global' | 'campus', campusId?: string) {
    const snap = await this.fb.db
      .collection(COL)
      .where('type', '==', 'news')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    return (this.fb.toDocs(snap) as any[])
      .filter((n) => {
        if (n.status !== 'published') return false;
        if (scope === 'global') return n.campusId == null;
        if (scope === 'campus') return campusId ? n.campusId === campusId : false;
        return false;
      })
      .slice(0, 10);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Content ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async create(dto: CreateContentDto, userId: number) {
    const id  = await this.fb.nextId(COL);
    const now = this.fb.now();
    const doc = {
      id,
      ...dto,
      campusId:   dto.campusId   ?? null,
      status:     dto.status     ?? 'draft',
      mediaItems: dto.mediaItems ?? [],
      pinned:     dto.pinned     ?? false,
      authorId:   userId,
      publishedAt: dto.status === 'published' ? now : null,
      createdAt:  now,
      updatedAt:  now,
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return this.findOne(id);
  }

  async update(id: number, dto: Partial<CreateContentDto>) {
    const existing = await this.findOne(id) as any;
    const now = this.fb.now();
    const patch: any = { ...dto, updatedAt: now };

    // Marcar publishedAt la primera vez que se publica
    if (dto.status === 'published' && existing.status !== 'published') {
      patch.publishedAt = now;
    }

    await this.fb.db.collection(COL).doc(String(id)).update(patch);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }
}
