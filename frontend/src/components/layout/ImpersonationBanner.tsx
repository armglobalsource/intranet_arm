'use client';

import { useAuthStore } from '@/lib/store/auth.store';
import { useImpersonation } from '@/hooks/useImpersonation';

export function ImpersonationBanner() {
  const impersonation = useAuthStore((s) => s.impersonation);
  const { exit } = useImpersonation();

  if (!impersonation) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 shrink-0 print:hidden"
      style={{ background: '#f59e0b', borderBottom: '1px solid #d97706' }}
    >
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-amber-900 flex-shrink-0" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-[12px] font-semibold text-amber-900">
          Simulando como:{' '}
          <span className="font-bold">{impersonation.roleName}</span>
          <span className="font-normal opacity-70 ml-1.5">— lo que ves es lo que ve ese rol</span>
        </p>
      </div>
      <button
        onClick={exit}
        className="text-[11px] font-semibold text-amber-900 bg-amber-900/10 hover:bg-amber-900/20 px-3 py-1 rounded-full transition-colors flex-shrink-0"
      >
        Salir
      </button>
    </div>
  );
}
