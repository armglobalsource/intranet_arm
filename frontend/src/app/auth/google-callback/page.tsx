'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { api } from '@/lib/api';

export default function GoogleCallbackPage() {
  const router       = useRouter();
  const params       = useSearchParams();
  const setSession   = useAuthStore((s) => s.setSession);

  useEffect(() => {
    const access  = params.get('access');
    const refresh = params.get('refresh');
    if (!access || !refresh) { router.replace('/auth/login?error=oauth_failed'); return; }

    // Cargar datos del usuario con el token recibido
    api.get('/auth/me', { headers: { Authorization: `Bearer ${access}` } })
      .then((res) => {
        setSession(res.data, access, refresh, false);
        router.replace('/dashboard/orgchart');
      })
      .catch(() => router.replace('/auth/login?error=oauth_failed'));
  }, [params, router, setSession]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
      <span className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
    </div>
  );
}
