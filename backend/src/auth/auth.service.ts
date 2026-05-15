import {
  Injectable, UnauthorizedException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../common/firebase/firebase.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'crypto';
import { LoginDto } from './dto/login.dto';
import * as admin from 'firebase-admin';

export interface JwtPayload {
  sub:         number;
  email:       string;
  role:        string;
  roleId:      number;
  permissions: string[];
  jti:         string;
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

    const payload: JwtPayload = { sub: userId, email, role, roleId, permissions, jti };
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
