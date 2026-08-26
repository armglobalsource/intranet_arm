import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../common/firebase/firebase.service';
import { StorageService } from '../common/storage/storage.service';
import { CreateVisualReferenceDto, UpdateVisualReferenceDto } from './dto/visual-reference.dto';

const COL = 'visual_references';

/** Parsea "azul, worship , particulas" → ["azul","worship","particulas"] normalizados. */
function parseTags(raw?: string): string[] {
  if (!raw) return [];
  return Array.from(new Set(
    raw.split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20), // límite defensivo
  ));
}

@Injectable()
export class VisualReferencesService {
  constructor(
    private fb: FirebaseService,
    private storage: StorageService,
  ) {}

  async findAll(search?: string) {
    const snap = await this.fb.db.collection(COL).get();
    const all = this.fb.toDocs(snap)
      .sort((a, b) => (b.uploadedAt?.toMillis?.() ?? 0) - (a.uploadedAt?.toMillis?.() ?? 0));

    if (!search) return all;
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) =>
      (r.name ?? '').toLowerCase().includes(q) ||
      (r.tags ?? []).some((t: string) => t.includes(q)),
    );
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Referencia visual con id ${id} no encontrada`);
    return this.fb.toObj(snap);
  }

  async create(
    dto: CreateVisualReferenceDto,
    file: Express.Multer.File,
    userId: number,
    userName?: string,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo de imagen');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException(`Tipo de archivo no soportado: ${file.mimetype}`);
    }

    const id = await this.fb.nextId(COL);
    const ext = (file.originalname.split('.').pop() ?? 'jpg').toLowerCase();
    const key = `visual-references/${id}-${Date.now()}.${ext}`;
    const imageUrl = await this.storage.uploadPublic(key, file.buffer, file.mimetype);

    const doc = {
      id,
      name:           dto.name.trim(),
      tags:           parseTags(dto.tags),
      imageUrl,
      storageKey:     key, // para poder borrar después
      uploadedBy:     userId,
      uploadedByName: userName ?? null,
      uploadedAt:     this.fb.now(),
      usageCount:     0,
      isActive:       true,
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return this.findOne(id);
  }

  async update(id: number, dto: UpdateVisualReferenceDto) {
    await this.findOne(id);
    const data: any = {};
    if (dto.name     !== undefined) data.name     = dto.name.trim();
    if (dto.tags     !== undefined) data.tags     = parseTags(dto.tags);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (Object.keys(data).length === 0) return this.findOne(id);

    await this.fb.db.collection(COL).doc(String(id)).update(data);
    return this.findOne(id);
  }

  async remove(id: number) {
    const ref = await this.findOne(id);
    // Borrar la imagen del bucket también (best-effort — si falla, seguimos)
    if (ref.storageKey) {
      try {
        await this.storage.deleteObject('avatars', ref.storageKey);
      } catch {
        // Silencio: no queremos que un fallo de storage bloquee la eliminación
        // del documento; el garbage collector de GCS puede limpiar después.
      }
    }
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }

  /** Incrementa usageCount cuando una ficha referencia esta imagen. Best-effort. */
  async incrementUsage(id: number) {
    try {
      await this.fb.db.collection(COL).doc(String(id))
        .update({ usageCount: admin.firestore.FieldValue.increment(1) });
    } catch {
      // Ignorar — es solo métrica y el doc puede no existir aún si fue borrado.
    }
  }
}
