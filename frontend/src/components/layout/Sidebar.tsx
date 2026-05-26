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

function PerfilIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.35)';
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MiFichaIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.35)';
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <circle cx="6" cy="6" r="2.5" fill={c} stroke="none" />
    </svg>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.4)';
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  );
}

function MinisteriosIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.4)';
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function NoticiasIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.35)';
  return (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z" />
      <polyline points="17 20 17 13 7 13 7 20" />
      <polyline points="7 4 7 8 15 8" />
    </svg>
  );
}

// Ícono genérico para subítems de ministerios (punto + línea)
function MinisterioSubIcon({ active }: { active: boolean }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ background: active ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)' }}
    />
  );
}

// ── Estructura de navegación ──────────────────────────────────────────────────

interface NavGroup {
  href:      string;
  label:     string;
  icon:      (p: { active: boolean }) => React.JSX.Element;
  children?: { href: string; label: string; icon: (p: { active: boolean }) => React.JSX.Element }[];
}

const NAV: NavGroup[] = [
  {
    href:  '/dashboard',
    label: 'Inicio',
    icon:  HomeIcon,
    children: [
      { href: '/dashboard/perfil',     label: 'Mi Perfil',  icon: PerfilIcon  },
      { href: '/dashboard/mis-fichas', label: 'Mis Fichas', icon: MiFichaIcon },
    ],
  },
  {
    href:  '/dashboard/produccion-general',
    label: 'Producción General',
    icon:  ProduccionIcon,
    children: [
      { href: '/dashboard/fichas-tecnicas',             label: 'Fichas Técnicas', icon: FichaIcon    },
      { href: '/dashboard/produccion-general/noticias', label: 'Noticias',        icon: NoticiasIcon },
    ],
  },
  { href: '/dashboard/orgchart',                        label: 'Organigrama',   icon: OrgIcon          },
  { href: '/dashboard/produccion-general/estadisticas', label: 'Estadísticas',  icon: StatsIcon        },
  {
    href:  '/dashboard/ministerios',
    label: 'Ministerios',
    icon:  MinisteriosIcon,
    children: [
      { href: '/dashboard/ministerios/ar-kids',    label: 'AR Kids',    icon: MinisterioSubIcon },
      { href: '/dashboard/ministerios/ar-tweens',  label: 'AR Tweens',  icon: MinisterioSubIcon },
      { href: '/dashboard/ministerios/ar-teens',   label: 'AR Teens',   icon: MinisterioSubIcon },
      { href: '/dashboard/ministerios/ar-jovenes', label: 'AR Jóvenes', icon: MinisterioSubIcon },
      { href: '/dashboard/ministerios/ar-worship', label: 'AR Worship', icon: MinisterioSubIcon },
      { href: '/dashboard/ministerios/ar-hombres', label: 'AR Hombres', icon: MinisterioSubIcon },
      { href: '/dashboard/ministerios/ar-mujeres', label: 'AR Mujeres', icon: MinisterioSubIcon },
      { href: '/dashboard/ministerios/ar-gold',    label: 'AR Gold',    icon: MinisterioSubIcon },
    ],
  },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { logout, refreshToken, user } = useAuthStore();

  const [menuOpen,        setMenuOpen]        = useState(false);
  const [collapsed,       setCollapsed]       = useState(false);
  const [expandedGroups,  setExpandedGroups]  = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // Leer preferencia guardada
  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true);
  }, []);

  // Auto-expandir el grupo cuyo hijo esté activo al cambiar de ruta
  useEffect(() => {
    NAV.forEach(({ href, children }) => {
      if (children?.some((c) => pathname.startsWith(c.href))) {
        setExpandedGroups((prev) => {
          if (prev.has(href)) return prev;
          const next = new Set(prev);
          next.add(href);
          return next;
        });
      }
    });
  }, [pathname]);

  function toggleGroup(href: string, e: React.MouseEvent) {
    // Permitir que el Link navegue pero también alternar el grupo
    e.preventDefault();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(href) ? next.delete(href) : next.add(href);
      return next;
    });
    router.push(href);
  }

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }

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
    <>
      {/* Botón flotante para reabrir cuando está colapsado */}
      {collapsed && (
        <button
          onClick={toggleSidebar}
          title="Abrir menú"
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-5 h-10 rounded-r-md transition-all hover:w-6"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderLeft: 'none' }}
        >
          <svg className="w-3 h-3 text-white/40 hover:text-white/70" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

    <aside
      style={{ background: '#0d0d0d', borderRight: '1px solid #1f1f1f' }}
      className={`flex flex-col shrink-0 print:hidden overflow-hidden transition-all duration-300 ease-in-out ${
        collapsed ? 'w-0' : 'w-56'
      }`}
    >
      {/* Logo + botón colapsar */}
      <div style={{ borderBottom: '1px solid #1f1f1f' }}
        className="px-4 pt-4 pb-2 flex items-center justify-between gap-2 min-w-[224px]">
        <Image src="/logo.png" alt="Logo" width={100} height={28}
          className="object-contain" priority />
        <button
          onClick={toggleSidebar}
          title="Ocultar menú"
          className="flex items-center justify-center w-6 h-6 rounded-md transition-all hover:bg-white/10 flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5 text-white/30 hover:text-white/60" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 pt-4 space-y-0.5 min-w-[224px]">
        {NAV.map(({ href, label, icon: Icon, children }) => {
          const childActive  = children?.some((c) => pathname.startsWith(c.href)) ?? false;
          const isExpanded   = expandedGroups.has(href);

          const active =
            href === '/dashboard'
              ? pathname === '/dashboard'
              : href === '/dashboard/produccion-general'
                ? pathname === '/dashboard/produccion-general'
                  || pathname.startsWith('/dashboard/fichas-tecnicas')
                  || childActive
                : pathname.startsWith(href);

          return (
            <div key={href}>
              {/* Ítem principal */}
              <Link
                href={href}
                onClick={children ? (e) => toggleGroup(href, e) : undefined}
                style={active ? { background: 'rgba(255,255,255,0.08)' } : {}}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? 'text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <Icon active={active} />
                <span className="flex-1">{label}</span>
                {/* Chevron para ítems con hijos */}
                {children && (
                  <svg
                    className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    } ${active ? 'text-white/50' : 'text-white/20'}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </Link>

              {/* Sub-ítems colapsables */}
              {children && isExpanded && (
                <div className="mt-0.5 space-y-0.5">
                  {children.map(({ href: chref, label: clabel, icon: CIcon }) => {
                    const cActive = pathname.startsWith(chref);
                    return (
                      <Link
                        key={chref}
                        href={chref}
                        style={cActive ? { background: 'rgba(255,255,255,0.06)' } : {}}
                        className={`flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          cActive ? 'text-white/90' : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                        }`}
                      >
                        <span
                          className="flex-shrink-0 w-px h-3 rounded-full"
                          style={{ background: cActive ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)' }}
                        />
                        <CIcon active={cActive} />
                        {clabel}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Configuración */}
      <div className="px-3 pb-1 min-w-[224px]">
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
        className="relative px-3 py-3 min-w-[224px]">
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
    </>
  );
}
