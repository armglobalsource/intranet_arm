'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useOnboardingList, useCreateOnboarding, useUpdateOnboarding,
  useDeleteOnboarding, OnboardingTeam, CreateOnboardingPayload, OnboardingStep,
} from '@/hooks/useOnboarding';

// ── Form modal ──────────────────────────────────────────────────────────────

function OnboardingForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial?: Partial<OnboardingTeam>;
  onSave:   (data: CreateOnboardingPayload) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [teamName,     setTeamName]     = useState(initial?.teamName     ?? '');
  const [slug,         setSlug]         = useState(initial?.slug         ?? '');
  const [emoji,        setEmoji]        = useState(initial?.emoji        ?? '');
  const [welcomeTitle, setWelcomeTitle] = useState(initial?.welcomeTitle ?? '');
  const [welcomeText,  setWelcomeText]  = useState(initial?.welcomeText  ?? '');
  const [videoUrl,     setVideoUrl]     = useState(initial?.videoUrl     ?? '');
  const [roleNames,    setRoleNames]    = useState((initial?.roleNames ?? []).join(', '));
  const [steps,        setSteps]        = useState<OnboardingStep[]>(
    initial?.steps ? [...initial.steps].sort((a, b) => a.order - b.order) : [],
  );

  function slugify(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function handleNameChange(v: string) {
    setTeamName(v);
    if (!initial?.slug) setSlug(slugify(v));
  }

  function addStep() {
    setSteps((prev) => [...prev, { title: '', description: '', order: prev.length + 1 }]);
  }

  function updateStep(i: number, field: keyof OnboardingStep, value: string | number) {
    setSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));
  }

  function handleSubmit() {
    if (!teamName.trim() || !slug.trim()) return;
    const roles = roleNames.split(',').map((r) => r.trim()).filter(Boolean);
    onSave({
      teamName: teamName.trim(),
      slug:     slug.trim(),
      emoji:    emoji.trim()        || undefined,
      welcomeTitle: welcomeTitle.trim() || undefined,
      welcomeText:  welcomeText.trim()  || undefined,
      videoUrl:     videoUrl.trim()     || undefined,
      roleNames: roles,
      steps:     steps.filter((s) => s.title.trim()),
    });
  }

  const inputCls = "w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 focus:bg-white transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col bg-white"
        style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-bold text-gray-900">
            {initial?.id ? 'Editar onboarding' : 'Nuevo onboarding'}
          </h2>
          <button onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nombre del equipo *</label>
              <input className={inputCls} value={teamName} onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ej: AR Worship" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Slug (URL) *</label>
              <input className={inputCls} value={slug} onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="ar-worship" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Emoji</label>
              <input className={inputCls} value={emoji} onChange={(e) => setEmoji(e.target.value)}
                placeholder="🎸" maxLength={4} />
            </div>
            <div className="col-span-3">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Roles que ven este onboarding
                <span className="font-normal text-gray-400 ml-1">(separados por coma)</span>
              </label>
              <input className={inputCls} value={roleNames} onChange={(e) => setRoleNames(e.target.value)}
                placeholder="worship, Productor general, Tecnico" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Título de bienvenida</label>
            <input className={inputCls} value={welcomeTitle} onChange={(e) => setWelcomeTitle(e.target.value)}
              placeholder="Ej: Somos el equipo que crea el ambiente de encuentro con Dios." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Texto de bienvenida</label>
            <textarea rows={3} className={inputCls + ' resize-none'} value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              placeholder="Descripción más larga del equipo y su misión..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">URL del video (YouTube o Vimeo)</label>
            <input className={inputCls} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..." />
          </div>

          {/* Pasos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500">Pasos del proceso</label>
              <button onClick={addStep}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Agregar paso
              </button>
            </div>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <input
                      className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-gray-400 transition-all"
                      value={step.title}
                      onChange={(e) => updateStep(i, 'title', e.target.value)}
                      placeholder="Título del paso"
                    />
                    <button onClick={() => removeStep(i)}
                      className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-gray-400 transition-all resize-none"
                    value={step.description}
                    onChange={(e) => updateStep(i, 'description', e.target.value)}
                    placeholder="Descripción del paso..."
                  />
                </div>
              ))}
              {steps.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">Sin pasos aún — agrega el proceso de incorporación.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!teamName.trim() || !slug.trim() || isSaving}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: '#111827' }}>
            {isSaving ? 'Guardando...' : initial?.id ? 'Guardar cambios' : 'Crear onboarding'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

export function OnboardingAdminClient() {
  const router                            = useRouter();
  const { isAdmin }                       = usePermissions();
  const { data: teams = [], isLoading }   = useOnboardingList();
  const { mutate: create, isPending: isCreating } = useCreateOnboarding();
  const { mutate: update, isPending: isUpdating } = useUpdateOnboarding();
  const { mutate: remove }                        = useDeleteOnboarding();

  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<OnboardingTeam | null>(null);
  const [confirmDel,  setConfirmDel]  = useState<number | null>(null);

  useEffect(() => {
    if (!isAdmin) router.replace('/dashboard/perfil');
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  function handleSave(data: CreateOnboardingPayload) {
    if (editing) {
      update({ id: editing.id, data }, { onSuccess: () => { setEditing(null); } });
    } else {
      create(data, { onSuccess: () => setShowForm(false) });
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/dashboard/perfil"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Mi Perfil
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Gestionar Onboardings</h1>
          <p className="text-sm text-gray-500 mt-1">Crea y edita el proceso de bienvenida de cada equipo.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#111827' }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo onboarding
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">Cargando...</div>
        ) : teams.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">Sin onboardings. Crea el primero.</div>
        ) : (
          teams.map((team) => (
            <div key={team.id}
              className="flex items-center gap-4 px-5 py-4 border-b border-gray-100 last:border-b-0">
              <div className="text-2xl flex-shrink-0">{team.emoji ?? '📋'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900">{team.teamName}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    team.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {team.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  /{team.slug} · {team.steps?.length ?? 0} paso{(team.steps?.length ?? 0) !== 1 ? 's' : ''} ·
                  Roles: {team.roleNames?.join(', ') || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link href={`/dashboard/bienvenida/${team.slug}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-all">
                  Ver
                </Link>
                <button onClick={() => { setEditing(team); setShowForm(false); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-all">
                  Editar
                </button>
                {confirmDel === team.id ? (
                  <>
                    <button onClick={() => remove(team.id, { onSuccess: () => setConfirmDel(null) })}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-all">
                      Confirmar
                    </button>
                    <button onClick={() => setConfirmDel(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:bg-gray-100 transition-all">
                      No
                    </button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDel(team.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-all">
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form modal */}
      {(showForm || editing) && (
        <OnboardingForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          isSaving={isCreating || isUpdating}
        />
      )}
    </div>
  );
}
