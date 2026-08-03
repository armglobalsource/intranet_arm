'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRoles, useCreateUser } from '@/hooks/useUsers';
import type { CreateUserDto } from '@/hooks/useUsers';
import { useAllJobTitles, useCreateJobTitle } from '@/hooks/useJobTitles';
import type { JobTitle } from '@/hooks/useJobTitles';
import type { MinisterialTitle } from '@/types/user';
import { MINISTERIAL_LABEL, MINISTERIAL_PREFIX } from '@/types/user';
import { useCreateOrgMembership } from '@/hooks/useOrgChart';
import CountryPicker from '@/components/CountryPicker';
import { MultiJobTitleSelect, CampusSelect, TeamSelect, ROLE_LABELS } from '../_shared';

// ── Subcomponentes ────────────────────────────────────────────────────────────

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col">
      <div className="px-5 py-3.5 flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 rounded-t-xl">
        <span className="text-slate-400">{icon}</span>
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{title}</h2>
      </div>
      <div className="px-5 py-4 flex flex-col gap-3.5 flex-1">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 mb-1">
        {label} {required && <span className="text-red-400">*</span>}
        {hint && <span className="text-slate-300 font-normal"> — {hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition';

// ── Página ────────────────────────────────────────────────────────────────────

export default function NuevaPersonaPage() {
  const router = useRouter();
  const { data: roles = [] }        = useRoles();
  const { data: allJobTitles = [] } = useAllJobTitles();
  const createUser       = useCreateUser();
  const createJobTitle   = useCreateJobTitle();
  const createMembership = useCreateOrgMembership();

  async function handleCreateJobTitle(name: string): Promise<JobTitle> {
    return createJobTitle.mutateAsync({ name });
  }

  // Información personal
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [country,   setCountry]   = useState('');
  const [bio,       setBio]       = useState('');

  // Información organizacional
  const [jobTitleIds,      setJobTitleIds]      = useState<number[]>([]);
  const [ministerialTitle, setMinisterialTitle]  = useState<MinisterialTitle | null>(null);
  const [campusId,         setCampusId]          = useState<number | null>(null);
  const [teamId,            setTeamId]           = useState<number | null>(null);

  // Información de la cuenta
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [roleId,   setRoleId]   = useState(0);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg,  setErrorMsg]  = useState('');

  // Auto-selecciona el rol "usuario" cuando cargan los roles
  useEffect(() => {
    if (roles.length > 0 && roleId === 0) {
      const userRole = roles.find((r) => ['user', 'usuario'].includes(r.name.toLowerCase()));
      if (userRole) setRoleId(userRole.id);
    }
  }, [roles, roleId]);

  const canSubmit = firstName.trim() && lastName.trim() && email.trim() && roleId > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    setSaveState('saving');
    setErrorMsg('');
    const payload: CreateUserDto = {
      email: email.trim(), password: password || undefined,
      firstName: firstName.trim(), lastName: lastName.trim(),
      roleId,
      campusId:         campusId ?? undefined,
      jobTitleIds:      jobTitleIds.length ? jobTitleIds : undefined,
      phone:            phone.trim()   || undefined,
      country:          country.trim() || undefined,
      bio:              bio.trim()     || undefined,
      ministerialTitle: ministerialTitle ?? undefined,
    };
    createUser.mutate(payload, {
      onSuccess: (newUser) => {
        if (teamId) {
          createMembership.mutate(
            { userId: newUser.id, teamId, role: 'member' },
            { onSettled: () => { setSaveState('saved'); setTimeout(() => router.push('/dashboard/directorio/personas'), 900); } },
          );
        } else {
          setSaveState('saved');
          setTimeout(() => router.push('/dashboard/directorio/personas'), 900);
        }
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? 'Error al crear el usuario';
        setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
        setSaveState('error');
        setTimeout(() => setSaveState('idle'), 2500);
      },
    });
  }

  return (
    <div className="max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/directorio/personas"
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-700 transition-colors mb-3">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Personas
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center text-xl flex-shrink-0">🧑‍💼</div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Nueva persona</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">Crea un nuevo usuario en el sistema</p>
          </div>
        </div>
      </div>

      {/* 3 paneles, igual que en Mi Perfil */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel title="Información personal" icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        }>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre" required>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" className={inputCls} />
            </Field>
            <Field label="Apellido" required>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" className={inputCls} />
            </Field>
          </div>
          <Field label="Teléfono">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+57 300 000 0000" className={inputCls} />
          </Field>
          <Field label="País">
            <CountryPicker value={country} onChange={setCountry} placeholder="Chile, Colombia…" />
          </Field>
          <Field label="Biografía">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className={`${inputCls} resize-none`} />
          </Field>
        </Panel>

        <Panel title="Información organizacional" icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        }>
          <Field label="Cargos" hint="puede agregar varios">
            <MultiJobTitleSelect
              selectedIds={jobTitleIds}
              onChange={setJobTitleIds}
              allJobTitles={allJobTitles}
              onCreateNew={handleCreateJobTitle}
            />
          </Field>
          <Field label="Nombramiento ministerial" hint="opcional">
            <select value={ministerialTitle ?? ''} onChange={(e) => setMinisterialTitle((e.target.value as MinisterialTitle) || null)}
              className={`${inputCls} bg-white`}>
              <option value="">Sin nombramiento</option>
              {(Object.entries(MINISTERIAL_LABEL) as [MinisterialTitle, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label} ({MINISTERIAL_PREFIX[val]})</option>
              ))}
            </select>
          </Field>
          <Field label="Campus" hint="opcional">
            <CampusSelect value={campusId} onChange={setCampusId} />
          </Field>
          <Field label="Equipo" hint="opcional">
            <TeamSelect value={teamId} onChange={setTeamId} />
          </Field>
        </Panel>

        <Panel title="Información de la cuenta" icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
        }>
          <Field label="Email" required>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@iglesia.com" className={inputCls} />
          </Field>
          <Field label="Contraseña" hint="opcional — mín. 6 caracteres">
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" className={`${inputCls} pr-10`} />
              <button type="button" onClick={() => setShowPass((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass
                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                }
              </button>
            </div>
          </Field>
          <Field label="Rol del sistema" required>
            <select value={roleId || ''} onChange={(e) => setRoleId(Number(e.target.value))} className={`${inputCls} bg-white`}>
              <option value="">Seleccionar rol...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] ?? r.name}</option>
              ))}
            </select>
          </Field>
        </Panel>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 mt-5">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-[12.5px] text-red-700">{errorMsg}</span>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-2 mt-6">
        <button onClick={handleSubmit} disabled={!canSubmit || saveState === 'saving' || saveState === 'saved'}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
          style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : '#7C3AED' }}>
          {saveState === 'idle'   && 'Crear persona'}
          {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Creando...</>}
          {saveState === 'saved'  && '✓ ¡Creado!'}
          {saveState === 'error'  && '✕ Error'}
        </button>
        <Link href="/dashboard/directorio/personas"
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50 transition-colors">
          Cancelar
        </Link>
      </div>
    </div>
  );
}
