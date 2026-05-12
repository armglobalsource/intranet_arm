'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
import { primaryJobTitle, userJobTitleNames } from '@/types/user';

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#E6F1FB', text: '#185FA5' },
  { bg: '#FAEEDA', text: '#854F0B' },
  { bg: '#EEEDFE', text: '#534AB7' },
  { bg: '#FAECE7', text: '#993C1D' },
  { bg: '#FBEAF0', text: '#993556' },
];
const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', user: 'Usuario' };

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
      {/* Tags seleccionados */}
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

      {/* Input de búsqueda */}
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

// ── EditPersonaModal ──────────────────────────────────────────────────────────

interface EditPersonaModalProps {
  user:         User;
  allJobTitles: JobTitle[];
  onCreateJobTitle: (name: string) => Promise<JobTitle>;
  onClose:      () => void;
}

function EditPersonaModal({ user, allJobTitles, onCreateJobTitle, onClose }: EditPersonaModalProps) {
  const currentJobTitleIds = user.jobTitles.map((jt) => jt.jobTitle.id);

  const [firstName,    setFirstName]    = useState(user.firstName);
  const [lastName,     setLastName]     = useState(user.lastName);
  const [phone,        setPhone]        = useState(user.phone ?? '');
  const [country,      setCountry]      = useState(user.country ?? '');
  const [bio,          setBio]          = useState(user.bio ?? '');
  const [campusId,     setCampusId]     = useState<number | null>(user.campusId ?? null);
  const [jobTitleIds,  setJobTitleIds]  = useState<number[]>(currentJobTitleIds);
  const [saveState,    setSaveState]    = useState<'idle' | 'saving' | 'saved'>('idle');

  const updateUser = useUpdateUser();

  function handleSubmit() {
    setSaveState('saving');
    const payload: UpdateUserDto = {
      firstName:   firstName.trim() || undefined,
      lastName:    lastName.trim()  || undefined,
      phone:       phone.trim()     || undefined,
      country:     country.trim()   || undefined,
      bio:         bio.trim()       || undefined,
      campusId:    campusId,
      jobTitleIds: jobTitleIds,
    };
    updateUser.mutate({ id: user.id, data: payload }, {
      onSuccess: () => { setSaveState('saved'); setTimeout(onClose, 800); },
      onError:   () => setSaveState('idle'),
    });
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const { bg, text } = avatarColor(user.id);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[460px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            : <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-semibold text-[13px]" style={{ background: bg, color: text }}>{userInitials(user)}</div>
          }
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-[14px] truncate">{user.firstName} {user.lastName}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 text-sm">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-3.5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Nombre</label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Apellido</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Cargos <span className="text-slate-300 font-normal">— puede tener varios</span>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Teléfono</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" placeholder="+57 300 000 0000" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">País</label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition" placeholder="Colombia, Chile..." />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Biografía</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none" />
          </div>

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

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [roleId,      setRoleId]      = useState(0);
  const [campusId,    setCampusId]    = useState<number | null>(null);
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
      onSuccess: () => { setSaveState('saved'); setTimeout(onClose, 900); },
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
          {/* Nombre + Apellido */}
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

          {/* Email */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Email <span className="text-red-400">*</span></label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition" placeholder="usuario@iglesia.com" />
          </div>

          {/* Contraseña */}
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

          {/* Rol */}
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

          {/* Cargos (N) */}
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

          {/* Campus */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Campus <span className="text-slate-300 font-normal">— opcional</span>
            </label>
            <CampusSelect value={campusId} onChange={setCampusId} />
          </div>

          {/* Teléfono + País */}
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

          {/* Bio */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Biografía</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition resize-none" />
          </div>

          {/* Error */}
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

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: User['status'] }) {
  if (status === 'active')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Activo</span>;
  if (status === 'suspended')
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Suspendido</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[11.5px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Inactivo</span>;
}

// ── PersonasPage ──────────────────────────────────────────────────────────────

export default function PersonasPage() {
  const router = useRouter();
  const [search, setSearch]       = useState('');
  const [debounced, setDebounced] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(debRef.current);
  }, [search]);

  const { data: users = [], isLoading } = useUsers(debounced || undefined);
  const { data: allJobTitles = [] }     = useAllJobTitles();
  const createJobTitle                  = useCreateJobTitle();

  async function handleCreateJobTitle(name: string): Promise<JobTitle> {
    return createJobTitle.mutateAsync({ name });
  }

  const toggleStatus = useToggleUserStatus();
  const deleteUser   = useDeleteUser();

  const [editing,    setEditing]    = useState<User | null>(null);
  const [creating,   setCreating]   = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  function handleToggle(user: User) {
    const next = user.status === 'active' ? 'inactive' : 'active';
    setTogglingId(user.id);
    toggleStatus.mutate({ id: user.id, status: next }, { onSettled: () => setTogglingId(null) });
  }

  function handleDelete(id: number) {
    if (deletingId !== id) { setDeletingId(id); return; }
    deleteUser.mutate(id, { onSuccess: () => setDeletingId(null) });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Personas</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all bg-violet-600 hover:bg-violet-700">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva persona
        </button>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o cargo..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition bg-white" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">✕</button>
        )}
      </div>

      {/* Tabla */}
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
                {users.map((u) => {
                  const { bg, text } = avatarColor(u.id);
                  const titles       = userJobTitleNames(u);
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
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
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                            </svg>
                          </button>
                          <button onClick={() => handleDelete(u.id)} disabled={deleteUser.isPending && deletingId === u.id}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 ${deletingId === u.id ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                            title={deletingId === u.id ? 'Click para confirmar eliminación' : 'Eliminar'}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                      {search ? `Sin resultados para "${search}"` : 'No hay personas registradas'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}
