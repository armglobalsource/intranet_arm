'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
// useEffect es usado por el menú de usuario
import { useAuthStore } from '@/lib/store/auth.store';
import { api } from '@/lib/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface NavItem {
  href:  string;
  label: string;
  icon:  (p: { active: boolean }) => React.JSX.Element;
}

// ── Iconos ────────────────────────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 21 9 13 15 13 15 21" />
    </svg>
  );
}

function OrgIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#fff' : 'rgba(255,255,255,0.4)'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <rect x="1" y="16" width="6" height="4" rx="1" />
      <rect x="9" y="16" width="6" height="4" rx="1" />
      <rect x="17" y="16" width="6" height="4" rx="1" />
      <path d="M4 16v-4h16v4" /><path d="M12 6v6" />
    </svg>
  );
}

function ConfigIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.4)';
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ProduccionIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.4)';
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7l-4-5-4 5" />
      <circle cx="12" cy="14" r="2" />
      <path d="M9.5 14h-3M17.5 14h-3" />
    </svg>
  );
}

function FichaIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#fff' : 'rgba(255,255,255,0.35)'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.35)';
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  );
}

// ── Estructura de navegación ──────────────────────────────────────────────────

const NAV: NavItem[] = [
  { href: '/dashboard',                                     label: 'Inicio',             icon: HomeIcon       },
  { href: '/dashboard/orgchart',                            label: 'Organigrama',        icon: OrgIcon        },
  { href: '/dashboard/produccion-general',                  label: 'Producción General', icon: ProduccionIcon },
  { href: '/dashboard/produccion-general/estadisticas',     label: 'Estadísticas',       icon: StatsIcon      },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { logout, refreshToken, user } = useAuthStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = user
    ? ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || '??'
    : '??';
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';
  const role     = user?.role?.name ?? '';

  async function handleLogout() {
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {});
    } finally {
      logout();
      router.replace('/auth/login');
    }
  }

  return (
    <aside
      style={{ background: '#0d0d0d', borderRight: '1px solid #1f1f1f' }}
      className="w-56 flex flex-col shrink-0 print:hidden"
    >
      {/* Logo */}
      <div style={{ borderBottom: '1px solid #1f1f1f' }}
        className="px-4 pt-4 pb-2 flex items-center justify-center">
        <Image src="/logo.png" alt="Logo" width={100} height={28}
          className="object-contain" priority />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 pt-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            (href === '/dashboard'
              ? pathname === '/dashboard'
              : href === '/dashboard/produccion-general'
                ? (pathname === '/dashboard/produccion-general' || pathname.startsWith('/dashboard/fichas-tecnicas'))
                : pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={active ? { background: 'rgba(255,255,255,0.08)' } : {}}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <Icon active={active} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Configuración */}
      <div className="px-3 pb-1">
        {(() => {
          const href   = '/dashboard/directorio';
          const active = pathname.startsWith(href);
          return (
            <Link
              href={href}
              style={active ? { background: 'rgba(255,255,255,0.08)' } : {}}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
              }`}
            >
              <ConfigIcon active={active} />
              Configuración
            </Link>
          );
        })()}
      </div>

      {/* Usuario con menú */}
      <div ref={menuRef} style={{ borderTop: '1px solid #1f1f1f' }}
        className="relative px-3 py-3">
        {menuOpen && (
          <div
            className="absolute bottom-full left-3 right-3 mb-1 rounded-lg overflow-hidden shadow-lg"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
          >
            <Link
              href="/dashboard/perfil"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-[12px] text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Mi perfil
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[12px] text-white/40 hover:text-white/60 hover:bg-white/5 transition-all"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 w-full rounded-lg px-1 py-1 hover:bg-white/5 transition-all text-left"
        >
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={fullName}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white/75 text-[12px] font-medium truncate leading-none">{fullName}</p>
            {role && <p className="text-white/30 text-[10px] mt-0.5 truncate">{role}</p>}
          </div>
          <svg
            className={`w-3 h-3 flex-shrink-0 text-white/20 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
