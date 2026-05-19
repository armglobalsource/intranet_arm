import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateContentDto } from './dto/create-content.dto';

const COL = 'content';

@Injectable()
export class ContentsService {
  constructor(private fb: FirebaseService) {}

  // ── Admin: lista completa ────────────────────────────────────────────────────

  async findAll(_userId: number, _roleId: number) {
    return this.fetchAll();
  }

  /** Lista todas las noticias (admin) con filtros opcionales */
  /** Fetch all content and filter in-memory — avoids Firestore composite index requirements */
  private async fetchAll(): Promise<any[]> {
    const snap = await this.fb.db.collection(COL).get();
    const docs = this.fb.toDocs(snap) as any[];
    return docs.sort((a, b) => {
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt ?? 0).getTime();
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt ?? 0).getTime();
      return tb - ta;
    });
  }

  async findNews(campusId?: string | 'global', status?: string) {
    let list = (await this.fetchAll()).filter((n) => n.type === 'news');
    if (status)                list = list.filter((n) => n.status === status);
    if (campusId === 'global') list = list.filter((n) => n.campusId == null);
    else if (campusId)         list = list.filter((n) => n.campusId === campusId);
    return list;
  }

  async findPublished(scope: 'global' | 'campus', campusId?: string) {
    const all = (await this.fetchAll()).filter((n) => n.type === 'news' && n.status === 'published');
    if (scope === 'global') return all.filter((n) => n.campusId == null).slice(0, 10);
    if (scope === 'campus') return campusId ? all.filter((n) => n.campusId === campusId).slice(0, 10) : [];
    return [];
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
