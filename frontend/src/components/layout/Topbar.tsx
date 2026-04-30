'use client';

import { useAuthStore } from '@/lib/store/auth.store';

export function Topbar() {
  const user = useAuthStore((s) => s.user);

  const initials = user
    ? (user.firstName[0] + user.lastName[0]).toUpperCase()
    : '?';

  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  return (
    <header className="h-13 bg-white border-b border-gray-100 flex items-center px-6 gap-4 shrink-0">
      <div className="flex-1" />

      {/* Usuario actual */}
      <div className="flex items-center gap-2.5">
        <div className="text-right hidden sm:block">
          <p className="text-[13px] font-medium text-gray-800 leading-none">{fullName}</p>
          {user?.role && (
            <p className="text-[11px] text-gray-400 mt-0.5">{user.role.name}</p>
          )}
        </div>
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={fullName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
        )}
      </div>
    </header>
  );
}
