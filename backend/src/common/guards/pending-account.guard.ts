import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PENDING_KEY } from '../decorators/allow-pending.decorator';

/**
 * Corre después del JwtAuthGuard global. Una cuenta con status 'pending'
 * (autoregistrada, aún no aprobada por un admin) solo puede llegar a
 * endpoints marcados con @AllowPending() — el wizard de bienvenida, /auth/me
 * y logout. Todo lo demás devuelve 403, aunque el JWT sea válido.
 */
@Injectable()
export class PendingAccountGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user || user.status !== 'pending') return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    throw new ForbiddenException('Tu cuenta aún no ha sido aprobada por un administrador.');
  }
}
