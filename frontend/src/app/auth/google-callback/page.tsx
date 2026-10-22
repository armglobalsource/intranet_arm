'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { api } from '@/lib/api';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d0d' }}>
    <span className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
  </div>
);

function GoogleCallbackInner() {
  const router       = useRouter();
  const params       = useSearchParams();
  const setSession   = useAuthStore((s) => s.setSession);

  useEffect(() => {
    const access  = params?.get('access') ?? null;
    const refresh = params?.get('refresh') ?? null;
    if (!access || !refresh) { router.replace('/auth/login?error=oauth_failed'); return; }

    api.get('/auth/me', { headers: { Authorization: `Bearer ${access}` } })
      .then((res) => {
        setSession(res.data, access, refresh, false);
        router.replace('/dashboard');
      })
      .catch(() => router.replace('/auth/login?error=oauth_failed'));
  }, [params, router, setSession]);

  return <Spinner />;
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <GoogleCallbackInner />
    </Suspense>
  );
}
