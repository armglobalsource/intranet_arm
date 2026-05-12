'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated     = useAuthStore((s) => s._hasHydrated);
  const router = useRouter();

  useEffect(() => {
    // Wait until Zustand has read localStorage before deciding to redirect.
    // Without this guard, the first render always sees isAuthenticated=false
    // (Zustand hasn't hydrated yet) and sends the user to /login on every refresh.
    if (hasHydrated && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, hasHydrated, router]);

  // Still hydrating → show nothing (avoids flash of login redirect)
  if (!hasHydrated) return null;

  // Hydrated but not authenticated → nothing while redirect fires
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
