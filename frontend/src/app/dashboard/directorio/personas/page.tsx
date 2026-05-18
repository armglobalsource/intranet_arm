'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  useUsers,
  useUpdateUser,
  useCreateUser,
  useDeleteUser,
  useToggleUserStatus,
  useRoles,
} from '@/hooks/useUsers';
import { useAllJobTitles, useCreateJobTitle } from '@/hooks/useJobTitles';
import type { JobTitle }                      from '@/hooks/useJobTitles';
import { useActiveCampuses }                  from '@/hooks/useCampus';
import type { User, UpdateUserDto } from '@/types/user';
import type { CreateUserDto }                 from '@/hooks/useUsers';
import { userJobTitleNames } from '@/types/user';
import { useOrgAllTeams, useCreateOrgMembership, useDeleteOrgMembership, useOrgUserProfile } from '@/hooks/useOrgChart';

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#E6F1FB', text: '#185FA5' },
  { bg: '#FAEEDA', text: '#854F0B' },
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#FAECE7', text: '#993C1D' },
  { bg: '#FBEAF0', text: '#993556' },
];
const ROLE_LABELS: Record<string, string>     = { admin: 'Administrador', user: 'Usuario' };
const ORG_ROLE_LABELS: Record<string, string> = { area_leader: 'Líder de área', team_leader: 'Líder de equipo', member: 'Miembro' };

const PAGE_SIZE = 20;

function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function userInitials(u: User) { return (u.firstName[0] + (u.lastName?.[0] ?? '')).toUpperCase(); }

// ── MultiJobTitleSelect ───────────────────────────────────────────────────────

interface MultiJobTitleSelectProps {
  selectedIds:   number[];
  onChange:      (ids: number[]) => void;
  allJobTitles:  JobTitle[];
  onCreateNew:   (name: string) => Promise<JobTitle>;
}

