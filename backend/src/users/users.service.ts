import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

const COL = 'users';

/** Da formato a un doc de Firestore al shape esperado por el frontend */
function formatUser(raw: any) {
  if (!raw) return null;
  const { passwordHash, nameLower, ...rest } = raw;
  // Asegurar jobTitles en formato { jobTitle: { id, name } }[]
  const jobTitles = (raw.jobTitles ?? []).map((jt: any) => ({
    jobTitle: { id: jt.jobTitleId, name: jt.name },
  }));
  return { ...rest, jobTitles };
}

@Injectable()
export class UsersService {
  constructor(private fb: FirebaseService) {}

  // ── Roles ─────────────────────────────────────────────────────────────────

  async findAllRoles() {
    const snap = await this.fb.db.collection('roles').get();
    return this.fb.toDocs(snap);
  }

  // ── Usuarios ──────────────────────────────────────────────────────────────

  async findAll(_userId: number, _roleId: number, search?: string, page = 1, limit = 50) {
    const safeLimit = Math.min(limit, 200);
    let all = await this.fb.db.collection(COL).get();
    let docs = this.fb.toDocs(all).sort((a, b) =>
      (a.firstName ?? '').localeCompare(b.firstName ?? '') ||
      (a.lastName  ?? '').localeCompare(b.lastName  ?? ''),
    );

    if (search) {
      const q = search.toLowerCase();
      docs = docs.filter((u) =>
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q)  ||
        u.email?.toLowerCase().includes(q)     ||
        (u.jobTitles ?? []).some((jt: any) => jt.name?.toLowerCase().includes(q)),
      );
    }

    const total = docs.length;
    const skip  = (page - 1) * safeLimit;
    const data  = docs.slice(skip, skip + safeLimit).map(formatUser);

    return { data, total, page, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`User con id ${id} no encontrado`);
    return formatUser(this.fb.toObj(snap));
  }

  async findByEmail(email: string) {
    const snap = await this.fb.db.collection(COL)
      .where('email', '==', email.toLowerCase()).limit(1).get();
    if (snap.empty) return null;
    return this.fb.toObj(snap.docs[0]);
  }

  async create(dto: CreateUserDto, _createdBy: number) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Ya existe un usuario con ese email');

    // Cargar role y campus para denormalizar
    const roleSnap = await this.fb.db.collection('roles').doc(String(dto.roleId)).get();
    const role     = roleSnap.exists ? { id: dto.roleId, name: roleSnap.data()!.name } : null;

    const campusSnap = dto.campusId
      ? await this.fb.db.collection('campuses').doc(String(dto.campusId)).get()
      : null;
    const campus = campusSnap?.exists
      ? { id: dto.campusId, name: campusSnap.data()!.name, address: campusSnap.data()!.address ?? null }
      : null;

    // Cargar jobTitles para denormalizar
    const jobTitles = await this.resolveJobTitles(dto.jobTitleIds ?? []);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const id           = await this.fb.nextId(COL);

    const doc = {
      id, email, passwordHash,
      firstName:    dto.firstName.trim(),
      lastName:     dto.lastName.trim(),
      nameLower:    `${dto.firstName} ${dto.lastName}`.toLowerCase(),
      roleId:       dto.roleId,
      role,
      campusId:     dto.campusId ?? null,
      campus,
      jobTitles,
      phone:        dto.phone?.trim()   ?? null,
      country:      dto.country?.trim() ?? null,
      bio:          dto.bio?.trim()     ?? null,
      avatarUrl:    null,
      status:       'active',
      departmentId: null,
      lastLoginAt:  null,
      createdAt:    this.fb.now(),
      updatedAt:    this.fb.now(),
    };

    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return this.findOne(id);
  }

  async update(id: number, dto: UpdateUserDto) {
    const current = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!current.exists) throw new NotFoundException(`User con id ${id} no encontrado`);

    const data: any = { updatedAt: this.fb.now() };

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      const snap  = await this.fb.db.collection(COL).where('email', '==', email).limit(1).get();
      if (!snap.empty && snap.docs[0].data().id !== id) {
        throw new ConflictException('Ya existe un usuario con ese email');
      }
      data.email = email;
    }
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName.trim();
      data.nameLower = `${dto.firstName} ${dto.lastName ?? current.data()!.lastName}`.toLowerCase();
    }
    if (dto.lastName  !== undefined) {
      data.lastName  = dto.lastName.trim();
      data.nameLower = `${dto.firstName ?? current.data()!.firstName} ${dto.lastName}`.toLowerCase();
    }
    if (dto.phone     !== undefined) data.phone    = dto.phone?.trim()   ?? null;
    if (dto.country   !== undefined) data.country  = dto.country?.trim() ?? null;
    if (dto.bio       !== undefined) data.bio       = dto.bio?.trim()     ?? null;
    if (dto.status    !== undefined) data.status    = dto.status;
    if (dto.campusId  !== undefined) {
      data.campusId = dto.campusId;
      if (dto.campusId) {
        const snap = await this.fb.db.collection('campuses').doc(String(dto.campusId)).get();
        data.campus = snap.exists
          ? { id: dto.campusId, name: snap.data()!.name, address: snap.data()!.address ?? null }
          : null;
      } else {
        data.campus = null;
      }
    }
    if (dto.roleId !== undefined) {
      const snap = await this.fb.db.collection('roles').doc(String(dto.roleId)).get();
      data.roleId = dto.roleId;
      data.role   = snap.exists ? { id: dto.roleId, name: snap.data()!.name } : null;
    }
    if (dto.jobTitleIds !== undefined) {
      data.jobTitles = await this.resolveJobTitles(dto.jobTitleIds);
    }

    await this.fb.db.collection(COL).doc(String(id)).update(data);
    return this.findOne(id);
  }

  async remove(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`User con id ${id} no encontrado`);
    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }

  async updateLastLogin(id: number) {
    await this.fb.db.collection(COL).doc(String(id)).update({ lastLoginAt: this.fb.now() });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async resolveJobTitles(ids: number[]) {
    if (!ids.length) return [];
    const snaps = await Promise.all(
      ids.map((jid) => this.fb.db.collection('job_titles').doc(String(jid)).get()),
    );
    return snaps
      .filter((s) => s.exists)
      .map((s, i) => ({ jobTitleId: ids[i], name: s.data()!.name, sortOrder: i }));
  }
}
