import { SetMetadata } from '@nestjs/common';

/**
 * Marca un endpoint como accesible para cuentas con status 'pending' (aún no
 * aprobadas por un admin). Por defecto, PendingAccountGuard bloquea a estas
 * cuentas de todo lo que no sea el wizard de bienvenida.
 */
export const ALLOW_PENDING_KEY = 'allowPending';
export const AllowPending = () => SetMetadata(ALLOW_PENDING_KEY, true);
