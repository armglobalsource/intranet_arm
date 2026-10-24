'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
// useEffect es usado por el menú de usuario
import { useAuthStore } from '@/lib/store/auth.store';
import { usePermissions } from '@/hooks/usePermissions';
import { useSystemRoles } from '@/hooks/useRoles';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useNotifications } from '@/hooks/useNotifications';
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

function NoticiasIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.4)';
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10l6 6v8a2 2 0 0 1-2 2z" />
      <polyline points="17 20 17 13 7 13 7 20" />
      <polyline points="7 4 7 8 15 8" />
    </svg>
  );
}

function SiembraIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.4)';
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="9" y1="10.5" x2="15" y2="10.5" />
      <line x1="9" y1="13.5" x2="15" y2="13.5" />
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

// Ícono genérico para subítems de ministerios (punto + línea)
function MinisterioSubIcon({ active }: { active: boolean }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ background: active ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)' }}
    />
  );
}

function AdminCampusIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.4)';
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 21 9 13 15 13 15 21" />
    </svg>
  );
}

function SoporteIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.4)';
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="9" x2="15" y2="9" />
      <line x1="9" y1="13" x2="12" y2="13" />
    </svg>
  );
}

function TecnicosIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.4)';
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
      stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16h2l1-3 2 6 1-3h2" />
    </svg>
  );
}

// ── Estructura de navegación ──────────────────────────────────────────────────

interface NavGroup {
  href:        string;
  label:       string;
  icon:        (p: { active: boolean }) => React.JSX.Element;
  permission?: string;
  children?: { href: string; label: string; icon: (p: { active: boolean }) => React.JSX.Element; permission?: string }[];
}

