import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  /**
   * Propaga `?return_to=` como el parámetro `state` de OAuth para que, tras el
   * callback de Google, sepamos a qué frontend (intranet o PWA móvil) redirigir.
   * El valor se valida contra la allowlist en el callback (no aquí).
   */
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const returnTo = req.query?.return_to;
    return returnTo ? { state: String(returnTo) } : {};
  }
}
