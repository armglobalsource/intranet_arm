import Link from 'next/link';
import { CalendarioAnual } from '../CalendarioAnual';

export default function CalendarioPage() {
  return (
    <div className="min-h-screen -m-6 px-6 py-6" style={{ background: '#0a0a0a' }}>
      <div className="max-w-6xl mx-auto space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-white/35 hover:text-white/70 transition-colors group"
        >
          <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Inicio
        </Link>
        <CalendarioAnual />
      </div>
    </div>
  );
}
