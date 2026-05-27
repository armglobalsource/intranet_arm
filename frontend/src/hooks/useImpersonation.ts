'use client';

import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store/auth.store';

export function useImpersonation() {
  const qc = useQueryClient();
  const { startImpersonation, exitImpersonation, impersonation } = useAuthStore();

  async function start(roleId: number) {
    const { data } = await api.post<{ accessToken: string; roleName: string; permissions: string[] }>(
      '/auth/impersonate',
      { roleId },
    );
    startImpersonation(data.accessToken, roleId, data.roleName, data.permissions);
    qc.clear();
    window.location.reload();
  }

  function exit() {
    exitImpersonation();
    qc.clear();
    window.location.reload();
  }

  return { start, exit, impersonation };
}