function MultiJobTitleSelect({ selectedIds, onChange, allJobTitles, onCreateNew }: MultiJobTitleSelectProps) {
  const [open,    setOpen]    = useState(false);
  const [input,   setInput]   = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = allJobTitles.filter(
    (jt) => jt.isActive && jt.name.toLowerCase().includes(input.toLowerCase()),
  );
  const exactMatch = allJobTitles.some((jt) => jt.name.toLowerCase() === input.trim().toLowerCase());
  const showCreate = input.trim().length > 1 && !exactMatch;

  function toggle(id: number) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  async function handleCreate() {
    if (!input.trim() || creating) return;
    setCreating(true);
    try {
      const jt = await onCreateNew(input.trim());
      onChange([...selectedIds, jt.id]);
      setInput('');
    } finally {
      setCreating(false);
    }
  }

  const selectedTitles = allJobTitles.filter((jt) => selectedIds.includes(jt.id));

  return (
    <div ref={ref} className="relative">
      {selectedTitles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedTitles.map((jt) => (
            <span key={jt.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] font-medium px-2 py-1 rounded-full border border-blue-200">
              {jt.name}
              <button type="button" onClick={() => toggle(jt.id)} className="w-3 h-3 flex items-center justify-center text-blue-400 hover:text-red-500 transition-colors">×</button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text" value={input} autoComplete="off"
        onChange={(e) => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); if (showCreate) handleCreate(); }
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={selectedTitles.length > 0 ? 'Agregar otro cargo...' : 'Buscar o crear cargo...'}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
      />

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((jt) => (
            <button key={jt.id} type="button"
              onMouseDown={(e) => { e.preventDefault(); toggle(jt.id); }}
              className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center gap-2 hover:bg-blue-50 transition-colors ${selectedIds.includes(jt.id) ? 'text-blue-700 font-medium' : 'text-slate-700'}`}
            >
              <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-[10px] ${selectedIds.includes(jt.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                {selectedIds.includes(jt.id) && '✓'}
              </span>
              {jt.name}
            </button>
          ))}
          {showCreate && (
            <button type="button"
              onMouseDown={(e) => { e.preventDefault(); handleCreate(); }}
              disabled={creating}
              className="w-full text-left px-3 py-2 text-[12.5px] font-medium text-violet-600 hover:bg-violet-50 flex items-center gap-2 border-t border-slate-100 disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {creating ? 'Creando...' : `Crear "${input.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── CampusSelect ──────────────────────────────────────────────────────────────

interface CampusSelectProps {
  value:    number | null;
  onChange: (id: number | null) => void;
}

function CampusSelect({ value, onChange }: CampusSelectProps) {
  const { data: campuses = [] } = useActiveCampuses();
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white"
    >
      <option value="">Sin campus asignado</option>
      {campuses.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  );
}

// ── TeamSelect ────────────────────────────────────────────────────────────────

interface TeamSelectProps {
  value:       number | null;
  onChange:    (id: number | null) => void;
  excludeIds?: Set<number>;
  placeholder?: string;
}

function TeamSelect({ value, onChange, excludeIds, placeholder = 'Sin equipo asignado' }: TeamSelectProps) {
  const { data: teams = [] } = useOrgAllTeams();
  const activeTeams = teams.filter((t) => t.isActive && (!excludeIds || !excludeIds.has(t.id)));
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition bg-white"
    >
      <option value="">{placeholder}</option>
      {activeTeams.map((t) => (
        <option key={t.id} value={t.id}>{t.icon ? `${t.icon} ` : ''}{t.name}</option>
      ))}
    </select>
  );
}

// ── EditPersonaModal ──────────────────────────────────────────────────────────

interface EditPersonaModalProps {
  user:             User;
  allJobTitles:     JobTitle[];
  onCreateJobTitle: (name: string) => Promise<JobTitle>;
  onClose:          () => void;
}

function EditPersonaModal({ user, allJobTitles, onCreateJobTitle, onClose }: EditPersonaModalProps) {
  const { data: roles = [] }   = useRoles();
  const { data: orgProfile }   = useOrgUserProfile(user.id);
  const createMembership       = useCreateOrgMembership();
  const deleteMembership       = useDeleteOrgMembership();
  const updateUser             = useUpdateUser();

  const currentJobTitleIds = user.jobTitles.map((jt) => jt.jobTitle.id);

  const [firstName,   setFirstName]   = useState(user.firstName);
  const [lastName,    setLastName]    = useState(user.lastName);
  const [email,       setEmail]       = useState(user.email);
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [roleId,      setRoleId]      = useState(user.role?.id ?? 0);
  const [phone,       setPhone]       = useState(user.phone ?? '');
  const [country,     setCountry]     = useState(user.country ?? '');
  const [bio,         setBio]         = useState(user.bio ?? '');
  const [campusId,    setCampusId]    = useState<number | null>(user.campusId ?? null);
  const [jobTitleIds, setJobTitleIds] = useState<number[]>(currentJobTitleIds);
  const [saveState,   setSaveState]   = useState<'idle' | 'saving' | 'saved'>('idle');
  const [errorMsg,    setErrorMsg]    = useState('');

  const [addTeamId,  setAddTeamId]  = useState<number | null>(null);
  const [addingTeam, setAddingTeam] = useState(false);

  const memberships     = orgProfile?.orgMemberships ?? [];
  const existingTeamIds = new Set(memberships.map((m) => m.teamId).filter(Boolean) as number[]);

  function handleSubmit() {
    setSaveState('saving');
    setErrorMsg('');
    const payload: UpdateUserDto = {
      firstName:   firstName.trim()        || undefined,
      lastName:    lastName.trim()         || undefined,
      email:       email.trim()            || undefined,
      password:    password.length >= 6 ? password : undefined,
      roleId:      roleId > 0 ? roleId     : undefined,
      phone:       phone.trim()            || undefined,
      country:     country.trim()          || undefined,
      bio:         bio.trim()              || undefined,
      campusId,
      jobTitleIds,
    };
    updateUser.mutate({ id: user.id, data: payload }, {
      onSuccess: () => { setSaveState('saved'); setTimeout(onClose, 800); },
      onError: (err: any) => {
        const msg = err?.response?.data?.message ?? 'Error al guardar';
        setErrorMsg(Array.isArray(msg) ? msg.join(', ') : msg);
        setSaveState('idle');
      },
    });
  }

  function handleAddTeam() {
    if (!addTeamId || addingTeam) return;
    setAddingTeam(true);
    createMembership.mutate(
      { userId: user.id, teamId: addTeamId, role: 'member' },
      { onSettled: () => { setAddingTeam(false); setAddTeamId(null); } },
    );
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const { bg, text } = avatarColor(user.id);

  const inputCls   = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition';
  const labelCls   = 'block text-[11px] font-medium text-slate-500 mb-1';
  const sectionCls = 'text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] overflow-hidden" onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            : <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-[13px]" style={{ background: bg, color: text }}>{userInitials(user)}</div>
          }
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-[14px] truncate">{user.firstName} {user.lastName}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Editar información completa</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-3.5 max-h-[80vh] overflow-y-auto">

          <p className={sectionCls}>Cuenta</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Apellido</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>
              Contraseña <span className="text-slate-300 font-normal">— dejar en blanco para no cambiar (mín. 6 caracteres)</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${inputCls} pr-10`}
              />
              <button type="button" onClick={() => setShowPass((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass
                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                }
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Rol del sistema</label>
            <select value={roleId || ''} onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white">
              <option value="">Seleccionar rol...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] ?? r.name}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-100" />

          <p className={sectionCls}>Perfil</p>

          <div>
            <label className={labelCls}>Cargos <span className="text-slate-300 font-normal">— puede tener varios</span></label>
            <MultiJobTitleSelect
              selectedIds={jobTitleIds}
              onChange={setJobTitleIds}
              allJobTitles={allJobTitles}
              onCreateNew={onCreateJobTitle}
            />
          </div>

          <div>
            <label className={labelCls}>Campus <span className="text-slate-300 font-normal">— opcional</span></label>
            <CampusSelect value={campusId} onChange={setCampusId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+57 300 000 0000" />
            </div>
            <div>
              <label className={labelCls}>País</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="Colombia, Chile..." />
            </div>
          </div>

          <div>
            <label className={labelCls}>Biografía</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none" />
          </div>

          <div className="border-t border-slate-100" />

          <p className={sectionCls}>Organigrama — equipos</p>

          {memberships.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {memberships.map((m) => {
                const name  = m.team?.name ?? m.area?.name ?? '—';
                const label = ORG_ROLE_LABELS[m.role] ?? m.role;
                return (
                  <span key={m.id}
                    className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-800 border border-violet-200 text-[11px] font-medium px-2.5 py-1 rounded-full">
                    {name}
                    <span className="text-violet-400">·</span>
                    <span className="text-violet-500 font-normal">{label}</span>
                    <button
                      type="button"
                      onClick={() => deleteMembership.mutate(m.id)}
                      className="w-3.5 h-3.5 flex items-center justify-center text-violet-400 hover:text-red-500 transition-colors ml-0.5"
                      title="Quitar del equipo"
                    >×</button>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400 italic">Sin equipos asignados</p>
          )}

          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <TeamSelect
                value={addTeamId}
                onChange={setAddTeamId}
                excludeIds={existingTeamIds}
                placeholder="Agregar a un equipo..."
              />
            </div>
            <button
              type="button"
              onClick={handleAddTeam}
              disabled={!addTeamId || addingTeam}
              className="flex-shrink-0 px-3 py-2 rounded-lg bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingTeam ? '...' : 'Agregar'}
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-[12px] text-red-700">{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSubmit} disabled={saveState !== 'idle'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-70"
              style={{ background: saveState === 'saved' ? '#1D9E75' : '#334155' }}>
              {saveState === 'idle'   && 'Guardar cambios'}
              {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Guardando...</>}
              {saveState === 'saved'  && '✓ Guardado'}
            </button>
            <button onClick={onClose} disabled={saveState === 'saving'}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── CreatePersonaModal ────────────────────────────────────────────────────────

interface CreatePersonaModalProps {
  allJobTitles:     JobTitle[];
  onCreateJobTitle: (name: string) => Promise<JobTitle>;
  onClose:          () => void;
}

function CreatePersonaModal({ allJobTitles, onCreateJobTitle, onClose }: CreatePersonaModalProps) {
  const { data: roles = [] } = useRoles();
  const createUser           = useCreateUser();
  const createMembership     = useCreateOrgMembership();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [roleId,      setRoleId]      = useState(0);
  const [campusId,    setCampusId]    = useState<number | null>(null);
  const [teamId,      setTeamId]      = useState<number | null>(null);
  const [jobTitleIds, setJobTitleIds] = useState<number[]>([]);
  const [phone,       setPhone]       = useState('');
  const [country,     setCountry]     = useState('');
  const [bio,         setBio]         = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [saveState,   setSaveState]   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg,    setErrorMsg]    = useState('');

  const canSubmit = email.trim() && password.length >= 6 && firstName.trim() && lastName.trim() && roleId > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    setSaveState('saving');
    setErrorMsg('');
    const payload: CreateUserDto = {
      email: email.trim(), password,
      firstName: firstName.trim(), lastName: lastName.trim(),
      roleId,
      campusId:    campusId    ?? undefined,
      jobTitleIds: jobTitleIds.length ? jobTitleIds : undefined,
      phone:   phone.trim()   || undefined,
      country: country.trim() || undefined,
      bio:     bio.trim()     || undefined,
    };
    createUser.mutate(payload, {
      onSuccess: (newUser) => {
        if (teamId) {
          createMembership.mutate(
            { userId: newUser.id, teamId, role: 'member' },
            { onSettled: () => { setSaveState('saved'); setTimeout(onClose, 900); } },
          );
        } else {
          setSaveState('saved');
          setTimeout(onClose, 900);
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

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-xl flex-shrink-0">🧑‍💼</div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900 text-[14px]">Nueva persona</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Crear un nuevo usuario en el sistema</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-3.5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Nombre <span className="text-red-400">*</span></label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition" placeholder="Nombre" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Apellido <span className="text-red-400">*</span></label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition" placeholder="Apellido" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Email <span className="text-red-400">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition" placeholder="usuario@iglesia.com" />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Contraseña <span className="text-red-400">*</span> <span className="text-slate-300 font-normal">— mín. 6 caracteres</span></label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition" placeholder="••••••••" />
              <button type="button" onClick={() => setShowPass((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass
                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                }
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Rol del sistema <span className="text-red-400">*</span></label>
            <select value={roleId || ''} onChange={(e) => setRoleId(Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition bg-white">
              <option value="">Seleccionar rol...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{ROLE_LABELS[r.name] ?? r.name}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-100 pt-1" />

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Cargos <span className="text-slate-300 font-normal">— puede agregar varios</span>
            </label>
            <MultiJobTitleSelect
              selectedIds={jobTitleIds}
              onChange={setJobTitleIds}
              allJobTitles={allJobTitles}
              onCreateNew={onCreateJobTitle}
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Campus <span className="text-slate-300 font-normal">— opcional</span>
            </label>
            <CampusSelect value={campusId} onChange={setCampusId} />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Equipo <span className="text-slate-300 font-normal">— opcional</span>
            </label>
            <TeamSelect value={teamId} onChange={setTeamId} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Teléfono</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition" placeholder="+57 300 000 0000" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">País</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition" placeholder="Colombia, Chile..." />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Biografía</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition resize-none" />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-[12px] text-red-700">{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSubmit} disabled={!canSubmit || saveState === 'saving' || saveState === 'saved'}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: saveState === 'saved' ? '#1D9E75' : saveState === 'error' ? '#DC2626' : '#7C3AED' }}>
              {saveState === 'idle'   && 'Crear persona'}
              {saveState === 'saving' && <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Creando...</>}
              {saveState === 'saved'  && '✓ ¡Creado!'}
              {saveState === 'error'  && '✕ Error'}
            </button>
            <button onClick={onClose} disabled={saveState === 'saving'}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] text-slate-500 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  user:      User;
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}

function DeleteConfirmModal({ user, onConfirm, onCancel, isPending }: DeleteConfirmModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  const { bg, text } = avatarColor(user.id);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[380px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 flex flex-col items-center gap-4 text-center">
          {/* Warning icon */}
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </div>

          <div>
            <p className="text-[15px] font-bold text-slate-900">¿Eliminar persona?</p>
            <p className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              Estás a punto de eliminar a{' '}
              <span className="font-semibold text-slate-700">{user.firstName} {user.lastName}</span>.
              Esta acción no se puede deshacer.
            </p>
          </div>

          {/* User preview */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 w-full">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold" style={{ background: bg, color: text }}>{userInitials(user)}</div>
            }
            <div className="min-w-0 text-left">
              <p className="text-[12px] font-semibold text-slate-800 truncate">{user.firstName} {user.lastName}</p>
              <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          <div className="flex gap-2 w-full pt-1">
            <button onClick={onCancel} disabled={isPending}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={onConfirm} disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-[13px] font-semibold text-white transition-colors disabled:opacity-50">
              {isPending
                ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Eliminando...</>
                : 'Sí, eliminar'
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: User['status'] }) {
  if (status === 'active')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo</span>;
  if (status === 'suspended')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Suspendido</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactivo</span>;
}

// ── FilterSelect ─────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, placeholder, children }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  const active = value !== '';
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`pl-3 pr-8 py-2 rounded-xl border text-[12.5px] font-medium appearance-none transition focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white ${
          active
            ? 'border-blue-400 text-blue-700 bg-blue-50'
            : 'border-slate-200 text-slate-600 hover:border-slate-300'
        }`}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <svg className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${active ? 'text-blue-500' : 'text-slate-400'}`}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  const btnCls = (active: boolean, disabled?: boolean) =>
    `min-w-[32px] h-8 px-2 rounded-lg text-[12px] font-medium transition-colors flex items-center justify-center ${
      disabled ? 'text-slate-300 cursor-not-allowed' :
      active   ? 'bg-slate-900 text-white' :
                 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="flex items-center justify-center gap-1 py-4">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className={btnCls(false, page === 1)}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="w-8 text-center text-slate-400 text-[12px]">…</span>
          : <button key={p} onClick={() => onChange(p)} className={btnCls(p === page)}>{p}</button>
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className={btnCls(false, page === totalPages)}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </div>
  );
}

// ── PersonasPage ──────────────────────────────────────────────────────────────

export default function PersonasPage() {
  const [search,    setSearch]    = useState('');
  const [debounced, setDebounced] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(debRef.current);
  }, [search]);

  // Filters
  const [cargoFilter,  setCargoFilter]  = useState('');
  const [campusFilter, setCampusFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: users = [], isLoading } = useUsers(debounced || undefined);
  const { data: allJobTitles = [] }     = useAllJobTitles();
  const { data: campuses = [] }         = useActiveCampuses();
  const createJobTitle                  = useCreateJobTitle();

  async function handleCreateJobTitle(name: string): Promise<JobTitle> {
    return createJobTitle.mutateAsync({ name });
  }

  const toggleStatus = useToggleUserStatus();
  const deleteUser   = useDeleteUser();

  const [editing,        setEditing]        = useState<User | null>(null);
  const [creating,       setCreating]       = useState(false);
  const [confirmDelete,  setConfirmDelete]  = useState<User | null>(null);
  const [togglingId,     setTogglingId]     = useState<number | null>(null);

  // Reset page when filters change
  useEffect(() => setPage(1), [debounced, cargoFilter, campusFilter, statusFilter]);

  // Client-side filtering
  const filtered = useMemo(() => {
    let list = users;
    if (cargoFilter)  list = list.filter((u) => u.jobTitles.some((jt) => String(jt.jobTitle.id) === cargoFilter));
    if (campusFilter) list = list.filter((u) => String(u.campusId) === campusFilter);
    if (statusFilter) list = list.filter((u) => u.status === statusFilter);
    return list;
  }, [users, cargoFilter, campusFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageUsers  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = cargoFilter || campusFilter || statusFilter;

  function handleToggle(user: User) {
    const next = user.status === 'active' ? 'inactive' : 'active';
    setTogglingId(user.id);
    toggleStatus.mutate({ id: user.id, status: next }, { onSettled: () => setTogglingId(null) });
  }

  function handleDeleteConfirm() {
    if (!confirmDelete) return;
    deleteUser.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
  }

  // Active job titles for the cargo filter dropdown
  const activeJobTitles = allJobTitles.filter((jt) => jt.isActive);

  return (
    <div className="space-y-5">

      {/* Back button */}
      <Link
        href="/dashboard/directorio"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-400 hover:text-slate-700 transition-colors group"
      >
        <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Directorio
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Personas</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {filtered.length !== users.length
              ? `${filtered.length} de ${users.length} persona${users.length !== 1 ? 's' : ''}`
              : `${users.length} persona${users.length !== 1 ? 's' : ''} registrada${users.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all bg-violet-600 hover:bg-violet-700">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva persona
        </button>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o cargo..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
          )}
        </div>

        {/* Cargo filter */}
        <FilterSelect value={cargoFilter} onChange={setCargoFilter} placeholder="Cargo">
          {activeJobTitles.map((jt) => (
            <option key={jt.id} value={String(jt.id)}>{jt.name}</option>
          ))}
        </FilterSelect>

        {/* Campus filter */}
        <FilterSelect value={campusFilter} onChange={setCampusFilter} placeholder="Campus">
          {campuses.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.name}</option>
          ))}
        </FilterSelect>

        {/* Estado filter */}
        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Estado">
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
          <option value="suspended">Suspendido</option>
        </FilterSelect>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setCargoFilter(''); setCampusFilter(''); setStatusFilter(''); }}
            className="text-[12px] text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Persona', 'Cargos', 'Campus', 'Estado', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10.5px] font-bold uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageUsers.map((u) => {
                  const { bg, text } = avatarColor(u.id);
                  const titles       = userJobTitleNames(u);
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            : <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-semibold" style={{ background: bg, color: text }}>{userInitials(u)}</div>
                          }
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{u.firstName} {u.lastName}</p>
                            <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {titles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {titles.map((t) => (
                              <span key={t} className="inline-block bg-blue-50 text-blue-700 text-[10px] font-medium px-2 py-0.5 rounded-full border border-blue-200">{t}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300 italic">Sin cargo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.campus
                          ? <span className="text-[12px] text-slate-600">{u.campus.name}</span>
                          : <span className="text-[11px] text-slate-300 italic">—</span>
                        }
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditing(u)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Editar">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button onClick={() => handleToggle(u)} disabled={togglingId === u.id}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${u.status === 'active' ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                            title={u.status === 'active' ? 'Desactivar' : 'Activar'}>
                            {togglingId === u.id
                              ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                              : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                                </svg>
                            }
                          </button>
                          <button
                            onClick={() => setConfirmDelete(u)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <p className="text-slate-400 text-sm">
                        {search || hasFilters ? 'Sin resultados para los filtros aplicados.' : 'No hay personas registradas'}
                      </p>
                      {hasFilters && (
                        <button
                          onClick={() => { setCargoFilter(''); setCampusFilter(''); setStatusFilter(''); setSearch(''); }}
                          className="mt-2 text-[12px] text-blue-500 hover:text-blue-700 underline underline-offset-2"
                        >
                          Limpiar todos los filtros
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-slate-100 px-4">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-slate-400">
                  Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {editing && (
        <EditPersonaModal
          user={editing}
          allJobTitles={allJobTitles}
          onCreateJobTitle={handleCreateJobTitle}
          onClose={() => setEditing(null)}
        />
      )}
      {creating && (
        <CreatePersonaModal
          allJobTitles={allJobTitles}
          onCreateJobTitle={handleCreateJobTitle}
          onClose={() => setCreating(false)}
        />
      )}
      {confirmDelete && (
        <DeleteConfirmModal
          user={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          isPending={deleteUser.isPending}
        />
      )}
    </div>
  );
}
