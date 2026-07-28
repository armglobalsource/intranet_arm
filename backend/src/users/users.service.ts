import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { StorageService } from '../common/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JobTitlesService } from '../job-titles/job-titles.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

const COL = 'users';

/**
 * Da formato a un doc de Firestore al shape esperado por el frontend, uniendo los
 * cargos manuales (guardados en el perfil) con los derivados en vivo de sus membresías
 * activas en el organigrama. El organigrama es la fuente de verdad: si un cargo viene
 * de ahí, se marca source: 'orgchart' y prevalece sobre un cargo manual duplicado.
 */
function formatUser(raw: any, orgJobTitles: { jobTitleId: number; name: string }[] = []) {
  if (!raw) return null;
  const { passwordHash, nameLower, ...rest } = raw;
  const orgIds = new Set(orgJobTitles.map((jt) => jt.jobTitleId));
  const manual = (raw.jobTitles ?? [])
    .filter((jt: any) => !orgIds.has(jt.jobTitleId))
    .map((jt: any) => ({ jobTitle: { id: jt.jobTitleId, name: jt.name }, source: 'manual' as const }));
  const orgDerived = orgJobTitles.map((jt) => ({
    jobTitle: { id: jt.jobTitleId, name: jt.name },
    source: 'orgchart' as const,
  }));
  return { ...rest, jobTitles: [...orgDerived, ...manual] };
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private fb: FirebaseService,
    private storage: StorageService,
    private notifications: NotificationsService,
    private jobTitles: JobTitlesService,
  ) {}

  // ── Usuarios ──────────────────────────────────────────────────────────────

  async findAll(_userId: number, _roleId: number, search?: string, page = 1, limit = 50) {
    // Tope generoso, no una paginación real — el frontend siempre pide "todos"
    // para filtrar/paginar en el cliente (useUsersPaginated con paginación real
    // de servidor está definido pero no se usa en ningún lado todavía).
    const safeLimit = Math.min(limit, 2000);
    let all = await this.fb.db.collection(COL).get();
    let docs = this.fb.toDocs(all).sort((a, b) =>
      (a.firstName ?? '').localeCompare(b.firstName ?? '') ||
      (a.lastName  ?? '').localeCompare(b.lastName  ?? ''),
    );

    const orgJobTitlesByUser = await this.jobTitles.getActiveByMembershipUserIds(docs.map((u) => u.id));

    if (search) {
      const q = search.toLowerCase();
      docs = docs.filter((u) =>
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q)  ||
        u.email?.toLowerCase().includes(q)     ||
        (u.jobTitles ?? []).some((jt: any) => jt.name?.toLowerCase().includes(q)) ||
        (orgJobTitlesByUser[u.id] ?? []).some((jt) => jt.name.toLowerCase().includes(q)),
      );
    }

    const total    = docs.length;
    const skip     = (page - 1) * safeLimit;
    const pageDocs = docs.slice(skip, skip + safeLimit);

    const data = pageDocs.map((u) => formatUser(u, orgJobTitlesByUser[u.id] ?? []));

    return { data, total, page, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`User con id ${id} no encontrado`);
    const orgJobTitlesByUser = await this.jobTitles.getActiveByMembershipUserIds([id]);
    return formatUser(this.fb.toObj(snap), orgJobTitlesByUser[id] ?? []);
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

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 12) : null;
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
      phone:             dto.phone?.trim()            ?? null,
      country:           dto.country?.trim()          ?? null,
      bio:               dto.bio?.trim()              ?? null,
      birthDate:         dto.birthDate?.trim()        ?? null,
      ministerialTitle:  dto.ministerialTitle         ?? null,
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
    if (dto.phone             !== undefined) data.phone             = dto.phone?.trim()            ?? null;
    if (dto.country           !== undefined) data.country           = dto.country?.trim()          ?? null;
    if (dto.bio               !== undefined) data.bio               = dto.bio?.trim()              ?? null;
    if (dto.birthDate         !== undefined) data.birthDate         = dto.birthDate?.trim()        ?? null;
    if (dto.gender            !== undefined) data.gender            = dto.gender                   ?? null;
    if (dto.status            !== undefined) data.status            = dto.status;
    if (dto.ministerialTitle  !== undefined) data.ministerialTitle  = dto.ministerialTitle         ?? null;
    if (dto.memberSince       !== undefined) data.memberSince       = dto.memberSince?.trim()      ?? null;
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

    // Limpiar sus membresías del organigrama para no dejar registros huérfanos
    const membSnap = await this.fb.db.collection('org_memberships').where('userId', '==', id).get();
    const batch = this.fb.db.batch();
    membSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(this.fb.db.collection(COL).doc(String(id)));
    await batch.commit();

    return { id };
  }

  async updateLastLogin(id: number) {
    await this.fb.db.collection(COL).doc(String(id)).update({ lastLoginAt: this.fb.now() });
  }

  async patchGoogleFields(id: number, patch: Record<string, string>) {
    const data: Record<string, any> = { ...patch, updatedAt: this.fb.now() };
    if (patch.firstName || patch.lastName) {
      const snap = await this.fb.db.collection(COL).doc(String(id)).get();
      const current = snap.data()!;
      data.nameLower = `${patch.firstName ?? current.firstName} ${patch.lastName ?? current.lastName}`.toLowerCase();
    }
    await this.fb.db.collection(COL).doc(String(id)).update(data);
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    return this.fb.toObj(snap);
  }

  async claimAccount(id: number, data: { firstName: string; lastName: string; password: string }) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    await this.fb.db.collection(COL).doc(String(id)).update({
      firstName: data.firstName.trim(),
      lastName:  data.lastName.trim(),
      nameLower: `${data.firstName} ${data.lastName}`.toLowerCase(),
      passwordHash,
      updatedAt: this.fb.now(),
    });
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    return this.fb.toObj(snap);
  }

  async selfRegister(data: {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  }) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Ya existe un usuario con ese email');

    const roleSnap = await this.fb.db.collection('roles').doc('2').get();
    const role = roleSnap.exists
      ? { id: 2, name: roleSnap.data()!.name }
      : { id: 2, name: 'employee' };

    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null;
    const id = await this.fb.nextId(COL);

    const doc = {
      id, email, passwordHash,
      firstName:    data.firstName.trim(),
      lastName:     data.lastName.trim(),
      nameLower:    `${data.firstName} ${data.lastName}`.toLowerCase(),
      roleId:       2,
      role,
      campusId:     null,
      campus:       null,
      jobTitles:    [],
      phone:             null,
      country:           null,
      bio:               null,
      birthDate:         null,
      gender:            null,
      ministerialTitle:  null,
      avatarUrl:         data.avatarUrl ?? null,
      status:            'pending',
      departmentId: null,
      lastLoginAt:  null,
      createdAt:    this.fb.now(),
      updatedAt:    this.fb.now(),
    };

    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    // Retorna raw (con passwordHash) igual que findByEmail, para que AuthService lo procese
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    return this.fb.toObj(snap);
  }

  async approve(id: number, roleId?: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`User con id ${id} no encontrado`);
    const currentStatus = snap.data()!.status;
    // 'rejected' también es aprobable: un admin puede reconsiderar una decisión anterior.
    if (currentStatus !== 'pending' && currentStatus !== 'rejected') {
      throw new ConflictException('El usuario no está pendiente de aprobación ni fue rechazado previamente');
    }

    const data: Record<string, any> = { status: 'active', updatedAt: this.fb.now() };
    if (roleId !== undefined) {
      const roleSnap = await this.fb.db.collection('roles').doc(String(roleId)).get();
      if (!roleSnap.exists) throw new NotFoundException(`Rol con id ${roleId} no encontrado`);
      data.roleId = roleId;
      data.role   = { id: roleId, name: roleSnap.data()!.name };
    }
    await this.fb.db.collection(COL).doc(String(id)).update(data);

    this.notifications.create({
      userId: id,
      title: 'Tu cuenta fue aprobada',
      body: 'Un administrador aprobó tu registro. Ya puedes iniciar sesión.',
      link: '/auth/login',
      channel: 'in_app',
    }, 0).catch((e) => this.logger.warn(`No se pudo notificar aprobación a user ${id}: ${e.message}`));

    return this.findOne(id);
  }

  async reject(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`User con id ${id} no encontrado`);
    if (snap.data()!.status !== 'pending') {
      throw new ConflictException('El usuario no está pendiente de aprobación');
    }
    await this.fb.db.collection(COL).doc(String(id)).update({ status: 'rejected', updatedAt: this.fb.now() });

    this.notifications.create({
      userId: id,
      title: 'Tu solicitud de registro fue rechazada',
      body: 'Un administrador rechazó tu solicitud de registro. Contacta a un administrador si crees que es un error.',
      link: '/auth/login',
      channel: 'in_app',
    }, 0).catch((e) => this.logger.warn(`No se pudo notificar rechazo a user ${id}: ${e.message}`));

    return this.findOne(id);
  }

  async uploadAvatar(id: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo no permitido: ${file.mimetype}`);
    }

    try {
      const snap = await this.fb.db.collection(COL).doc(String(id)).get();
      if (!snap.exists) throw new NotFoundException(`User ${id} no encontrado`);

      const key = `avatars/user-${id}-${Date.now()}${this.extOf(file.mimetype)}`;
      this.logger.log(`Subiendo avatar: key=${key}, size=${file.size}, mime=${file.mimetype}`);

      const avatarUrl = await this.storage.uploadPublic(key, file.buffer, file.mimetype);
      this.logger.log(`Avatar guardado: ${avatarUrl}`);

      await this.fb.db.collection(COL).doc(String(id)).update({ avatarUrl, updatedAt: this.fb.now() });
      return this.findOne(id);
    } catch (err) {
      this.logger.error('uploadAvatar falló', err instanceof Error ? err.stack : String(err));
      throw err;
    }
  }

  private extOf(mime: string) {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png':  '.png',
      'image/webp': '.webp',
      'image/gif':  '.gif',
      'image/heic': '.heic',
      'image/heif': '.heif',
    };
    return map[mime] ?? '.jpg';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async resolveJobTitles(ids: number[]) {
    if (!ids.length) return [];
    const snaps = await Promise.all(
      ids.map((jid) => this.fb.db.collection('job_titles').doc(String(jid)).get()),
    );
    // Mantener el índice original ANTES de filtrar para que jobTitleId corresponda
    // al id correcto (filter() reindexaría y asignaría ids erróneos)
    return snaps
      .map((s, i) => s.exists ? { jobTitleId: ids[i], name: s.data()!.name, sortOrder: i } : null)
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }
}
