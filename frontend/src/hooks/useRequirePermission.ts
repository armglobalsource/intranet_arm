'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from './usePermissions';

/**
 * Gate de página: redirige a `redirectTo` si el usuario logueado no tiene
 * el permiso requerido. Devuelve `false` mientras redirige — el caller debe
 * hacer `if (!allowed) return null;` para no renderizar contenido protegido.
 *
 * @example
 * const allowed = useRequirePermission('users:view');
 * if (!allowed) return null;
 */
export function useRequirePermission(permission: string, redirectTo = '/dashboard') {
  const router = useRouter();
  const { can, isAdmin } = usePermissions();
  const allowed = isAdmin || can(permission);

  useEffect(() => {
    if (!allowed) router.replace(redirectTo);
  }, [allowed, router, redirectTo]);

  return allowed;
}
