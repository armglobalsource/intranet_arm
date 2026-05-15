import { useAuthStore } from '@/lib/store/auth.store';
import { hasPermission } from '@/lib/permissions';

export function usePermissions() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  return {
    can:     (perm: string) => hasPermission(permissions, perm),
    isAdmin: permissions.includes('*'),
    permissions,
  };
}
