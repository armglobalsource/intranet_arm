import Link from 'next/link';
import { CalendarioAnual } from '../CalendarioAnual';

export default function CalendarioPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-400 hover:text-slate-700 transition-colors group"
      >
        <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Inicio
      </Link>
      <CalendarioAnual />
    </div>
  );
}
