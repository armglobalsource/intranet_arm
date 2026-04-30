import {
  Injectable, UnauthorizedException, BadRequestException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'crypto';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Cuenta suspendida o inactiva');
    }

    // Actualizar último login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role.name, ipAddress, userAgent);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Rotación: revocar el actual y emitir uno nuevo
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.generateTokens(stored.userId, stored.user.email, stored.user.role.name);
  }

  async logout(userId: number, rawRefreshToken: string, accessJti: string, accessExp: number) {
    const tokenHash = this.hashToken(rawRefreshToken);

    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash },
      data: { revokedAt: new Date() },
    });

    // Revocar access token hasta su expiración natural
    await this.prisma.revokedToken.create({
      data: { jti: accessJti, expiresAt: new Date(accessExp * 1000) },
    });
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    const revoked = await this.prisma.revokedToken.findUnique({ where: { jti } });
    return !!revoked;
  }

  private async generateTokens(
    userId: number, email: string, role: string,
    ipAddress?: string, userAgent?: string,
  ) {
    const jti = randomUUID();
    const accessTtl  = this.config.get<number>('JWT_ACCESS_TTL',  900);
    const refreshTtl = this.config.get<number>('JWT_REFRESH_TTL', 28800);

    const payload: JwtPayload = { sub: userId, email, role, jti };
    const accessToken = this.jwt.sign(payload, { expiresIn: `${accessTtl}s` });

    const rawRefreshToken = randomUUID();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + refreshTtl * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt, ipAddress, userAgent },
    });

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: accessTtl };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
