'use client';
// Navegación entre las páginas de un evento: editar, inscritos, ventas, códigos, mensajes, encuesta y puerta.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ClipboardList, Mail, PenLine, ScanLine, Smile, Tag } from 'lucide-react';
import i from './event-insights.module.css';

const TABS = [
  { path: '', label: 'Editar', icon: PenLine },
  { path: '/inscritos', label: 'Inscritos', icon: ClipboardList },
  { path: '/ventas', label: 'Ventas', icon: BarChart3 },
  { path: '/codigos', label: 'Códigos', icon: Tag },
  { path: '/mensajes', label: 'Mensajes', icon: Mail },
  { path: '/encuesta', label: 'Encuesta', icon: Smile },
  { path: '/acceso', label: 'Puerta', icon: ScanLine },
];

export function EventSubnav({ id, manage = true }: { id: string; manage?: boolean }) {
  const pathname = usePathname() ?? '';
  const base = `/dashboard/eventos/${id}`;
  const tabs = manage ? TABS : TABS.filter((t) => t.path === '/inscritos' || t.path === '/acceso');
  return (
    <nav className={i.subnav} aria-label="Secciones del evento">
      {tabs.map(({ path, label, icon: Icon }) => {
        const href = base + path;
        const active = path ? pathname.startsWith(href) : pathname === base;
        return <Link key={label} href={href} aria-current={active ? 'page' : undefined}><Icon size={15} aria-hidden="true" />{label}</Link>;
      })}
    </nav>
  );
}
