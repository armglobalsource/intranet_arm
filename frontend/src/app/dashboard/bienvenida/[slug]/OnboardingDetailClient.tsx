'use client';

import Link from 'next/link';
import { useOnboardingBySlug } from '@/hooks/useOnboarding';

// ── Video embed helper ───────────────────────────────────────────────────────

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v') ?? u.pathname.split('/').pop();
      return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1` : null;
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}?byline=0&portrait=0` : null;
    }
  } catch {
    return null;
  }
  return null;
}

// ── Step ────────────────────────────────────────────────────────────────────

function Step({ step, index }: { step: { title: string; description: string }; index: number }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
        {index + 1}
      </div>
      <div className="flex-1 pb-6 border-b border-gray-100 last:border-b-0">
        <h3 className="text-sm font-bold text-gray-900 mb-1">{step.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{step.description}</p>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function OnboardingDetailClient({ slug }: { slug: string }) {
  const { data: team, isLoading, isError } = useOnboardingBySlug(slug);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="space-y-4">
          {[1,2,3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (isError || !team) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-4xl mb-4">😕</p>
        <h2 className="text-lg font-bold text-gray-800">Onboarding no encontrado</h2>
        <p className="text-sm text-gray-500 mt-2">Este equipo no tiene onboarding configurado aún.</p>
        <Link href="/dashboard/bienvenida"
          className="inline-block mt-6 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all">
          ← Volver
        </Link>
      </div>
    );
  }

  const embedUrl   = team.videoUrl ? getEmbedUrl(team.videoUrl) : null;
  const sortedSteps = [...(team.steps ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <Link href="/dashboard/bienvenida"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Bienvenida
      </Link>

      {/* Header */}
      <div className="space-y-2">
        {team.emoji && <div className="text-5xl">{team.emoji}</div>}
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Bienvenido a</p>
        <h1 className="text-3xl font-bold text-gray-900">{team.teamName}</h1>
        {team.welcomeTitle && (
          <p className="text-lg text-gray-600 leading-relaxed">{team.welcomeTitle}</p>
        )}
        {team.welcomeText && (
          <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-wrap">{team.welcomeText}</p>
        )}
      </div>

      {/* Video */}
      {embedUrl && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Video de bienvenida</h2>
          <div className="relative w-full rounded-2xl overflow-hidden shadow-md" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`Video de bienvenida — ${team.teamName}`}
            />
          </div>
        </div>
      )}

      {/* Pasos */}
      {sortedSteps.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Proceso de incorporación</h2>
          <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 space-y-0">
            {sortedSteps.map((step, i) => (
              <Step key={i} step={step} index={i} />
            ))}
          </div>
        </div>
      )}

      {sortedSteps.length === 0 && !embedUrl && !team.welcomeText && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 px-6 py-10 text-center">
          <p className="text-sm text-gray-400">El contenido de este onboarding está en construcción.</p>
        </div>
      )}
    </div>
  );
}