const NAV: NavGroup[] = [
  {
    href:  '/dashboard',
    label: 'Inicio',
    icon:  HomeIcon,
  },
  {
    href:  '/dashboard/produccion-general',
    label: 'Producción General',
    icon:  ProduccionIcon,
    children: [
      { href: '/dashboard/fichas-tecnicas',                             label: 'Fichas Técnicas', icon: FichaIcon,    permission: 'fichas:view' },
      { href: '/dashboard/produccion-general/tecnicos/disponibilidad',  label: 'Disponibilidad técnica',  icon: TecnicosIcon, permission: 'tecnicos:submit' },
    ],
  },
  { href: '/dashboard/orgchart',                        label: 'Organigrama',   icon: OrgIcon,   permission: 'orgchart:view' },
  { href: '/dashboard/produccion-general/noticias',     label: 'Noticias',      icon: NoticiasIcon, permission: 'content:view' },
  { href: '/dashboard/produccion-general/estadisticas', label: 'Estadísticas',  icon: StatsIcon, permission: 'estadisticas:view' },
  { href: '/dashboard/produccion-general/finanzas',      label: 'Finanzas',      icon: SiembraIcon, permission: 'finanzas:view' },
  {
    href:  '/dashboard/ministerios',
    label: 'Ministerios',
    icon:  MinisteriosIcon,
    children: [
      { href: '/dashboard/ministerios/ar-kids',    label: 'AR Kids',    icon: MinisterioSubIcon, permission: 'ministerio_ar_kids:view' },
      { href: '/dashboard/ministerios/ar-tweens',  label: 'AR Tweens',  icon: MinisterioSubIcon, permission: 'ministerio_ar_tweens:view' },
      { href: '/dashboard/ministerios/ar-teens',   label: 'AR Teens',   icon: MinisterioSubIcon, permission: 'ministerio_ar_teens:view' },
      { href: '/dashboard/ministerios/ar-jovenes', label: 'AR Jóvenes', icon: MinisterioSubIcon, permission: 'ministerio_ar_jovenes:view' },
      { href: '/dashboard/ministerios/ar-worship', label: 'AR Worship', icon: MinisterioSubIcon, permission: 'ministerio_ar_worship:view' },
      { href: '/dashboard/ministerios/ar-hombres', label: 'AR Hombres', icon: MinisterioSubIcon, permission: 'ministerio_ar_hombres:view' },
      { href: '/dashboard/ministerios/ar-mujeres', label: 'AR Mujeres', icon: MinisterioSubIcon, permission: 'ministerio_ar_mujeres:view' },
      { href: '/dashboard/ministerios/ar-gold',    label: 'AR Gold',    icon: MinisterioSubIcon, permission: 'ministerio_ar_gold:view' },
    ],
  },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname() ?? '';
  const router   = useRouter();
  const { logout, refreshToken, user } = useAuthStore();
  const { isAdmin, can } = usePermissions();
  const { data: allRoles } = useSystemRoles();

  // Filtra el menú según los permisos del rol: un item sin `permission` siempre
  // se muestra; un grupo con `children` se oculta si ninguno de sus hijos quedó visible.
  const visibleNav = NAV
    .map((item) => {
      if (item.children) {
        const visibleChildren = item.children.filter((c) => !c.permission || isAdmin || can(c.permission));
        if (visibleChildren.length === 0) return null;
        return { ...item, children: visibleChildren };
      }
      if (item.permission && !isAdmin && !can(item.permission)) return null;
      return item;
    })
    .filter((item): item is NavGroup => item !== null);

  const canSeeConfiguracion = isAdmin
    || can('users:view') || can('roles:view') || can('cargos:view')
    || can('campus:view') || can('areas:view') || can('equipos:view');
  const impersonation = useAuthStore((s) => s.impersonation);
  const { start: startImpersonation, exit: exitImpersonation } = useImpersonation();

  const { notifications, unreadCount, markRead } = useNotifications();

  const [menuOpen,        setMenuOpen]        = useState(false);
  const [bellOpen,        setBellOpen]        = useState(false);
  const [collapsed,       setCollapsed]       = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const [expandedGroups,  setExpandedGroups]  = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Leer preferencia guardada
  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true);
  }, []);

  // Auto-expandir el grupo cuyo hijo esté activo al cambiar de ruta
  useEffect(() => {
    visibleNav.forEach(({ href, children }) => {
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
    // El botón solo despliega opciones; el enlace abre la página del grupo.
    e.preventDefault();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(href) ? next.delete(href) : next.add(href);
      return next;
    });
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
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
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
      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-white/15 bg-[#0d0d0d] px-3 text-white md:hidden">
        <button onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-controls="main-navigation" aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'} className="min-h-[44px] min-w-[44px] rounded-lg border border-white/20 text-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">{mobileOpen ? '×' : '☰'}</button>
        <span className="text-sm font-semibold">ARM Global</span>
        <span className="ml-auto truncate text-xs text-slate-300">{user?.campus?.name ?? 'Mi espacio'}</span>
      </div>
      {mobileOpen && <button aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)} className="fixed inset-0 top-14 z-30 bg-black/60 md:hidden" />}
      {/* Botón flotante para reabrir cuando está colapsado */}
      {collapsed && (
        <button
          onClick={toggleSidebar}
          title="Abrir menú"
          aria-label="Abrir menú de navegación"
          className="fixed left-0 top-1/2 -translate-y-1/2 z-50 hidden md:flex items-center justify-center w-11 h-12 rounded-r-md transition-all"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderLeft: 'none' }}
        >
          <svg className="w-3 h-3 text-slate-300 hover:text-white" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

    <aside
      id="main-navigation"
      onClickCapture={(event) => { if ((event.target as HTMLElement).closest('a')) setMobileOpen(false); }}
      style={{ background: '#0d0d0d', borderRight: '1px solid #1f1f1f' }}
      className={`app-sidebar fixed bottom-0 top-14 left-0 z-40 w-64 flex flex-col shrink-0 print:hidden overflow-hidden transition-all duration-300 ease-in-out md:static md:translate-x-0 ${mobileOpen ? 'translate-x-0 visible' : '-translate-x-full invisible'} ${collapsed ? 'md:w-0 md:invisible' : 'md:w-56 md:visible'}`}
    >
      {/* Logo + botón colapsar */}
      <div style={{ borderBottom: '1px solid #1f1f1f' }}
        className="px-4 pt-4 pb-2 flex items-center justify-between gap-2 min-w-[224px]">
        <div className="relative overflow-hidden group" style={{ width: 100, height: 28 }}>
          <Image src="/logo.png" alt="Logo" width={100} height={28}
            className="object-contain" priority />
          <div
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)' }}
          />
        </div>
        <button
          onClick={toggleSidebar}
          title="Ocultar menú"
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-md transition-all hover:bg-white/10 flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5 text-slate-300 hover:text-white" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav aria-label="Navegación principal" className="min-h-0 overflow-y-auto flex-1 p-3 pt-4 space-y-0.5 min-w-[224px]">
        {visibleNav.map(({ href, label, icon: Icon, children }) => {
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
              <div className="flex items-center gap-1">
              <Link
                href={href}
                aria-current={active && !children ? 'page' : undefined}
                style={active ? { background: 'rgba(255,255,255,0.08)' } : {}}
                className={`flex flex-1 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon active={active} />
                <span className="flex-1">{label}</span>
              </Link>
                {/* Expandir no cambia de página */}
                {children && (
                  <button onClick={(e) => toggleGroup(href, e)} aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Contraer' : 'Expandir'} ${label}`} className="flex min-h-[44px] w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10">
                  <svg
                    className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    } ${active ? 'text-white/50' : 'text-white/20'}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  </button>
                )}
              </div>

              {/* Sub-ítems colapsables */}
              {children && isExpanded && (
                <div className="mt-0.5 space-y-0.5">
                  {children.map(({ href: chref, label: clabel, icon: CIcon }) => {
                    const cActive = pathname.startsWith(chref);
                    return (
                      <Link
                        key={chref}
                        href={chref}
                        aria-current={cActive ? 'page' : undefined}
                        style={cActive ? { background: 'rgba(255,255,255,0.06)' } : {}}
                        className={`flex items-center gap-2.5 pl-8 pr-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          cActive ? 'text-white/90' : 'text-slate-300 hover:text-white hover:bg-white/5'
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

        {/* Administración de Campus — debajo de Ministerios, independiente */}
        {(isAdmin || can('campus:edit')) && (() => {
          const href   = '/dashboard/administracion-campus';
          const active = pathname.startsWith(href);
          return (
            <Link
              href={href}
              style={active ? { background: 'rgba(255,255,255,0.08)' } : {}}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <AdminCampusIcon active={active} />
              Administración de campus
            </Link>
          );
        })()}
      </nav>

      {/* Configuración + Soporte (admin-only) */}
      <div className="px-3 pb-1 min-w-[224px] space-y-0.5">
        {canSeeConfiguracion && (() => {
          const href   = '/dashboard/directorio';
          const active = pathname.startsWith(href);
          return (
            <Link
              href={href}
              style={active ? { background: 'rgba(255,255,255,0.08)' } : {}}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <ConfigIcon active={active} />
              Configuración
            </Link>
          );
        })()}
        {isAdmin && (() => {
          const href   = '/dashboard/soporte';
          const active = pathname.startsWith(href);
          return (
            <Link
              href={href}
              style={active ? { background: 'rgba(255,255,255,0.08)' } : {}}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <SoporteIcon active={active} />
              Soporte
            </Link>
          );
        })()}
      </div>

      {/* Notificaciones */}
      <div ref={bellRef} style={{ borderTop: '1px solid #1f1f1f' }}
        className="relative px-3 py-2 min-w-[224px]">
        {bellOpen && (
          <div
            className="absolute bottom-full left-3 right-3 mb-1 rounded-lg overflow-hidden shadow-lg"
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', maxHeight: 320 }}
          >
            <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              Notificaciones
            </p>
            {notifications.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-white/30">Sin notificaciones</p>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                {notifications.slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      setBellOpen(false);
                      if (n.link) router.push(n.link);
                    }}
                    className="w-full text-left px-3 py-2.5 flex gap-2.5 items-start transition-all hover:bg-white/5"
                    style={{ borderTop: '1px solid #242424' }}
                  >
                    <span
                      className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full"
                      style={{ background: n.read ? 'transparent' : '#3b82f6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] leading-snug ${n.read ? 'text-white/40' : 'text-white/80 font-medium'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[11px] text-white/25 mt-0.5 truncate">{n.body}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => { setBellOpen((o) => !o); setMenuOpen(false); }}
          className="flex items-center gap-2.5 w-full rounded-lg px-2 py-1.5 hover:bg-white/5 transition-all text-left"
        >
          <div className="relative flex-shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.35)" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold leading-none"
                style={{ background: '#ef4444', fontSize: 8, minWidth: 13, height: 13, padding: '0 2px' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[12px] text-white/35">
            {unreadCount > 0 ? `${unreadCount} nueva${unreadCount > 1 ? 's' : ''}` : 'Notificaciones'}
          </span>
        </button>
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
            {/* Simular rol (admin-only, o salir si ya está simulando) */}
            {(isAdmin || impersonation) && (
              <div style={{ borderTop: '1px solid #2a2a2a' }}>
                {impersonation ? (
                  <button
                    onClick={() => { setMenuOpen(false); exitImpersonation(); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[12px] transition-all"
                    style={{ color: '#f59e0b' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(245,158,11,0.1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Salir de simulación
                  </button>
                ) : (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: 'rgba(255,255,255,0.2)' }}>
                      Simular rol
                    </p>
                    {(allRoles ?? [])
                      .filter((r: any) => r.name !== 'admin' && r.isActive)
                      .map((role: any) => (
                        <button
                          key={role.id}
                          onClick={() => { setMenuOpen(false); startImpersonation(role.id); }}
                          className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] text-slate-300 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          {role.name}
                        </button>
                      ))}
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[12px] text-white/40 hover:text-white/60 hover:bg-white/5 transition-all"
              style={{ borderTop: '1px solid #2a2a2a' }}
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
            {impersonation ? (
              <p className="text-[10px] mt-0.5 truncate font-semibold" style={{ color: '#f59e0b' }}>
                ⟳ {impersonation.roleName}
              </p>
            ) : (
              role && <p className="text-white/30 text-[10px] mt-0.5 truncate">{role}</p>
            )}
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
