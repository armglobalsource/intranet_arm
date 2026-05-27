import {
  Injectable, UnauthorizedException, ConflictException, ForbiddenException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../common/firebase/firebase.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateUserDto } from '../users/dto/create-user.dto';
import { NotificationsService } from '../notifications/notifications.service';
import * as admin from 'firebase-admin';

export interface JwtPayload {
  sub:         number;
  email:       string;
  role:        string;
  roleId:      number;
  permissions: string[];
  jti:         string;
  campusId?:   number | null;
}

const RT_COL  = 'refresh_tokens';
const REV_COL = 'revoked_tokens';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private fb: FirebaseService,
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Cuenta suspendida o inactiva');
    }

    await this.users.updateLastLogin(user.id);

    const roleName = user.role?.name ?? 'user';
    const roleId   = user.roleId ?? user.role?.id ?? 0;
    const { permissions, ...tokens } = await this.generateTokens(user.id, user.email, roleName, roleId, ipAddress, userAgent);

    const { passwordHash, ...safeUser } = user;
    return { user: { ...safeUser, permissions }, ...tokens };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const snap = await this.fb.db.collection(RT_COL)
      .where('tokenHash', '==', tokenHash).limit(1).get();

    if (snap.empty) throw new UnauthorizedException('Refresh token inválido o expirado');
    const stored = snap.docs[0].data();
    if (stored.revokedAt || stored.expiresAt.toDate() < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Revocar token actual
    await snap.docs[0].ref.update({ revokedAt: this.fb.now() });

    const user = await this.users.findOne(stored.userId);
    const roleId = user.roleId ?? user.role?.id ?? 0;
    return this.generateTokens(stored.userId, user.email, user.role?.name ?? 'user', roleId);
  }

  async logout(userId: number, rawRefreshToken: string, accessJti: string, accessExp: number) {
    const tokenHash = this.hashToken(rawRefreshToken);

    // Revocar refresh tokens del usuario con ese hash
    const snap = await this.fb.db.collection(RT_COL)
      .where('userId', '==', userId)
      .where('tokenHash', '==', tokenHash).get();
    const batch = this.fb.db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { revokedAt: this.fb.now() }));

    // Revocar access token
    const revId = await this.fb.nextId(REV_COL);
    batch.set(this.fb.db.collection(REV_COL).doc(String(revId)), {
      id: revId, jti: accessJti,
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(accessExp * 1000)),
    });

    await batch.commit();
  }

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    let user = await this.users.findByEmail(dto.email);

    if (user) {
      // Cuenta pre-creada por admin sin contraseña: el usuario la está reclamando
      if (user.passwordHash) {
        throw new ConflictException('Este email ya tiene una cuenta. Usa "Iniciar sesión".');
      }
      // Actualizar nombre (si estaba vacío) y establecer contraseña
      user = await this.users.claimAccount(user.id, {
        firstName: dto.firstName || user.firstName,
        lastName:  dto.lastName  || user.lastName,
      });
    } else {
      user = await this.users.selfRegister({
        email:     dto.email,
        password:  dto.password,
        firstName: dto.firstName,
        lastName:  dto.lastName,
      });
      this.notifications.create({
        userId:  0,
        title:   `Nuevo usuario registrado: ${dto.firstName} ${dto.lastName}`,
        body:    `${dto.email} se registró y necesita que le asignes un rol.`,
        link:    '/dashboard/directorio/usuarios',
        channel: 'in_app',
      }, 0).catch((e) => this.logger.warn('No se pudo crear notificación de registro', e));
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Cuenta suspendida o inactiva');
    }

    await this.users.updateLastLogin(user.id);
    const roleName = user.role?.name ?? 'employee';
    const roleId   = user.roleId ?? 2;
    const { permissions, ...tokens } = await this.generateTokens(user.id, user.email, roleName, roleId, ipAddress, userAgent);

    const needsProfileCompletion = !user.gender || !user.avatarUrl;
    const { passwordHash, ...safeUser } = user;
    return { user: { ...safeUser, permissions }, ...tokens, needsProfileCompletion };
  }

  async checkEmail(email: string) {
    const user = await this.users.findByEmail(email);
    if (!user) return { exists: false };

    const missingFields: string[] = [];
    if (!user.gender)      missingFields.push('gender');
    if (!user.phone)       missingFields.push('phone');
    if (!user.avatarUrl)   missingFields.push('avatarUrl');
    if (!user.birthDate)   missingFields.push('birthDate');
    if (!user.passwordHash) missingFields.push('password');

    return {
      exists: true,
      needsProfileCompletion: missingFields.length > 0,
      missingFields,
      user: {
        firstName: user.firstName,
        lastName:  user.lastName,
        avatarUrl: user.avatarUrl,
        email:     user.email,
      },
    };
  }

  async googleAuth(
    googleUser: { email: string; firstName: string; lastName: string; avatarUrl?: string | null },
    ipAddress?: string,
    userAgent?: string,
  ) {
    let user = await this.users.findByEmail(googleUser.email);

    if (!user) {
      user = await this.users.selfRegister({
        email:     googleUser.email,
        firstName: googleUser.firstName,
        lastName:  googleUser.lastName,
        avatarUrl: googleUser.avatarUrl,
      });
      this.notifications.create({
        userId:  0,
        title:   `Nuevo usuario registrado: ${googleUser.firstName} ${googleUser.lastName}`,
        body:    `${googleUser.email} se registró con Google y necesita que le asignes un rol.`,
        link:    '/dashboard/directorio/usuarios',
        channel: 'in_app',
      }, 0).catch((e) => this.logger.warn('No se pudo crear notificación de registro Google', e));
    } else {
      // Sincronizar datos de Google: foto siempre, nombre solo si estaba vacío
      const patch: Record<string, string> = {};
      if (googleUser.avatarUrl)               patch.avatarUrl = googleUser.avatarUrl;
      if (!user.firstName && googleUser.firstName) patch.firstName = googleUser.firstName;
      if (!user.lastName  && googleUser.lastName)  patch.lastName  = googleUser.lastName;
      if (Object.keys(patch).length > 0) {
        user = await this.users.patchGoogleFields(user.id, patch);
      }
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Cuenta suspendida o inactiva');
    }

    await this.users.updateLastLogin(user.id);
    const roleName = user.role?.name ?? 'employee';
    const roleId   = user.roleId ?? 2;
    const { permissions, ...tokens } = await this.generateTokens(user.id, user.email, roleName, roleId, ipAddress, userAgent);

    const needsProfileCompletion = !user.gender;
    const { passwordHash, ...safeUser } = user;
    return { user: { ...safeUser, permissions }, ...tokens, needsProfileCompletion };
  }

  async getMe(userId: number) {
    return this.users.findOne(userId);
  }

  async completeProfile(userId: number, dto: CompleteProfileDto) {
    const update: UpdateUserDto = {};
    if (dto.firstName !== undefined) update.firstName = dto.firstName;
    if (dto.lastName  !== undefined) update.lastName  = dto.lastName;
    if (dto.gender    !== undefined) update.gender    = dto.gender;
    if (dto.phone     !== undefined) update.phone     = dto.phone;
    if (dto.birthDate !== undefined) update.birthDate = dto.birthDate;
    if (dto.password)                update.password  = dto.password;

    const user = await this.users.update(userId, update);
    return { user };
  }

  async impersonateRole(adminUserId: number, adminEmail: string, roleId: number) {
    const roleSnap = await this.fb.db.collection('roles').doc(String(roleId)).get();
    if (!roleSnap.exists) throw new ForbiddenException('Rol no encontrado');

    const roleData = roleSnap.data()!;
    if (roleData.name === 'admin' || (roleData.permissions ?? []).includes('*')) {
      throw new ForbiddenException('No puedes simular el rol admin');
    }
    if (roleData.isActive === false) {
      throw new ForbiddenException('El rol seleccionado no está activo');
    }

    const permissions: string[] = roleData.permissions ?? [];
    const roleName: string      = roleData.name;

    const userSnap = await this.fb.db.collection('users').doc(String(adminUserId)).get();
    const userData = userSnap.exists ? userSnap.data()! : {};

    const jti     = randomUUID();
    const payload = {
      sub: adminUserId, email: adminEmail,
      role: roleName, roleId,
      permissions, jti,
      campusId:      userData.campusId  ?? null,
      firstName:     userData.firstName ?? null,
      lastName:      userData.lastName  ?? null,
      impersonating: true,
    };

    const accessToken = this.jwt.sign(payload, { expiresIn: '4h' });
    return { accessToken, roleName, permissions };
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    const snap = await this.fb.db.collection(REV_COL)
      .where('jti', '==', jti).limit(1).get();
    if (snap.empty) return false;
    // Limpiar si ya expiró
    const doc = snap.docs[0].data();
    if (doc.expiresAt.toDate() < new Date()) {
      await snap.docs[0].ref.delete();
      return false;
    }
    return true;
  }

  private async generateTokens(
    userId: number, email: string, role: string, roleId: number,
    ipAddress?: string, userAgent?: string,
  ) {
    const jti        = randomUUID();
    const accessTtl  = this.config.get<number>('JWT_ACCESS_TTL',  900);
    const refreshTtl = this.config.get<number>('JWT_REFRESH_TTL', 28800);

    // Cargar permisos del rol desde Firestore
    const roleSnap   = await this.fb.db.collection('roles').doc(String(roleId)).get();
    const permissions: string[] = roleSnap.exists
      ? (roleSnap.data()!.permissions ?? [])
      : [];

    // Cargar campusId del usuario
    const userSnap = await this.fb.db.collection('users').doc(String(userId)).get();
    const campusId: number | null = userSnap.exists ? (userSnap.data()!.campusId ?? null) : null;

    const payload: JwtPayload = { sub: userId, email, role, roleId, permissions, jti, campusId };
    const accessToken = this.jwt.sign(payload, { expiresIn: `${accessTtl}s` });

    const rawRefreshToken = randomUUID();
    const tokenHash  = this.hashToken(rawRefreshToken);
    const expiresAt  = new Date(Date.now() + refreshTtl * 1000);
    const rtId       = await this.fb.nextId(RT_COL);

    await this.fb.db.collection(RT_COL).doc(String(rtId)).set({
      id: rtId, userId, tokenHash,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      revokedAt: null,
      createdAt: this.fb.now(),
    });

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: accessTtl, permissions };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
