import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { UpsertCancionDto } from './dto/cancion.dto';

const COL = 'canciones';

@Injectable()
export class CancionesService {
  constructor(private fb: FirebaseService) {}

  /** Buscar canciones por título (búsqueda simple por prefijo, insensible a mayúsculas) */
  async search(q?: string) {
    let query: any = this.fb.db.collection(COL).orderBy('usageCount', 'desc');
    const snap = await query.limit(100).get();
    const all = this.fb.toDocs(snap) as any[];
    if (!q || !q.trim()) return all.slice(0, 30);
    const lower = q.trim().toLowerCase();
    return all
      .filter((c) => c.titulo?.toLowerCase().includes(lower))
      .slice(0, 20);
  }

  /**
   * Upsert: si ya existe una canción con ese título (normalizado), incrementa usageCount.
   * Si no, la crea. Devuelve el documento resultante.
   */
  async upsert(dto: UpsertCancionDto) {
    const tituloNorm = dto.titulo.trim();
    if (!tituloNorm) return null;

    const snap = await this.fb.db
      .collection(COL)
      .where('tituloNorm', '==', tituloNorm.toLowerCase())
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc  = snap.docs[0];
      const ref  = doc.ref;
      const data = doc.data();
      const update: any = {
        usageCount: (data.usageCount ?? 0) + 1,
        updatedAt:  this.fb.now(),
      };
      // Update tonalidad only if provided and not already set
      if (dto.tonalidad && !data.tonalidad) update.tonalidad = dto.tonalidad.trim();
      await ref.update(update);
      return this.fb.toObj(await ref.get());
    }

    // Nueva canción
    const ref       = this.fb.db.collection(COL).doc();
    const cancionId = ref.id;
    const doc = {
      cancionId,
      titulo:     tituloNorm,
      tituloNorm: tituloNorm.toLowerCase(),
      tonalidad:  dto.tonalidad?.trim() ?? '',
      usageCount: 1,
      createdAt:  this.fb.now(),
      updatedAt:  this.fb.now(),
    };
    await ref.set(doc);
    return this.fb.toObj(await ref.get());
  }
}
