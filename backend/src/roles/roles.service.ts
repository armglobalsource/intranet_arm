import {
  ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit,
} from '@nestjs/common';
import { FirebaseService } from '../common/firebase/firebase.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

const COL = 'roles';

const DEFAULT_ROLES = [
  {
    id: 1, name: 'admin', isSystem: true,
    description:  'Administrador con acceso total al sistema',
    permissions:  ['*'],
  },
  {
    id: 2, name: 'user', isSystem: true,
    description:  'Usuario estándar con acceso de solo lectura',
    permissions:  [
      'orgchart:view', 'users:view', 'content:view',
      'documents:view', 'directory:view',
    ],
  },
];

/** Normaliza docs existentes que puedan carecer de campos nuevos */
function normalize(role: any) {
  return {
    ...role,
    isSystem:    role.isSystem    ?? false,
    isActive:    role.isActive    ?? true,
    nameLower:   role.nameLower   ?? role.name?.toLowerCase() ?? '',
    permissions: role.permissions ?? [],
  };
}

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(private fb: FirebaseService) {}

  async onModuleInit() {
    const snap = await this.fb.db.collection(COL).get();

    if (snap.empty) {
      // Colección vacía → seed completo
      this.logger.log('Colección roles vacía — seeding roles por defecto...');
      const batch = this.fb.db.batch();
      for (const role of DEFAULT_ROLES) {
        batch.set(this.fb.db.collection(COL).doc(String(role.id)), {
          ...role,
          nameLower: role.name,
          isActive:  true,
          createdAt: this.fb.now(),
          updatedAt: this.fb.now(),
        });
      }
      const counterRef = this.fb.db.collection('_counters').doc(COL);
      batch.set(counterRef, { next: DEFAULT_ROLES.length + 1 });
      await batch.commit();
      this.logger.log(`Roles seeded: ${DEFAULT_ROLES.map((r) => r.name).join(', ')}`);
      return;
    }

    // Migrar roles existentes que no tengan permissions[]
    const batch = this.fb.db.batch();
    let migrated = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!data.permissions) {
        const defaults = DEFAULT_ROLES.find((r) => r.id === data.id);
        batch.update(doc.ref, {
          permissions: defaults?.permissions ?? [],
          updatedAt:   this.fb.now(),
        });
        migrated++;
      }
    }
    if (migrated > 0) {
      await batch.commit();
      this.logger.log(`Migrados ${migrated} roles con permissions[]`);
    }
  }

  async findAll() {
    const [rolesSnap, usersSnap] = await Promise.all([
      this.fb.db.collection(COL).get(),
      this.fb.db.collection('users').get(),
    ]);

    const users = this.fb.toDocs(usersSnap);
    const roles = this.fb.toDocs(rolesSnap)
      .map(normalize)
      .sort((a, b) => a.name.localeCompare(b.name));

    return roles.map((role) => ({
      ...role,
      userCount: users.filter((u) => u.roleId === role.id).length,
    }));
  }

  async findOne(id: number) {
    const snap = await this.fb.db.collection(COL).doc(String(id)).get();
    if (!snap.exists) throw new NotFoundException(`Rol con id ${id} no encontrado`);
    return normalize(this.fb.toObj(snap));
  }

  async create(dto: CreateRoleDto) {
    const nameLower = dto.name.trim().toLowerCase();
    const existing = await this.fb.db.collection(COL)
      .where('nameLower', '==', nameLower).limit(1).get();
    if (!existing.empty) throw new ConflictException(`Ya existe el rol "${dto.name.trim()}"`);

    const id  = await this.fb.nextId(COL);
    const doc = {
      id,
      name:        dto.name.trim(),
      nameLower,
      description: dto.description?.trim() ?? null,
      isSystem:    false,
      isActive:    true,
      createdAt:   this.fb.now(),
      updatedAt:   this.fb.now(),
    };
    await this.fb.db.collection(COL).doc(String(id)).set(doc);
    return normalize(this.fb.toObj(await this.fb.db.collection(COL).doc(String(id)).get()));
  }

  async update(id: number, dto: UpdateRoleDto) {
    const existing = await this.findOne(id);

    if (dto.name !== undefined) {
      const nameLower = dto.name.trim().toLowerCase();
      const snap = await this.fb.db.collection(COL)
        .where('nameLower', '==', nameLower).limit(1).get();
      if (!snap.empty && snap.docs[0].data().id !== id) {
        throw new ConflictException(`Ya existe el rol "${dto.name.trim()}"`);
      }
      if (existing.isSystem && nameLower !== existing.nameLower) {
        throw new ForbiddenException('Los roles del sistema no pueden renombrarse');
      }
    }

    if (dto.isActive === false && existing.isSystem) {
      throw new ForbiddenException('Los roles del sistema no pueden deshabilitarse');
    }

    const data: any = { updatedAt: this.fb.now() };
    if (dto.name     !== undefined) {
      data.name      = dto.name.trim();
      data.nameLower = dto.name.trim().toLowerCase();
    }
    if (dto.description !== undefined) data.description = dto.description?.trim() ?? null;
    if (dto.isActive    !== undefined) data.isActive = dto.isActive;
    if (dto.permissions !== undefined) data.permissions = dto.permissions;

    await this.fb.db.collection(COL).doc(String(id)).update(data);
    return this.findOne(id);
  }

  async remove(id: number) {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new ForbiddenException('Los roles del sistema no pueden eliminarse');
    }

    const snap = await this.fb.db.collection('users')
      .where('roleId', '==', id).limit(1).get();
    if (!snap.empty) {
      throw new ConflictException('No se puede eliminar un rol que tiene usuarios asignados');
    }

    await this.fb.db.collection(COL).doc(String(id)).delete();
    return { id };
  }
}
