'use client';

import Link from 'next/link';
import { MINISTERIOS } from './ministerios.config';
import type { MinistrioConfig } from './ministerios.config';

// ── MinistrioCard ─────────────────────────────────────────────────────────────

function MinistrioCard({ m }: { m: MinistrioConfig }) {
  return (
    <Link
      href={`/dashboard/ministerios/${m.slug}`}
      className="card overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all group"
      style={{ borderTop: `3px solid ${m.color}` }}
    >
      <div className="p-5 flex items-start gap-4 flex-1">
        {/* Emoji / ícono */}
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl"
          style={{ background: `${m.color}12` }}
        >
          {m.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 leading-tight group-hover:text-gray-700 transition-colors">
            {m.name}
          </h3>
          <span
            className="inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: `${m.color}15`, color: m.color }}
          >
            {m.segmento}
          </span>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">
            {m.desc}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-5 py-2.5 flex items-center justify-between"
        style={{ borderTop: `1px solid ${m.color}18`, background: `${m.color}06` }}
      >
        <span className="text-[11px] font-semibold" style={{ color: m.color }}>
          Ver ministerio
        </span>
        <svg
          className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
          style={{ color: m.color }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}

// ── MinisteriosClient ─────────────────────────────────────────────────────────

export function MinisteriosClient() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ministerios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conoce los ministerios que forman parte de ARM Global.
        </p>
      </div>

      {/* Grid de ministerios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {MINISTERIOS.map((m) => (
          <MinistrioCard key={m.slug} m={m} />
        ))}
      </div>
    </div>
  );
}
