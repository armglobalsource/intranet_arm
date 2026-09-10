'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated     = useAuthStore((s) => s._hasHydrated);
  const isPending       = useAuthStore((s) => s.user?.status === 'pending');
  const router = useRouter();

  useEffect(() => {
    // Wait until Zustand has read localStorage before deciding to redirect.
    // Without this guard, the first render always sees isAuthenticated=false
    // (Zustand hasn't hydrated yet) and sends the user to /login on every refresh.
    if (hasHydrated && !isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    // Cuenta pendiente de aprobación: el backend (PendingAccountGuard) ya le
    // bloquea todos los endpoints salvo el wizard de bienvenida, pero además
    // no debe ni ver el shell del dashboard — la mandamos de vuelta al wizard
    // (que muestra la pantalla de "espera aprobación" si ya lo llenó).
    if (hasHydrated && isAuthenticated && isPending) {
      router.replace('/auth/complete-profile');
    }
  }, [isAuthenticated, hasHydrated, isPending, router]);

  // Still hydrating → show nothing (avoids flash of login redirect)
  if (!hasHydrated) return null;

  // Hydrated but not authenticated → nothing while redirect fires
  if (!isAuthenticated) return null;

  // Pendiente de aprobación → nada mientras el redirect al wizard se dispara
  if (isPending) return null;

  return <>{children}</>;
}
