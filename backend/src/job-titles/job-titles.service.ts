import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateJobTitleDto, UpdateJobTitleDto } from './dto/job-title.dto';

const COL = 'job_titles';
const MEMBERSHIPS_COL = 'org_memberships';

@Injectable()
export class JobTitlesService {
  constructor(private fb: FirebaseService) {}

  async findAll() {
    const snap = await this.fb.db.collection(COL).get();
    return this.fb.toDocs(snap).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async findActive(): Promise<string[]> {
    const snap = await this.fb.db.collection(COL).where('isActive', '==', true).get();
    return this.fb.toDocs(snap)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((r) => r.name);
  }

  async findAllWithIds() {
    const snap = await this.fb.db.collection(COL).where('isActive', '==', true).get();
    return this.fb.toDocs(snap)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Cargo con id ${id} no encontrado`);
    return this.fb.toObj(snap);
  }

  async create(dto: CreateJobTitleDto) {
    const name = dto.name.trim();
    const snap = await this.fb.db.collection(COL)
      .where('nameLower', '==', name.toLowerCase()).limit(1).get();
    if (!snap.empty) throw new ConflictException(`Ya existe el cargo "${name}"`);

    const id = await this.fb.nextId(COL);
    const doc = {
      id, name,
      nameLower:  name.toLowerCase(),
      sortOrder:  dto.sortOrder ?? 0,
      isActive:   true,
      createdAt:  this.fb.now(),
      updatedAt:  this.fb.now(),
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return this.fb.toObj(await this.fb.db.collection(COL).doc(String(id)).get());
  }

  async update(id: number, dto: UpdateJobTitleDto) {
    const before = await this.findOne(id);
    if (dto.name) {
      const name = dto.name.trim();
      const snap = await this.fb.db.collection(COL)
        .where('nameLower', '==', name.toLowerCase()).limit(1).get();
      if (!snap.empty && snap.docs[0].data().id !== id) {
        throw new ConflictException(`Ya existe el cargo "${name}"`);
      }
    }
    const data: any = { updatedAt: this.fb.now() };
    if (dto.name      !== undefined) { data.name = dto.name.trim(); data.nameLower = dto.name.trim().toLowerCase(); }
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive  !== undefined) data.isActive = dto.isActive;

    await this.fb.db.collection(COL).doc(String(id)).update(data);

    // Los cargos de organigrama se resuelven en vivo (no hay copia que actualizar),
    // pero los cargos manuales del perfil de Personas sí son una copia denormalizada
    // (users.jobTitles[].name) — hay que propagar el rename para que no queden obsoletos.
    if (dto.name !== undefined && data.name !== before.name) {
      await this.cascadeRenameToUsers(id, data.name);
    }

    return this.findOne(id);
  }

  private async cascadeRenameToUsers(jobTitleId: number, newName: string) {
    const usersSnap = await this.fb.db.collection('users').get();
    const batch = this.fb.db.batch();
    let touched = 0;
    usersSnap.docs.forEach((d) => {
      const jobTitles: any[] = d.data().jobTitles ?? [];
      if (!jobTitles.some((jt) => jt.jobTitleId === jobTitleId)) return;
      const updated = jobTitles.map((jt) => (jt.jobTitleId === jobTitleId ? { ...jt, name: newName } : jt));
      batch.update(d.ref, { jobTitles: updated });
      touched++;
    });
    if (touched) await batch.commit();
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.cleanupReferences(id);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }

  /** Al eliminar un cargo, lo quita de los perfiles (manual) y lo desvincula de las membresías del organigrama que lo referenciaban — no deja FKs colgando. */
  private async cleanupReferences(jobTitleId: number) {
    const [usersSnap, membSnap] = await Promise.all([
      this.fb.db.collection('users').get(),
      this.fb.db.collection(MEMBERSHIPS_COL).get(),
    ]);
    const batch = this.fb.db.batch();
    let touched = 0;
    usersSnap.docs.forEach((d) => {
      const jobTitles: any[] = d.data().jobTitles ?? [];
      if (!jobTitles.some((jt) => jt.jobTitleId === jobTitleId)) return;
      batch.update(d.ref, { jobTitles: jobTitles.filter((jt) => jt.jobTitleId !== jobTitleId), updatedAt: this.fb.now() });
      touched++;
    });
    membSnap.docs.forEach((d) => {
      if (d.data().jobTitleId === jobTitleId) {
        batch.update(d.ref, { jobTitleId: null, updatedAt: this.fb.now() });
        touched++;
      }
    });
    if (touched) await batch.commit();
  }

  /** Personas afectadas por este cargo (para las advertencias de editar/eliminar en el mantenedor). */
  async getAffectedUsers(jobTitleId: number): Promise<{ id: number; firstName: string; lastName: string; sources: ('manual' | 'orgchart')[] }[]> {
    await this.findOne(jobTitleId);
    const [usersSnap, membSnap] = await Promise.all([
      this.fb.db.collection('users').get(),
      this.fb.db.collection(MEMBERSHIPS_COL).get(),
    ]);

    const sourcesByUser = new Map<number, Set<'manual' | 'orgchart'>>();
    usersSnap.docs.forEach((d) => {
      const u = d.data();
      if ((u.jobTitles ?? []).some((jt: any) => jt.jobTitleId === jobTitleId)) {
        if (!sourcesByUser.has(u.id)) sourcesByUser.set(u.id, new Set());
        sourcesByUser.get(u.id)!.add('manual');
      }
    });
    membSnap.docs.forEach((d) => {
      const m = d.data();
      if (m.jobTitleId === jobTitleId) {
        if (!sourcesByUser.has(m.userId)) sourcesByUser.set(m.userId, new Set());
        sourcesByUser.get(m.userId)!.add('orgchart');
      }
    });

    const usersById = new Map(usersSnap.docs.map((d) => [d.data().id, d.data()]));
    return [...sourcesByUser.entries()]
      .map(([userId, sources]) => {
        const u = usersById.get(userId);
        if (!u) return null;
        return { id: u.id, firstName: u.firstName, lastName: u.lastName, sources: [...sources] };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.firstName.localeCompare(b.firstName));
  }

  /**
   * Resuelve, para cada userId, los cargos derivados de sus membresías activas en el
   * organigrama (jobTitleId de org_memberships). El organigrama es la fuente de verdad
   * para estos cargos — nunca se guardan como copia en el perfil de la persona.
   */
  async getActiveByMembershipUserIds(userIds: number[]): Promise<Record<number, { jobTitleId: number; name: string }[]>> {
    if (!userIds.length) return {};
    const idSet = new Set(userIds);

    const [membSnap, jtSnap] = await Promise.all([
      this.fb.db.collection(MEMBERSHIPS_COL).get(),
      this.fb.db.collection(COL).get(),
    ]);

    const jtNameById = new Map<number, string>();
    jtSnap.docs.forEach((d) => { const data = d.data(); jtNameById.set(data.id, data.name); });

    const result: Record<number, { jobTitleId: number; name: string }[]> = {};
    membSnap.docs.forEach((d) => {
      const m = d.data();
      if (!idSet.has(m.userId) || m.jobTitleId == null || !jtNameById.has(m.jobTitleId)) return;
      if (!result[m.userId]) result[m.userId] = [];
      if (!result[m.userId].some((jt) => jt.jobTitleId === m.jobTitleId)) {
        result[m.userId].push({ jobTitleId: m.jobTitleId, name: jtNameById.get(m.jobTitleId)! });
      }
    });
    return result;
  }

  /** Busca un cargo por nombre (case/espacios-insensitive) o lo crea si no existe. */
  async findOrCreateByName(rawName: string): Promise<{ id: number; name: string }> {
    const name = rawName.trim();
    const nameLower = name.toLowerCase();
    const snap = await this.fb.db.collection(COL).where('nameLower', '==', nameLower).limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      return { id: data.id, name: data.name };
    }
    const id = await this.fb.nextId(COL);
    const doc = {
      id, name,
      nameLower,
      sortOrder:  0,
      isActive:   true,
      createdAt:  this.fb.now(),
      updatedAt:  this.fb.now(),
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return { id, name };
  }
}
