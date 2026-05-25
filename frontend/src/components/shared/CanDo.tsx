'use client';

import { usePermissions } from '@/hooks/usePermissions';

interface Props {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only if the current user has the required permission.
 * Use for conditionally showing buttons, links, or sections.
 *
 * @example
 * <CanDo permission="fichas:create">
 *   <button>Nueva ficha</button>
 * </CanDo>
 */
export function CanDo({ permission, children, fallback = null }: Props) {
  const { can } = usePermissions();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
